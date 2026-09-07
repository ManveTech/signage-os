import express from 'express';
import { recordHeartbeat, getPairingCode, reportOffline, clearScreenCommand, getScreenStatusForDevice } from '../controllers/screens';
import { deviceLimiter } from '../middleware/rateLimiter';

const router = express.Router();

// Keyed by screen ID rather than IP — many devices can sit behind the same
// NAT/IP, and the generic per-IP apiLimiter would otherwise throttle them
// as if they were one caller.
router.use(deviceLimiter);

router.post('/heartbeat', recordHeartbeat);
router.post('/pairing-code', getPairingCode);
router.post('/offline', reportOffline);
router.post('/clear-command', clearScreenCommand);
router.post('/sync', getScreenStatusForDevice);

export default router;
