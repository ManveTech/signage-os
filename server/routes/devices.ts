import express from 'express';
import { recordHeartbeat, getPairingCode, reportOffline } from '../controllers/screens';

const router = express.Router();

router.post('/heartbeat', recordHeartbeat);
router.post('/pairing-code', getPairingCode);
router.post('/offline', reportOffline);

export default router;
