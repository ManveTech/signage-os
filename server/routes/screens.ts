import express from 'express';
import { pairScreen, reconnectScreen, assignPlaylistToScreen, disconnectScreen } from '../controllers/screens';

const router = express.Router();

router.post('/pair', pairScreen);
router.post('/reconnect', reconnectScreen);
router.post('/disconnect', disconnectScreen);
router.put('/:screenId/assign-playlist', assignPlaylistToScreen);

export default router;
