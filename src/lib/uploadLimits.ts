// Per-file media upload limits, mirrored from server/uploadLimits.ts (the
// server enforces them too) — keep the two in sync.
export const MAX_VIDEO_UPLOAD_BYTES = 300 * 1024 * 1024; // 300 MB
export const MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024;  // 20 MB

export const maxUploadBytesFor = (isVideo: boolean) =>
  isVideo ? MAX_VIDEO_UPLOAD_BYTES : MAX_IMAGE_UPLOAD_BYTES;
