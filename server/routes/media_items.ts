import express from 'express';
import { uploadMediaItem, deleteMediaItem } from '../controllers/media_items';
import { createCrudRouter } from '../controllers/crud';

const router = express.Router();

// Custom upload interceptor
router.post('/', uploadMediaItem);

// Custom delete interceptor (cleans up R2 object before removing PocketBase record)
router.delete('/:id', deleteMediaItem);

// Fallback to standard CRUD actions (GET, PATCH, etc.)
router.use(createCrudRouter('media_items'));

export default router;
