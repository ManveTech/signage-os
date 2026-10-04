import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
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
  mimeType: string
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
    ContentType: mimeType
    // Note: Cloudflare R2 does not support ACLs.
    // Public access is controlled at the bucket level via the Cloudflare dashboard.
  }));

  return `${publicBaseUrlFor(cfg)}/${key}`;
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
