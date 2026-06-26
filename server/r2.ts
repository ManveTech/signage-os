import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import {
  S3_ENABLED,
  S3_BUCKET,
  S3_REGION,
  S3_ENDPOINT,
  S3_ACCESS_KEY,
  S3_SECRET
} from './config';

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: S3_REGION || 'auto',
      endpoint: S3_ENDPOINT,
      credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET
      },
      forcePathStyle: true
    });
  }
  return s3Client;
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
  if (!S3_ENABLED || !S3_BUCKET || !S3_ACCESS_KEY || !S3_SECRET) {
    throw new Error('R2 storage is not configured. Set S3_ENABLED, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET in .env');
  }

  const client = getS3Client();

  await client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType
    // Note: Cloudflare R2 does not support ACLs.
    // Public access is controlled at the bucket level via the Cloudflare dashboard.
  }));

  // Build public URL: either custom domain or R2 public URL format
  // Cloudflare R2 public URL pattern: https://<accountId>.r2.cloudflarestorage.com/<bucket>/<key>
  // If you have a custom public domain set on the bucket, set R2_PUBLIC_URL in .env instead
  const publicBaseUrl = process.env.R2_PUBLIC_URL
    ? process.env.R2_PUBLIC_URL.replace(/\/$/, '')
    : `${S3_ENDPOINT}/${S3_BUCKET}`;

  return `${publicBaseUrl}/${key}`;
}

/**
 * Delete a file from Cloudflare R2 by its key.
 */
export async function deleteFromR2(key: string): Promise<void> {
  if (!S3_ENABLED || !S3_BUCKET || !S3_ACCESS_KEY || !S3_SECRET) return;
  const client = getS3Client();
  await client.send(new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: key
  }));
}

/**
 * Derive the R2 object key from a file URL (reverse of uploadToR2).
 */
export function getKeyFromUrl(url: string): string | null {
  try {
    const publicBaseUrl = process.env.R2_PUBLIC_URL
      ? process.env.R2_PUBLIC_URL.replace(/\/$/, '')
      : `${S3_ENDPOINT}/${S3_BUCKET}`;
    if (url.startsWith(publicBaseUrl)) {
      return url.slice(publicBaseUrl.length + 1); // +1 for the slash
    }
    return null;
  } catch {
    return null;
  }
}
