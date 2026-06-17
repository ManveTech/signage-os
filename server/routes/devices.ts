import express from 'express';
import { recordHeartbeat, getPairingCode } from '../controllers/screens';

const router = express.Router();

router.post('/heartbeat', recordHeartbeat);
router.post('/pairing-code', getPairingCode);

export default router;
