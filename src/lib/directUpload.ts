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
  uploadUrl: string;
  key: string;
  mimeType: string;
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
 * PUT the file to the signed URL.
 *
 * XMLHttpRequest rather than fetch purely for upload progress — fetch still
 * can't report it in Safari or an Android WebView, and a 200 MB upload with
 * no feedback looks like a hang.
 *
 * The Content-Type has to match what the URL was signed for, or the
 * signature check fails.
 */
export function putToStorage(
  target: DirectUploadTarget,
  file: Blob,
  onProgress?: (fraction: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', target.uploadUrl, true);
    xhr.setRequestHeader('Content-Type', target.mimeType);

    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
      } else if (xhr.status === 403) {
        // Nearly always the 15-minute signature expiring mid-upload on a slow
        // connection, or the bucket's CORS rules not allowing PUT.
        reject(new Error('The upload was refused by storage — start it again'));
      } else {
        reject(new Error(`Storage rejected the upload (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('Lost connection while uploading — check your internet and try again'));
    xhr.ontimeout = () => reject(new Error('The upload timed out'));
    xhr.onabort = () => reject(new Error('Upload cancelled'));

    xhr.send(file);
  });
}
