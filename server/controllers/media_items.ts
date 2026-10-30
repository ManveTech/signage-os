import { pb, ensurePBAuth } from '../db';
import {
  uploadToR2, deleteFromR2, getKeyFromUrl, isR2Enabled, presignR2Upload, headR2Object, publicUrlForKey,
  startR2MultipartUpload, completeR2MultipartUpload, abortR2MultipartUpload
} from '../r2';
import crypto from 'crypto';
import { MAX_VIDEO_UPLOAD_BYTES, MAX_IMAGE_UPLOAD_BYTES } from '../uploadLimits';

function isAdminUser(user: any): boolean {
  return user?.role === 'admin' || user?.role === 'super_admin';
}

// SVG is deliberately excluded — unlike raster formats it can carry an
// embedded <script>, which runs if the file is ever opened directly rather
// than rendered inside an <img>. Signage media never needs vector graphics.
const ALLOWED_MEDIA_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

/**
 * Files at least this big go up in pieces of PART_SIZE, several at once
 * (see startR2MultipartUpload). Smaller ones are a single PUT — for a few
 * MB the extra round trips would cost more than they save.
 */
const MULTIPART_MIN_BYTES = 16 * 1024 * 1024;
const PART_SIZE = 8 * 1024 * 1024;

/** Keys this server hands out for media; anything else is refused. */
const MEDIA_KEY = /^media\/\d{4}\/\d{2}\/[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/;

/**
 * Generate a unique R2 object key for a media file.
 * Format: media/<year>/<month>/<uuid>/<filename>
 */
function buildR2Key(fileName: string): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const uuid = crypto.randomUUID();
  // Sanitize filename
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `media/${year}/${month}/${uuid}/${safe}`;
}

/**
 * Bytes this uploader may still store, or null when they aren't capped.
 *
 * Pulled out of uploadMediaItem so the presign endpoint can turn an upload
 * down before the file is sent, rather than after it has already been put in
 * the bucket. Admins aren't plan-limited; nor is anyone with no active plan.
 */
async function remainingQuotaBytes(req: any): Promise<number | null> {
  if (isAdminUser(req.user)) return null;
  const uploaderEmail = req.body.uploadedBy;
  const licensesResult = await pb.collection('licenses').getList(1, 100, {
    filter: pb.filter('assignedUserEmail = {:email} && status = "active"', { email: uploaderEmail })
  }).catch(() => ({ items: [] as any[] }));

  const licenseItems: any[] = licensesResult.items;
  if (licenseItems.length === 0) return null;

  const storageLimitBytes = licenseItems.reduce((sum: number, lic: any) => sum + (lic.storageLimit || 0), 0) * 1024 * 1024 * 1024;
  const existingItems: any[] = await pb.collection('media_items').getFullList({
    filter: pb.filter('uploadedBy = {:email}', { email: uploaderEmail }),
    fields: 'fileSizeBytes'
  }).catch(() => [] as any[]);
  const currentUsageBytes = existingItems.reduce((sum: number, item: any) => sum + (item.fileSizeBytes || 0), 0);
  return storageLimitBytes - currentUsageBytes;
}

const quotaMessage = (remaining: number) =>
  `Storage limit reached. You have ${(Math.max(0, remaining) / (1024 * 1024 * 1024)).toFixed(2)}GB left on your plan.`;

/**
 * Hand back a short-lived URL the browser can PUT a file straight to R2.
 *
 * The alternative — base64 inside a JSON body — needed the whole file in
 * memory several times over and fell apart on a phone somewhere above 100 MB.
 * Here the bytes go browser → R2 and this server only writes the record
 * afterwards, so a 300 MB video costs it nothing but two small requests.
 *
 * Everything checkable before the bytes exist is checked here; the real size
 * is confirmed from the bucket in uploadMediaItem, because a client-reported
 * length can't be trusted and the signature can't pin it.
 */
export async function createMediaUploadUrl(req: any, res: any) {
  try {
    const authenticated = await ensurePBAuth();
    if (!authenticated) {
      return res.status(503).json({ error: 'PocketBase admin authentication failed' });
    }
    if (!isAdminUser(req.user) || !req.body.uploadedBy) {
      req.body.uploadedBy = req.user?.email;
    }

    // Without a bucket there is nowhere to PUT to. The dashboard reads this
    // code and falls back to sending the file through this server instead.
    if (!(await isR2Enabled())) {
      return res.status(409).json({ error: 'Direct upload is not available', code: 'direct_upload_unavailable' });
    }

    const { fileName, mimeType } = req.body;
    const fileSizeBytes = Number(req.body.fileSizeBytes) || 0;
    if (!fileName) return res.status(400).json({ error: 'fileName is required' });
    if (!ALLOWED_MEDIA_MIME_TYPES.has(mimeType)) {
      return res.status(400).json({ error: `Unsupported file type: ${mimeType || 'unknown'}. Only image and video files are allowed.` });
    }

    const maxBytes = mimeType.startsWith('video/') ? MAX_VIDEO_UPLOAD_BYTES : MAX_IMAGE_UPLOAD_BYTES;
    if (fileSizeBytes > maxBytes) {
      const limitMB = maxBytes / (1024 * 1024);
      return res.status(413).json({ error: `File too large. Maximum allowed size is ${limitMB}MB for ${mimeType.startsWith('video/') ? 'videos' : 'images'}.` });
    }

    const remaining = await remainingQuotaBytes(req);
    if (remaining !== null && fileSizeBytes > remaining) {
      return res.status(413).json({ error: quotaMessage(remaining) });
    }

    const key = buildR2Key(fileName);
    // Dashboards that can send pieces ask for them; older ones get one URL.
    if (req.body.multipart === true && fileSizeBytes >= MULTIPART_MIN_BYTES) {
      const partCount = Math.ceil(fileSizeBytes / PART_SIZE);
      // An hour, not 15 minutes: every piece is signed now, and the last
      // ones may only start well into a long upload on mobile data.
      const { uploadId, partUrls } = await startR2MultipartUpload(key, mimeType, partCount, 3600);
      return res.json({ key, mimeType, uploadId, partSize: PART_SIZE, partUrls, expiresIn: 3600 });
    }
    const uploadUrl = await presignR2Upload(key, mimeType);
    res.json({ uploadUrl, key, mimeType, expiresIn: 900 });
  } catch (error: any) {
    console.error('Error creating upload URL:', error);
    res.status(500).json({ error: error.message || 'Could not start the upload' });
  }
}

export async function uploadMediaItem(req: any, res: any) {
  try {
    const authenticated = await ensurePBAuth();
    if (!authenticated) {
      return res.status(503).json({ error: 'PocketBase admin authentication failed' });
    }

    // uploadedBy must come from the authenticated session, not the request
    // body — otherwise any client could upload media and attribute it to
    // another user's account. Admins may still upload on a client's behalf.
    if (!isAdminUser(req.user) || !req.body.uploadedBy) {
      req.body.uploadedBy = req.user?.email;
    }

    const { fileData, fileName, mimeType, r2Key } = req.body;

    // The file is already in the bucket — the browser PUT it there with a
    // presigned URL and we only have to record it. Everything below this
    // branch is the older base64-in-JSON path, which has to stay: a phone app
    // bundles its own copy of the dashboard, so installed versions go on
    // using it until they are updated.
    if (r2Key && !fileData) {
      return finishDirectUpload(req, res, String(r2Key));
    }

    if (!fileData || !fileName) {
      return res.status(400).json({ error: 'fileData and fileName are required for image/video upload' });
    }

    // The upload UI only offers image/* and video/*, but mimeType is a
    // client-reported field — without this check a caller could claim any
    // type (e.g. text/html) and have it stored and served back with that
    // same Content-Type from R2/PocketBase, which is what actually makes
    // spoofed content dangerous to open directly.
    if (!ALLOWED_MEDIA_MIME_TYPES.has(mimeType)) {
      return res.status(400).json({ error: `Unsupported file type: ${mimeType || 'unknown'}. Only image and video files are allowed.` });
    }

    const fileBuffer = Buffer.from(fileData, 'base64');

    // Validate file size (limits in server/uploadLimits.ts)
    const maxBytes = mimeType?.startsWith('video/') ? MAX_VIDEO_UPLOAD_BYTES : MAX_IMAGE_UPLOAD_BYTES;
    if (fileBuffer.length > maxBytes) {
      const limitMB = maxBytes / (1024 * 1024);
      return res.status(413).json({ error: `File too large. Maximum allowed size is ${limitMB}MB for ${mimeType?.startsWith('video/') ? 'videos' : 'images'}.` });
    }

    // Enforce the license's storage plan — a per-file size cap alone let a
    // customer upload unlimited files regardless of their plan's
    // storageLimit. Shared with the presigned path via remainingQuotaBytes.
    const remaining = await remainingQuotaBytes(req);
    if (remaining !== null && fileBuffer.length > remaining) {
      return res.status(413).json({ error: quotaMessage(remaining) });
    }

    // Calculate SHA-256 checksum
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    let fileUrl: string;

    if (await isR2Enabled()) {
      // Upload directly to Cloudflare R2 via AWS S3 SDK
      const key = buildR2Key(fileName);
      console.log(`Uploading ${fileName} (${fileBuffer.length} bytes) directly to R2 key: ${key}`);
      fileUrl = await uploadToR2(fileBuffer, key, mimeType);
      console.log(`R2 upload successful: ${fileUrl}`);
    } else {
      // Fallback: upload via PocketBase local storage
      console.log(`Uploading ${fileName} (${fileBuffer.length} bytes) to PocketBase local storage...`);
      const formData = new FormData();

      // fileSizeBytes is deliberately NOT copied from req.body here — it's
      // set below from the real decoded buffer length, since a client-
      // reported value could understate usage and let the storage-quota
      // check above be evaded on every subsequent upload.
      const fields = ['title', 'type', 'duration', 'resolution', 'fileSize', 'uploadedBy', 'expiryDate', 'status'];
      fields.forEach(field => {
        if (req.body[field] !== undefined) formData.append(field, String(req.body[field]));
      });

      if (req.body.id && /^[a-z0-9]{15}$/.test(req.body.id)) {
        formData.append('id', req.body.id);
      }
      if (req.body.tags) {
        formData.append('tags', typeof req.body.tags === 'string' ? req.body.tags : JSON.stringify(req.body.tags));
      }
      formData.append('width', String(req.body.width || 0));
      formData.append('height', String(req.body.height || 0));
      formData.append('mimeType', mimeType);
      formData.append('checksum', checksum);
      formData.append('fileSizeBytes', String(fileBuffer.length));

      const fileBlob = new File([fileBuffer], fileName, { type: mimeType });
      formData.append('file', fileBlob);

      const record = await pb.collection('media_items').create(formData);
      fileUrl = `${pb.baseUrl}/api/files/media_items/${record.id}/${record.file}`;

      // Update thumbnail URL on record
      const updatedRecord = await pb.collection('media_items').update(record.id, { thumbnail: fileUrl });
      return res.status(201).json(updatedRecord);
    }

    // For R2 path: create PocketBase record with the R2 URL (no file upload to PocketBase)
    const recordData: Record<string, any> = {
      thumbnail: fileUrl,
      fileUrl: fileUrl,
      mimeType: mimeType,
      checksum: checksum,
      width: req.body.width || 0,
      height: req.body.height || 0,
      // Real decoded byte length, not the client-reported value — see the
      // matching comment on the PocketBase-local-storage path above.
      fileSizeBytes: fileBuffer.length,
    };

    const fields = ['title', 'type', 'duration', 'resolution', 'fileSize', 'uploadedBy', 'expiryDate', 'status', 'tags'];
    fields.forEach(field => {
      if (req.body[field] !== undefined) recordData[field] = req.body[field];
    });

    if (req.body.id && /^[a-z0-9]{15}$/.test(req.body.id)) {
      recordData['id'] = req.body.id;
    }

    const record = await pb.collection('media_items').create(recordData);
    console.log(`PocketBase record created: ${record.id}`);

    res.status(201).json(record);
  } catch (error: any) {
    console.error('Error in uploadMediaItem:', error);
    res.status(500).json({ error: error.message || 'Error uploading media item' });
  }
}

/**
 * Writes the record for a file the browser already PUT to R2.
 *
 * The size and type are read back off the bucket rather than taken from the
 * request: this server never saw the bytes, so the request body is the one
 * thing here that a caller controls completely. An object that breaks a limit
 * is deleted again — otherwise a rejected upload would stay in the bucket,
 * billable and orphaned, with no record pointing at it.
 */
async function finishDirectUpload(req: any, res: any, key: string) {
  if (!MEDIA_KEY.test(key)) {
    return res.status(400).json({ error: "That upload didn't arrive — try again." });
  }
  // Sent in pieces: join them first.
  const uploadId = typeof req.body.r2UploadId === 'string' ? req.body.r2UploadId : '';
  if (uploadId) {
    try {
      const expected = Number(req.body.r2PartCount) || undefined;
      await completeR2MultipartUpload(key, uploadId, expected);
    } catch (err: any) {
      console.error(`[R2] Could not join upload ${key}:`, err?.message);
      await abortR2MultipartUpload(key, uploadId).catch(() => {});
      return res.status(400).json({ error: "That upload didn't fully arrive — try again." });
    }
  }
  const head = await headR2Object(key);
  if (!head) {
    return res.status(400).json({ error: "That upload didn't arrive — try again." });
  }

  const discard = async (status: number, error: string) => {
    await deleteFromR2(key).catch(err => console.warn(`[R2] Could not remove rejected upload ${key}:`, err?.message));
    return res.status(status).json({ error });
  };

  // Read the type off the stored object, and treat this check as load-bearing
  // rather than a second opinion: R2 does not enforce the Content-Type the URL
  // was signed with (verified — a PUT declaring text/html against a URL signed
  // for video/mp4 is accepted and stored as text/html). So presigning for an
  // allowed type does not guarantee an allowed type arrived. Anything that
  // would be served back as something other than an image or a video is
  // rejected here and deleted again.
  const mimeType = head.mimeType;
  if (!ALLOWED_MEDIA_MIME_TYPES.has(mimeType)) {
    return discard(400, `Unsupported file type: ${mimeType || 'unknown'}. Only image and video files are allowed.`);
  }

  const maxBytes = mimeType.startsWith('video/') ? MAX_VIDEO_UPLOAD_BYTES : MAX_IMAGE_UPLOAD_BYTES;
  if (head.size > maxBytes) {
    const limitMB = maxBytes / (1024 * 1024);
    return discard(413, `File too large. Maximum allowed size is ${limitMB}MB for ${mimeType.startsWith('video/') ? 'videos' : 'images'}.`);
  }

  const remaining = await remainingQuotaBytes(req);
  if (remaining !== null && head.size > remaining) {
    return discard(413, quotaMessage(remaining));
  }

  const fileUrl = await publicUrlForKey(key);
  const recordData: Record<string, any> = {
    thumbnail: fileUrl,
    fileUrl,
    mimeType,
    // No checksum: the TV verifies `checksum` as a SHA-256 of the file, and
    // this server never sees the bytes to make one. R2's ETag (an MD5, or
    // "md5-N" for a file sent in pieces) used to go here, so every directly
    // uploaded file failed the TV's check and never played.
    checksum: '',
    width: req.body.width || 0,
    height: req.body.height || 0,
    fileSizeBytes: head.size,
  };

  const fields = ['title', 'type', 'duration', 'resolution', 'fileSize', 'uploadedBy', 'expiryDate', 'status', 'tags'];
  fields.forEach(field => {
    if (req.body[field] !== undefined) recordData[field] = req.body[field];
  });
  if (req.body.id && /^[a-z0-9]{15}$/.test(req.body.id)) {
    recordData['id'] = req.body.id;
  }

  const record = await pb.collection('media_items').create(recordData);
  console.log(`Direct upload recorded: ${record.id} (${head.size} bytes at ${key})`);
  res.status(201).json(record);
}

/** A piece-by-piece upload was cancelled or failed: drop the pieces stored so far. */
export async function abortMediaUpload(req: any, res: any) {
  const key = String(req.body?.key || '');
  const uploadId = String(req.body?.uploadId || '');
  if (!MEDIA_KEY.test(key) || !uploadId) return res.status(400).json({ error: 'key and uploadId are required' });
  try {
    await abortR2MultipartUpload(key, uploadId);
  } catch (err: any) {
    console.warn(`[R2] Could not abort upload ${key}:`, err?.message);
  }
  res.json({ ok: true });
}

/** Deletes a media item's file from R2 (when it's there) and then the record. */
export async function removeMediaItem(record: any): Promise<void> {
  const urlToDelete = record.fileUrl || record.thumbnail;
  if (urlToDelete && await isR2Enabled()) {
    const key = await getKeyFromUrl(urlToDelete);
    if (!key) {
      // Not in the storage set up in Integrations (e.g. a different public
      // address) — the record goes, but the file can't be located to delete.
      console.warn(`[R2] Not deleting the file for media ${record.id}: ${urlToDelete} isn't under the storage's public URL.`);
    } else {
      await deleteFromR2(key).catch(err => console.warn(`[R2] R2 deletion failed for key ${key}:`, err.message));
    }
  }
  await pb.collection('media_items').delete(record.id);
}

export async function deleteMediaItem(req: any, res: any) {
  try {
    const authenticated = await ensurePBAuth();
    if (!authenticated) {
      return res.status(503).json({ error: 'PocketBase admin authentication failed' });
    }

    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Record ID is required' });

    // Fetch record to get file URL for R2 cleanup
    const record = await pb.collection('media_items').getOne(id);

    if (!isAdminUser(req.user) && record.uploadedBy !== req.user?.email) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await removeMediaItem(record);
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error in deleteMediaItem:', error);
    res.status(500).json({ error: error.message || 'Error deleting media item' });
  }
}
