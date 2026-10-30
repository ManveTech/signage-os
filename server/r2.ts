import {
  S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand, HeadObjectCommand,
  CreateMultipartUploadCommand, UploadPartCommand, ListPartsCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getCloudflareConfig, CloudflareConfig } from './integrationsStore';

function buildS3Client(cfg: Pick<CloudflareConfig, 'region' | 'endpoint' | 'accessKeyId' | 'secretAccessKey'>): S3Client {
  return new S3Client({
    region: cfg.region || 'auto',
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey
    },
    forcePathStyle: true
  });
}

function publicBaseUrlFor(cfg: Pick<CloudflareConfig, 'publicUrl' | 'endpoint' | 'bucket'>): string {
  const base = cfg.publicUrl || `${cfg.endpoint}/${cfg.bucket}`;
  return base.replace(/\/$/, '');
}

/**
 * Upload a file buffer directly to Cloudflare R2.
 * Returns the public URL of the uploaded file.
 */
export async function uploadToR2(
  buffer: Buffer,
  key: string,
  mimeType: string,
  /** Sent back as Content-Disposition — e.g. so an APK downloads under its own name. */
  contentDisposition?: string
): Promise<string> {
  const cfg = await getCloudflareConfig();
  if (!cfg.enabled || !cfg.bucket || !cfg.accessKeyId || !cfg.secretAccessKey) {
    throw new Error('R2 storage is not configured. Set it up in Admin > Integrations, or via S3_ENABLED/S3_BUCKET/S3_ACCESS_KEY/S3_SECRET in .env');
  }

  const client = buildS3Client(cfg);

  await client.send(new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    ...(contentDisposition ? { ContentDisposition: contentDisposition } : {})
    // Note: Cloudflare R2 does not support ACLs.
    // Public access is controlled at the bucket level via the Cloudflare dashboard.
  }));

  return `${publicBaseUrlFor(cfg)}/${key}`;
}

/** Public address an object key will be served from. */
export async function publicUrlForKey(key: string): Promise<string> {
  const cfg = await getCloudflareConfig();
  return `${publicBaseUrlFor(cfg)}/${key}`;
}

/**
 * A short-lived URL the browser can PUT a file straight to.
 *
 * Uploads used to arrive as base64 inside a JSON body, which meant the whole
 * file sat in memory three times over in the browser and twice more on the
 * server — a 200 MB video needed well over a gigabyte and simply killed the
 * WebView on a phone. With this the file goes browser → R2 and never touches
 * this server at all.
 *
 * The PUT should send the same content type this is signed for, but do not
 * rely on that for safety: R2 accepts a PUT whose Content-Type differs from
 * the signed one and stores what it was sent. Nor can the signature pin the
 * length. Both are therefore re-read from the stored object with
 * headR2Object, which is the only account of either worth trusting.
 */
export async function presignR2Upload(
  key: string,
  mimeType: string,
  expiresInSeconds = 900
): Promise<string> {
  const cfg = await getCloudflareConfig();
  if (!cfg.enabled || !cfg.bucket || !cfg.accessKeyId || !cfg.secretAccessKey) {
    throw new Error('R2 storage is not configured');
  }
  const client = buildS3Client(cfg);
  return getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: cfg.bucket, Key: key, ContentType: mimeType }),
    { expiresIn: expiresInSeconds }
  );
}

/**
 * A big file sent as several pieces at once (S3 multipart upload).
 *
 * One PUT is one stream, and on a phone's mobile data a single stream rarely
 * fills the connection — a 200 MB video took minutes longer than the line
 * allowed. With the pieces signed up front, the browser sends four at a time
 * and retries only a piece that fails, not the whole file.
 *
 * R2 needs every piece but the last to be the same size (at least 5 MB).
 */
export async function startR2MultipartUpload(
  key: string,
  mimeType: string,
  partCount: number,
  expiresInSeconds = 3600
): Promise<{ uploadId: string; partUrls: string[] }> {
  const cfg = await getCloudflareConfig();
  if (!cfg.enabled || !cfg.bucket || !cfg.accessKeyId || !cfg.secretAccessKey) {
    throw new Error('R2 storage is not configured');
  }
  const client = buildS3Client(cfg);
  const created = await client.send(new CreateMultipartUploadCommand({ Bucket: cfg.bucket, Key: key, ContentType: mimeType }));
  const uploadId = created.UploadId;
  if (!uploadId) throw new Error('Storage did not start the upload');
  const partUrls = await Promise.all(Array.from({ length: partCount }, (_, i) =>
    getSignedUrl(
      client,
      new UploadPartCommand({ Bucket: cfg.bucket, Key: key, UploadId: uploadId, PartNumber: i + 1 }),
      { expiresIn: expiresInSeconds }
    )
  ));
  return { uploadId, partUrls };
}

/**
 * Joins the pieces into one object. The pieces' ETags are read from R2 here
 * rather than sent by the browser: reading a response's ETag in the browser
 * needs the bucket's CORS rules to expose it, and this way they don't.
 */
export async function completeR2MultipartUpload(key: string, uploadId: string, expectedParts?: number): Promise<void> {
  const cfg = await getCloudflareConfig();
  if (!cfg.enabled || !cfg.bucket) throw new Error('R2 storage is not configured');
  const client = buildS3Client(cfg);
  const parts: { PartNumber: number; ETag: string }[] = [];
  let marker: string | undefined;
  do {
    const page = await client.send(new ListPartsCommand({ Bucket: cfg.bucket, Key: key, UploadId: uploadId, PartNumberMarker: marker }));
    for (const p of page.Parts || []) {
      if (p.PartNumber && p.ETag) parts.push({ PartNumber: p.PartNumber, ETag: p.ETag });
    }
    marker = page.IsTruncated ? page.NextPartNumberMarker : undefined;
  } while (marker);
  if (parts.length === 0) throw new Error('No pieces of the upload arrived');
  parts.sort((a, b) => a.PartNumber - b.PartNumber);
  // A missing piece would join into a file with a hole in it.
  if (parts.some((p, i) => p.PartNumber !== i + 1) || (expectedParts && parts.length !== expectedParts)) {
    throw new Error('Part of the upload is missing');
  }
  await client.send(new CompleteMultipartUploadCommand({
    Bucket: cfg.bucket, Key: key, UploadId: uploadId, MultipartUpload: { Parts: parts }
  }));
}

/** Throws away the pieces of an upload that was cancelled or failed. */
export async function abortR2MultipartUpload(key: string, uploadId: string): Promise<void> {
  const cfg = await getCloudflareConfig();
  if (!cfg.enabled || !cfg.bucket) return;
  const client = buildS3Client(cfg);
  await client.send(new AbortMultipartUploadCommand({ Bucket: cfg.bucket, Key: key, UploadId: uploadId }));
}

/** What R2 actually holds at `key`, or null if nothing is there. */
export async function headR2Object(key: string): Promise<{ size: number; etag: string; mimeType: string } | null> {
  const cfg = await getCloudflareConfig();
  if (!cfg.enabled || !cfg.bucket) return null;
  try {
    const client = buildS3Client(cfg);
    const out = await client.send(new HeadObjectCommand({ Bucket: cfg.bucket, Key: key }));
    return {
      size: out.ContentLength ?? 0,
      etag: (out.ETag || '').replace(/"/g, ''),
      mimeType: out.ContentType || ''
    };
  } catch {
    return null;
  }
}

/**
 * Delete a file from Cloudflare R2 by its key.
 */
export async function deleteFromR2(key: string): Promise<void> {
  const cfg = await getCloudflareConfig();
  if (!cfg.enabled || !cfg.bucket || !cfg.accessKeyId || !cfg.secretAccessKey) return;
  const client = buildS3Client(cfg);
  await client.send(new DeleteObjectCommand({
    Bucket: cfg.bucket,
    Key: key
  }));
}

/**
 * Derive the R2 object key from a file URL (reverse of uploadToR2).
 */
export async function getKeyFromUrl(url: string): Promise<string | null> {
  try {
    const cfg = await getCloudflareConfig();
    const base = publicBaseUrlFor(cfg);
    if (base && url.startsWith(base)) {
      // Addresses may be URL-encoded; object keys aren't.
      const raw = url.slice(base.length + 1).split(/[?#]/)[0]; // +1 for the slash
      try { return decodeURIComponent(raw); } catch { return raw; }
    }
    return null;
  } catch {
    return null;
  }
}

export async function isR2Enabled(): Promise<boolean> {
  const cfg = await getCloudflareConfig();
  return cfg.enabled;
}

/**
 * Live connection test used by the Integrations dashboard's "Test Connection"
 * button — confirms the given credentials can actually reach the bucket
 * (HeadBucket needs no read/write permissions beyond bucket-level access) so
 * a bad key/secret/bucket name is caught before anyone relies on it for a
 * real upload.
 */
export async function testR2Connection(cfg: Pick<CloudflareConfig, 'bucket' | 'region' | 'endpoint' | 'accessKeyId' | 'secretAccessKey'>): Promise<{ ok: boolean; error?: string }> {
  if (!cfg.bucket || !cfg.endpoint || !cfg.accessKeyId || !cfg.secretAccessKey) {
    return { ok: false, error: 'bucket, endpoint, accessKeyId, and secretAccessKey are all required.' };
  }
  try {
    const client = buildS3Client(cfg);
    await client.send(new HeadBucketCommand({ Bucket: cfg.bucket }));
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message || 'Connection failed' };
  }
}
