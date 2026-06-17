import { pb, ensurePBAuth } from '../db';
import { uploadToR2, deleteFromR2, getKeyFromUrl } from '../r2';
import crypto from 'crypto';
import { S3_ENABLED } from '../config';

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

    // Calculate SHA-256 checksum
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    let fileUrl: string;

    if (S3_ENABLED) {
      // Upload directly to Cloudflare R2 via AWS S3 SDK
      const key = buildR2Key(fileName);
      console.log(`Uploading ${fileName} (${fileBuffer.length} bytes) directly to R2 key: ${key}`);
      fileUrl = await uploadToR2(fileBuffer, key, mimeType);
      console.log(`R2 upload successful: ${fileUrl}`);
    } else {
      // Fallback: upload via PocketBase local storage
      console.log(`Uploading ${fileName} (${fileBuffer.length} bytes) to PocketBase local storage...`);
      const formData = new FormData();

      const fields = ['title', 'type', 'duration', 'resolution', 'fileSize', 'fileSizeBytes', 'uploadedBy', 'expiryDate', 'status'];
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

      const fileBlob = new Blob([fileBuffer], { type: mimeType });
      formData.append('file', fileBlob, fileName);

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
    };

    const fields = ['title', 'type', 'duration', 'resolution', 'fileSize', 'fileSizeBytes', 'uploadedBy', 'expiryDate', 'status', 'tags'];
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

    // Delete from R2 if applicable
    const urlToDelete = record.fileUrl || record.thumbnail;
    if (S3_ENABLED && urlToDelete) {
      const key = getKeyFromUrl(urlToDelete);
      if (key) {
        console.log(`Deleting R2 object: ${key}`);
        await deleteFromR2(key).catch(err => {
          console.warn('R2 delete failed (non-fatal):', err.message);
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
