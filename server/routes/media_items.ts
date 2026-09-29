import express from 'express';
import { uploadMediaItem, deleteMediaItem } from '../controllers/media_items';
import { createCrudRouter } from '../controllers/crud';
import { uploadLimiter } from '../middleware/rateLimiter';

const router = express.Router();

// Custom upload interceptor — uploadLimiter existed in rateLimiter.ts (20/hour)
// but was never actually wired to this route, so uploads only ever got the
// generic 100-req/min API limit instead of the intended per-hour cap.
router.post('/', uploadLimiter, uploadMediaItem);

// Custom delete interceptor (cleans up R2 object before removing PocketBase record)
router.delete('/:id', deleteMediaItem);

// Fallback to standard CRUD actions (GET, PATCH, etc.)
router.use(createCrudRouter('media_items'));

export default router;
