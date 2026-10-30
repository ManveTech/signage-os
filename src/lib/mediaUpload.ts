import { mediaStore, MediaItem } from './mediaStore';
import { maxUploadBytesFor } from './uploadLimits';
import { requestUploadUrl, putToStorage, putInParts, DirectUploadUnavailable } from './directUpload';

/**
 * The one place that turns a picked file into a media item — used by the
 * media library and the playlist builder, so size checks, image resizing and
 * error messages behave the same everywhere.
 */

/** Images larger than 4K are scaled down; nothing a TV shows needs more. */
const MAX_IMAGE_WIDTH = 3840;
const MAX_IMAGE_HEIGHT = 2160;
/** JPEG/WebP photos above this are re-encoded (phone photos are often 4–8 MB). */
const REENCODE_ABOVE_BYTES = 2 * 1024 * 1024;

export const formatBytes = (bytes: number) =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB`
    : bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} MB`
    : bytes <= 0 ? "0 MB" : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * Exactly what the server will store — mirrored from ALLOWED_MEDIA_MIME_TYPES
 * in server/controllers/media_items.ts. The file picker asks for `image/*`
 * and `video/*`, which is far wider than this, so without the same list here
 * a HEIC photo or an AVI was read, re-encoded, base64'd and uploaded in full
 * before the server turned it down.
 */
export const ACCEPTED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/quicktime',
]);

const EXTENSION_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
};

const extensionOf = (name: string) => (name.split('.').pop() || '').toLowerCase();

/**
 * The file's type, falling back to its extension.
 *
 * Several Android file pickers hand back a File whose `type` is the empty
 * string, which made a perfectly ordinary .mp4 fail the check below with
 * "Only images and videos can be uploaded".
 */
export function mimeOf(file: File): string {
  if (ACCEPTED_MIME_TYPES.has(file.type)) return file.type;
  return EXTENSION_MIME[extensionOf(file.name)] || file.type || '';
}

export const isUploadableFile = (file: File) => ACCEPTED_MIME_TYPES.has(mimeOf(file));

/** Says what's wrong in terms of the file the person actually picked. */
function unsupportedMessage(file: File): string {
  const ext = extensionOf(file.name);
  if (ext === 'heic' || ext === 'heif') {
    return "iPhone HEIC photos can't be used — in Settings › Camera › Formats pick “Most Compatible”, or save this one as a JPEG first";
  }
  const what = ext ? `.${ext} files` : 'This file type';
  return `${what} can't be used — images must be JPG, PNG, GIF or WebP, videos MP4, WebM or MOV`;
}

export interface FileCheck {
  file: File;
  /** Why this file can't be uploaded; undefined if it can. */
  error?: string;
}

/**
 * Checks a batch before anything is sent: type, per-file size limit, and the
 * running total against the remaining storage (null = no plan limit).
 */
export function checkFiles(files: File[], usedBytes: number, limitBytes: number | null): FileCheck[] {
  let running = usedBytes;
  return files.map(file => {
    if (!isUploadableFile(file)) return { file, error: unsupportedMessage(file) };
    const isVideo = mimeOf(file).startsWith('video/');
    const max = maxUploadBytesFor(isVideo);
    if (file.size > max) return { file, error: `Too large — ${isVideo ? 'videos' : 'images'} must be under ${formatBytes(max)}` };
    if (limitBytes !== null && running + file.size > limitBytes) return { file, error: 'Not enough storage left on your plan' };
    running += file.size;
    return { file };
  });
}

const readAsDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  // "Could not read the file" on its own left no idea what to do about it.
  // In practice this is either a file the OS hasn't actually downloaded yet
  // (iCloud Drive, Google Drive) or one too big for the device to hold in
  // memory while it is base64-encoded for upload.
  reader.onerror = () => reject(new Error(
    "Couldn't read this file — if it's stored in iCloud or Drive, open it once to download it first; very large files can also run the device out of memory"
  ));
  reader.readAsDataURL(blob);
});

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('This image could not be opened'));
  img.src = src;
});

const videoInfo = (file: File) => new Promise<{ width: number; height: number; duration: number }>(resolve => {
  const video = document.createElement('video');
  const url = URL.createObjectURL(file);
  const done = (info: { width: number; height: number; duration: number }) => { URL.revokeObjectURL(url); resolve(info); };
  video.preload = 'metadata';
  video.muted = true;
  video.onloadedmetadata = () => done({
    width: video.videoWidth || 1920,
    height: video.videoHeight || 1080,
    duration: Math.round(video.duration) || 15
  });
  // Some formats (e.g. HEVC on desktop Chrome) can't be inspected in the
  // browser but still play on TVs — upload them with sensible defaults.
  video.onerror = () => done({ width: 1920, height: 1080, duration: 15 });
  video.src = url;
});

/** Shrinks/re-encodes big photos; returns the original when that isn't worth it. */
async function optimiseImage(file: File): Promise<{ blob: Blob; width: number; height: number; mimeType: string; fileName: string }> {
  const url = URL.createObjectURL(file);
  // Shrinking is an optimisation, not a requirement. A format the server
  // accepts but this browser happens not to decode used to fail the whole
  // upload with "This image could not be opened"; now it goes up untouched
  // and the TV — which decodes it, not the browser — plays it.
  const asIs = { blob: file as Blob, width: 0, height: 0, mimeType: mimeOf(file), fileName: file.name };
  try {
    const img = await loadImage(url).catch(() => null);
    if (!img) return asIs;
    const { naturalWidth: w, naturalHeight: h } = img;
    const tooBig = w > MAX_IMAGE_WIDTH || h > MAX_IMAGE_HEIGHT;
    const type = mimeOf(file);
    const lossy = type === 'image/jpeg' || type === 'image/webp';
    if (!tooBig && !(lossy && file.size > REENCODE_ABOVE_BYTES)) {
      return { ...asIs, blob: file, width: w, height: h };
    }
    const ratio = tooBig ? Math.min(MAX_IMAGE_WIDTH / w, MAX_IMAGE_HEIGHT / h) : 1;
    const width = Math.round(w * ratio);
    const height = Math.round(h * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ...asIs, blob: file, width: w, height: h };
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);
    // PNGs (logos, graphics with transparency) stay PNG.
    const mimeType = type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, mimeType, mimeType === 'image/jpeg' ? 0.88 : undefined));
    if (!blob || (!tooBig && blob.size >= file.size)) {
      return { ...asIs, blob: file, width: w, height: h };
    }
    const base = file.name.replace(/\.[^/.]+$/, '');
    return { blob, width, height, mimeType, fileName: `${base}.${mimeType === 'image/png' ? 'png' : 'jpg'}` };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Uploads one already-checked file for `owner`.
 *
 * Tries object storage directly first — the browser PUTs the file itself and
 * nothing is ever base64-encoded, which is what made large videos fail. Falls
 * back to posting the bytes through the API when storage isn't set up for it,
 * or when the server is older than that endpoint.
 *
 * Throws with a readable message on failure.
 */
/**
 * 'optimising' = a video being re-encoded on this device before it goes up;
 * 'uploading' = bytes on their way. Each stage reports its own 0–1 fraction.
 */
export type UploadStage = 'optimising' | 'uploading';

export async function uploadMediaFile(
  original: File,
  owner: string,
  title?: string,
  onProgress?: (fraction: number, stage: UploadStage) => void
): Promise<MediaItem> {
  let file = original;
  const isVideo = mimeOf(file).startsWith('video/');
  const sendProgress = onProgress && ((f: number) => onProgress(f, 'uploading'));
  const cleanTitle = (title || '').trim() || file.name.replace(/\.[^/.]+$/, '');
  const expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  if (isVideo) {
    // Shrink it on this device first. Any failure (unsupported browser,
    // odd codec, encoder stall) just means the original goes up instead.
    let info: { width: number; height: number; duration: number } | null = null;
    try {
      onProgress?.(0, 'optimising');
      const { compressVideo } = await import('./videoCompress');
      const small = await compressVideo(file, f => onProgress?.(f, 'optimising'));
      if (small) {
        file = small.file;
        info = small;
      }
    } catch (err) {
      console.warn('[upload] video compression unavailable, uploading the original:', err);
    }
    info = info || await videoInfo(file);
    const common = {
      title: cleanTitle,
      type: 'video' as const,
      duration: info.duration,
      resolution: `${info.width}x${info.height}`,
      fileSize: formatBytes(file.size),
      fileSizeBytes: file.size,
      uploadedBy: owner,
      expiryDate,
      tags: ['uploaded', 'video'],
      // The server replaces this with the stored file's URL; video tiles use
      // a poster frame generated from that URL.
      thumbnail: '',
      width: info.width,
      height: info.height,
      mimeType: mimeOf(file),
      fileName: file.name
    };

    const sent = await sendDirect(file, mimeOf(file), owner, sendProgress);
    if (sent) return mediaStore.uploadMedia({ ...common, ...sent });

    // Fallback: the whole file as base64 in a JSON body.
    const dataUrl = await readAsDataUrl(file);
    return mediaStore.uploadMedia({ ...common, fileData: dataUrl.split(',')[1] });
  }

  const img = await optimiseImage(file);
  const common = {
    title: cleanTitle,
    type: 'image' as const,
    duration: 10,
    // 0 when the browser couldn't decode it to measure — better blank than "0 × 0".
    resolution: img.width && img.height ? `${img.width}x${img.height}` : '',
    fileSize: formatBytes(img.blob.size),
    fileSizeBytes: img.blob.size,
    uploadedBy: owner,
    expiryDate,
    tags: ['uploaded', 'image'],
    width: img.width,
    height: img.height,
    mimeType: img.mimeType,
    fileName: img.fileName
  };

  const sent = await sendDirect(img.blob, img.mimeType, owner, sendProgress, img.fileName);
  if (sent) {
    // No data URL on this path, and none needed: the server points the
    // thumbnail at the stored file.
    return mediaStore.uploadMedia({ ...common, thumbnail: '', ...sent });
  }

  const dataUrl = await readAsDataUrl(img.blob);
  return mediaStore.uploadMedia({ ...common, thumbnail: dataUrl, fileData: dataUrl.split(',')[1] });
}

/**
 * Put the bytes in storage and say where they went, or null to use the old path.
 *
 * Big files go up as pieces several at a time (the server decides from the
 * size); r2UploadId and r2PartCount tell it to join them.
 *
 * Only "storage isn't available" returns null. A real failure — refused,
 * connection lost, over quota — is thrown, because retrying a 200 MB video
 * through the base64 path would fail far more slowly and for a reason that
 * has nothing to do with what actually went wrong.
 */
async function sendDirect(
  blob: Blob,
  mimeType: string,
  owner: string,
  onProgress?: (fraction: number) => void,
  fileName?: string
): Promise<{ r2Key: string; r2UploadId?: string; r2PartCount?: number } | null> {
  let target;
  try {
    target = await requestUploadUrl({
      fileName: fileName || (blob as File).name || 'upload',
      mimeType,
      fileSizeBytes: blob.size,
      uploadedBy: owner,
      multipart: true
    });
  } catch (err) {
    if (err instanceof DirectUploadUnavailable) return null;
    throw err;
  }
  if (target.uploadId && target.partUrls?.length) {
    await putInParts(target, blob, onProgress);
    return { r2Key: target.key, r2UploadId: target.uploadId, r2PartCount: target.partUrls.length };
  }
  await putToStorage(target, blob, onProgress);
  return { r2Key: target.key };
}
