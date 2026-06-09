import express from 'express';
import { pairScreen } from '../controllers/screens';

const router = express.Router();

router.post('/pair', pairScreen);

export default router;
