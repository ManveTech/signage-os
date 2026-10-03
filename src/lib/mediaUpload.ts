import { mediaStore, MediaItem } from './mediaStore';
import { maxUploadBytesFor } from './uploadLimits';

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

export const isUploadableFile = (file: File) => file.type.startsWith('image/') || file.type.startsWith('video/');

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
    if (!isUploadableFile(file)) return { file, error: 'Only images and videos can be uploaded' };
    const isVideo = file.type.startsWith('video/');
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
  reader.onerror = () => reject(new Error('Could not read the file'));
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
  try {
    const img = await loadImage(url);
    const { naturalWidth: w, naturalHeight: h } = img;
    const tooBig = w > MAX_IMAGE_WIDTH || h > MAX_IMAGE_HEIGHT;
    const lossy = file.type === 'image/jpeg' || file.type === 'image/webp';
    if (!tooBig && !(lossy && file.size > REENCODE_ABOVE_BYTES)) {
      return { blob: file, width: w, height: h, mimeType: file.type, fileName: file.name };
    }
    const ratio = tooBig ? Math.min(MAX_IMAGE_WIDTH / w, MAX_IMAGE_HEIGHT / h) : 1;
    const width = Math.round(w * ratio);
    const height = Math.round(h * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { blob: file, width: w, height: h, mimeType: file.type, fileName: file.name };
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);
    // PNGs (logos, graphics with transparency) stay PNG.
    const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, mimeType, mimeType === 'image/jpeg' ? 0.88 : undefined));
    if (!blob || (!tooBig && blob.size >= file.size)) {
      return { blob: file, width: w, height: h, mimeType: file.type, fileName: file.name };
    }
    const base = file.name.replace(/\.[^/.]+$/, '');
    return { blob, width, height, mimeType, fileName: `${base}.${mimeType === 'image/png' ? 'png' : 'jpg'}` };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Uploads one already-checked file for `owner`. Throws with a readable message on failure. */
export async function uploadMediaFile(file: File, owner: string, title?: string): Promise<MediaItem> {
  const isVideo = file.type.startsWith('video/');
  const cleanTitle = (title || '').trim() || file.name.replace(/\.[^/.]+$/, '');
  const expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  if (isVideo) {
    const [info, dataUrl] = await Promise.all([videoInfo(file), readAsDataUrl(file)]);
    return mediaStore.uploadMedia({
      title: cleanTitle,
      type: 'video',
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
      mimeType: file.type,
      fileData: dataUrl.split(',')[1],
      fileName: file.name
    });
  }

  const img = await optimiseImage(file);
  const dataUrl = await readAsDataUrl(img.blob);
  return mediaStore.uploadMedia({
    title: cleanTitle,
    type: 'image',
    duration: 10,
    resolution: `${img.width}x${img.height}`,
    fileSize: formatBytes(img.blob.size),
    fileSizeBytes: img.blob.size,
    uploadedBy: owner,
    expiryDate,
    tags: ['uploaded', 'image'],
    thumbnail: dataUrl,
    width: img.width,
    height: img.height,
    mimeType: img.mimeType,
    fileData: dataUrl.split(',')[1],
    fileName: img.fileName
  });
}
