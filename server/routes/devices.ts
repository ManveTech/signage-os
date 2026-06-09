import express from 'express';
import { syncDevice, recordHeartbeat } from '../controllers/screens';

const router = express.Router();

router.get('/sync', syncDevice);
router.post('/heartbeat', recordHeartbeat);

export default router;
