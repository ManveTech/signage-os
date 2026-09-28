import { pb, ensurePBAuth } from '../db';
import { uploadToR2, deleteFromR2, getKeyFromUrl, isR2Enabled } from '../r2';
import crypto from 'crypto';

function isAdminUser(user: any): boolean {
  return user?.role === 'admin' || user?.role === 'super_admin';
}

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

    const { fileData, fileName, mimeType } = req.body;
    if (!fileData || !fileName) {
      return res.status(400).json({ error: 'fileData and fileName are required for image/video upload' });
    }

    const fileBuffer = Buffer.from(fileData, 'base64');

    // Validate file size (50 MB max for video, 5 MB for images)
    const maxBytes = mimeType?.startsWith('video/') ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    if (fileBuffer.length > maxBytes) {
      const limitMB = maxBytes / (1024 * 1024);
      return res.status(413).json({ error: `File too large. Maximum allowed size is ${limitMB}MB for ${mimeType?.startsWith('video/') ? 'videos' : 'images'}.` });
    }

    // Enforce the license's storage plan — previously this only capped a
    // single file's size, so a customer could upload unlimited files
    // indefinitely regardless of their plan's storageLimit (the dashboard
    // only ever compared usage to the limit for its own progress-bar
    // display, never to block an upload). Admins aren't plan-limited.
    if (!isAdminUser(req.user)) {
      const uploaderEmail = req.body.uploadedBy;
      const licensesResult = await pb.collection('licenses').getList(1, 100, {
        filter: pb.filter('assignedUserEmail = {:email} && status = "active"', { email: uploaderEmail })
      }).catch(() => ({ items: [] as any[] }));

      const licenseItems: any[] = licensesResult.items;
      if (licenseItems.length > 0) {
        const storageLimitBytes = licenseItems.reduce((sum: number, lic: any) => sum + (lic.storageLimit || 0), 0) * 1024 * 1024 * 1024;
        const existingItems: any[] = await pb.collection('media_items').getFullList({
          filter: pb.filter('uploadedBy = {:email}', { email: uploaderEmail }),
          fields: 'fileSizeBytes'
        }).catch(() => [] as any[]);
        const currentUsageBytes = existingItems.reduce((sum: number, item: any) => sum + (item.fileSizeBytes || 0), 0);

        if (currentUsageBytes + fileBuffer.length > storageLimitBytes) {
          const limitGB = (storageLimitBytes / (1024 * 1024 * 1024)).toFixed(1);
          const usedGB = (currentUsageBytes / (1024 * 1024 * 1024)).toFixed(2);
          return res.status(413).json({ error: `Storage limit reached. Your plan allows ${limitGB}GB and you've already used ${usedGB}GB.` });
        }
      }
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

    // Delete from R2 if applicable
    const urlToDelete = record.fileUrl || record.thumbnail;
    if (urlToDelete && await isR2Enabled()) {
      const key = await getKeyFromUrl(urlToDelete);
      if (key) {
        console.log(`[R2] Deleting object key: ${key}`);
        await deleteFromR2(key).then(() => {
          console.log(`[R2] Successfully deleted object key: ${key}`);
        }).catch(err => {
          console.warn(`[R2] R2 deletion failed for key ${key}:`, err.message);
        });
      }
    }

    await pb.collection('media_items').delete(id);
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error in deleteMediaItem:', error);
    res.status(500).json({ error: error.message || 'Error deleting media item' });
  }
}
