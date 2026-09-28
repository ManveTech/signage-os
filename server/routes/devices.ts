import express from 'express';
import { recordHeartbeat, getPairingCode, reportOffline, getScreenStatusForDevice } from '../controllers/screens';
import { deviceLimiter } from '../middleware/rateLimiter';

const router = express.Router();

// Keyed by screen ID rather than IP — many devices can sit behind the same
// NAT/IP, and the generic per-IP apiLimiter would otherwise throttle them
// as if they were one caller.
router.use(deviceLimiter);

router.post('/heartbeat', recordHeartbeat);
router.post('/pairing-code', getPairingCode);
router.post('/offline', reportOffline);
router.post('/sync', getScreenStatusForDevice);
// NOTE: '/clear-command' (clearScreenCommand in controllers/screens.ts) was
// removed — it was unauthenticated, trusted a caller-supplied screenId with
// no ownership check, and the TV app never actually called it (it clears its
// own clear_cache/force_sync/restart_playlist flags via a direct PocketBase
// PATCH instead). Dead code that was also a live cross-tenant write hole.

export default router;
