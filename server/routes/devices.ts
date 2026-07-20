import express from 'express';
import { recordHeartbeat, getPairingCode, reportOffline, clearScreenCommand } from '../controllers/screens';

const router = express.Router();

router.post('/heartbeat', recordHeartbeat);
router.post('/pairing-code', getPairingCode);
router.post('/offline', reportOffline);
router.post('/clear-command', clearScreenCommand);

export default router;
