// Single source of truth for per-file media upload limits. The dashboards
// mirror these in src/lib/uploadLimits.ts — keep the two in sync.
export const MAX_VIDEO_UPLOAD_BYTES = 300 * 1024 * 1024; // 300 MB
export const MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024;  // 20 MB

// Uploads arrive as base64 inside JSON, which is ~4/3 the file's size, plus
// a little room for the other fields. Applied only to the upload route —
// every other endpoint keeps the normal, much smaller body limit.
export const MEDIA_UPLOAD_BODY_LIMIT_BYTES = Math.ceil(MAX_VIDEO_UPLOAD_BYTES * 4 / 3) + 1024 * 1024;
