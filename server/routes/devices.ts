import express from 'express';
import { syncDevice, recordHeartbeat, getPairingCode } from '../controllers/screens';

const router = express.Router();

router.get('/sync', syncDevice);
router.post('/heartbeat', recordHeartbeat);
router.post('/pairing-code', getPairingCode);

export default router;
