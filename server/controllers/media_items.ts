import { pb, ensurePBAuth } from '../db';
import crypto from 'crypto';

export async function uploadMediaItem(req: any, res: any) {
  try {
    const authenticated = await ensurePBAuth();
    if (!authenticated) {
      return res.status(503).json({ error: 'PocketBase admin authentication failed' });
    }

    const { type } = req.body;
    
    // Otherwise, we handle file upload
    const { fileData, fileName, mimeType } = req.body;
    if (!fileData || !fileName) {
      return res.status(400).json({ error: 'fileData and fileName are required for image/video upload' });
    }

    const fileBuffer = Buffer.from(fileData, 'base64');
    
    // Calculate SHA-256 checksum
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Pocketbase File Upload in Node.js
    const formData = new FormData();
    
    // Set text fields
    const fields = ['title', 'type', 'duration', 'resolution', 'fileSize', 'fileSizeBytes', 'uploadedBy', 'expiryDate', 'status'];
    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        formData.append(field, String(req.body[field]));
      }
    });
    
    if (req.body.id && /^[a-z0-9]{15}$/.test(req.body.id)) {
      formData.append('id', req.body.id);
    }
    
    if (req.body.tags) {
      formData.append('tags', typeof req.body.tags === 'string' ? req.body.tags : JSON.stringify(req.body.tags));
    }
    
    // Set metadata fields
    formData.append('width', String(req.body.width || 0));
    formData.append('height', String(req.body.height || 0));
    formData.append('mimeType', mimeType);
    formData.append('checksum', checksum);

    // Create a Blob from buffer to upload
    const fileBlob = new Blob([fileBuffer], { type: mimeType });
    formData.append('file', fileBlob, fileName);

    console.log(`Uploading file ${fileName} (${fileBuffer.length} bytes) to PocketBase...`);
    
    // Create record in Pocketbase
    const record = await pb.collection('media_items').create(formData);
    
    // Get absolute Pocketbase original file URL
    const fileUrl = `${pb.baseUrl}/api/files/media_items/${record.id}/${record.file}`;
    
    // Update thumbnail of record with absolute URL
    console.log(`Setting media item thumbnail/URL to: ${fileUrl}`);
    const updatedRecord = await pb.collection('media_items').update(record.id, {
      thumbnail: fileUrl
    });

    res.status(201).json(updatedRecord);
  } catch (error: any) {
    console.error('Error in uploadMediaItem:', error);
    res.status(500).json({ error: error.message || 'Error uploading media item' });
  }
}
