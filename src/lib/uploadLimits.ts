// Per-file media upload limits, mirrored from server/uploadLimits.ts (the
// server enforces them too) — keep the two in sync.
export const MAX_VIDEO_UPLOAD_BYTES = 300 * 1024 * 1024; // 300 MB
export const MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024;  // 20 MB
/**
 * PDFs get more room than a single image because one file carries many
 * pages, but far less than a video: every page is rasterised in the
 * browser before upload, and a 200MB PDF would exhaust a phone's memory
 * long before it finished.
 */
export const MAX_PDF_UPLOAD_BYTES = 60 * 1024 * 1024;    // 60 MB

export type UploadKind = 'image' | 'video' | 'pdf';

export const maxUploadBytesForKind = (kind: UploadKind) =>
  kind === 'video' ? MAX_VIDEO_UPLOAD_BYTES
    : kind === 'pdf' ? MAX_PDF_UPLOAD_BYTES
      : MAX_IMAGE_UPLOAD_BYTES;

export const maxUploadBytesFor = (isVideo: boolean) =>
  maxUploadBytesForKind(isVideo ? 'video' : 'image');
