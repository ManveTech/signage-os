import { API_BASE } from '../config';
import { getHeaders } from './syncHelper';

/**
 * Upload a file straight to object storage, bypassing the API server.
 *
 * The original path put the file in a JSON body as base64. That meant the
 * whole thing existed several times at once in the browser — once as the
 * data URL, again as the split-off base64, again inside JSON.stringify — at
 * 4/3 size and, because JS strings are UTF-16, often double that again. A
 * 200 MB video therefore needed well over a gigabyte and reliably killed the
 * WebView on a phone. It cost the server about as much on the way in.
 *
 * Here the browser asks for a short-lived signed URL and PUTs the File
 * object itself, which the browser streams from disk without ever holding it
 * in memory, then tells the API what landed. The server's share is two small
 * JSON requests no matter how big the file is.
 */

export interface DirectUploadTarget {
  key: string;
  mimeType: string;
  /** One PUT for the whole file… */
  uploadUrl?: string;
  /** …or, for a big file, a URL per piece of `partSize` bytes (see putInParts). */
  uploadId?: string;
  partSize?: number;
  partUrls?: string[];
}

/** Thrown when storage isn't set up for direct uploads, so the caller falls back. */
export class DirectUploadUnavailable extends Error {}

/**
 * Ask the API for a signed URL.
 *
 * `fileSizeBytes` is only a claim at this point — it buys an early rejection
 * for something obviously over the limit instead of after a long upload. The
 * server re-checks against the object itself once it has been stored.
 */
export async function requestUploadUrl(params: {
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedBy: string;
  /** Offer to send it in pieces; the server decides (big files only). */
  multipart?: boolean;
}): Promise<DirectUploadTarget> {
  const res = await fetch(`${API_BASE}/media_items/upload-url`, {
    method: 'POST',
    headers: getHeaders(),
    credentials: 'include',
    body: JSON.stringify(params)
  });

  const body = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    // 409 means there's no bucket configured; 404 means the server predates
    // this endpoint. Either way the old path still works, so say so rather
    // than failing the upload.
    if (res.status === 409 || res.status === 404) {
      throw new DirectUploadUnavailable(body.error || 'Direct upload unavailable');
    }
    throw new Error(body.error || `Could not start the upload (${res.status})`);
  }
  return body as DirectUploadTarget;
}

/**
 * PUT one blob to a signed URL.
 *
 * XMLHttpRequest rather than fetch purely for upload progress — fetch still
 * can't report it in Safari or an Android WebView, and a 200 MB upload with
 * no feedback looks like a hang.
 */
function putBlob(
  url: string,
  blob: Blob,
  contentType: string | null,
  onProgress?: (loaded: number) => void,
  register?: (xhr: XMLHttpRequest) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    register?.(xhr);
    xhr.open('PUT', url, true);
    // The single PUT is signed for a Content-Type and must send the same one;
    // pieces are signed without one.
    if (contentType) xhr.setRequestHeader('Content-Type', contentType);

    xhr.upload.onprogress = e => onProgress?.(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(blob.size);
        resolve();
      } else if (xhr.status === 403) {
        // Nearly always the signature expiring on a slow connection, or the
        // bucket's CORS rules not allowing PUT.
        reject(new UploadError('The upload was refused by storage — start it again', false));
      } else {
        reject(new UploadError(`Storage rejected the upload (${xhr.status})`, xhr.status >= 500));
      }
    };
    xhr.onerror = () => reject(new UploadError('Lost connection while uploading — check your internet and try again', true));
    xhr.ontimeout = () => reject(new UploadError('The upload timed out', true));
    xhr.onabort = () => reject(new UploadError('Upload cancelled', false));

    xhr.send(blob);
  });
}

class UploadError extends Error {
  constructor(message: string, readonly retryable: boolean) { super(message); }
}

/** PUT the whole file to the signed URL (Content-Type must match the signature). */
export function putToStorage(
  target: DirectUploadTarget,
  file: Blob,
  onProgress?: (fraction: number) => void
): Promise<void> {
  if (!target.uploadUrl) return Promise.reject(new Error('No upload address'));
  return putBlob(target.uploadUrl, file, target.mimeType, loaded => onProgress?.(file.size ? loaded / file.size : 1));
}

/** Pieces sent at the same time. More than this mostly just competes for the same line. */
const PARALLEL_PARTS = 4;
const PART_ATTEMPTS = 3;

/**
 * Send a big file as pieces, PARALLEL_PARTS at a time.
 *
 * One stream rarely fills a phone's mobile-data connection; several do. A
 * piece that fails (a dropped connection, a 5xx) is retried on its own
 * instead of restarting a 200 MB upload from zero. The server joins the
 * pieces when the upload is recorded.
 */
export async function putInParts(
  target: DirectUploadTarget,
  file: Blob,
  onProgress?: (fraction: number) => void
): Promise<void> {
  const urls = target.partUrls || [];
  const size = target.partSize || 0;
  if (!urls.length || !size) throw new Error('No upload address');

  const loaded = new Array<number>(urls.length).fill(0);
  const report = () => onProgress?.(Math.min(1, loaded.reduce((a, b) => a + b, 0) / (file.size || 1)));
  const live = new Set<XMLHttpRequest>();
  let failed: Error | null = null;
  let next = 0;

  const sendPart = async (index: number) => {
    const blob = file.slice(index * size, Math.min(file.size, (index + 1) * size));
    for (let attempt = 1; ; attempt++) {
      try {
        await putBlob(urls[index], blob, null, n => { loaded[index] = n; report(); }, xhr => live.add(xhr));
        return;
      } catch (err) {
        loaded[index] = 0;
        report();
        const retryable = err instanceof UploadError && err.retryable;
        if (failed || !retryable || attempt >= PART_ATTEMPTS) throw err;
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  };

  const worker = async () => {
    while (!failed && next < urls.length) {
      const index = next++;
      try {
        await sendPart(index);
      } catch (err) {
        if (!failed) failed = err instanceof Error ? err : new Error('Upload failed');
        // Stop the other pieces rather than finish an upload that can't complete.
        live.forEach(x => x.abort());
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(PARALLEL_PARTS, urls.length) }, worker));
  if (failed) {
    abortUpload(target);
    throw failed;
  }
  onProgress?.(1);
}

/** Tell the server to drop the pieces of an upload that didn't finish. Best effort. */
export function abortUpload(target: DirectUploadTarget): void {
  if (!target.uploadId) return;
  fetch(`${API_BASE}/media_items/upload-abort`, {
    method: 'POST',
    headers: getHeaders(),
    credentials: 'include',
    body: JSON.stringify({ key: target.key, uploadId: target.uploadId })
  }).catch(() => {});
}
