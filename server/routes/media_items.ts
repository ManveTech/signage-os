import express from 'express';
import { uploadMediaItem } from '../controllers/media_items';
import { createCrudRouter } from '../controllers/crud';

const router = express.Router();

// Custom upload interceptor
router.post('/', uploadMediaItem);

// Fallback to standard CRUD actions
router.use(createCrudRouter('media_items'));

export default router;
