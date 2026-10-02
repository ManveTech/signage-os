import express from 'express';
import { pairScreen, reconnectScreen, assignPlaylistToScreen, disconnectScreen, pingScreen, unlinkScreen } from '../controllers/screens';

const router = express.Router();

router.post('/pair', pairScreen);
router.post('/reconnect', reconnectScreen);
router.post('/disconnect', disconnectScreen);
router.put('/:screenId/assign-playlist', assignPlaylistToScreen);
router.post('/:screenId/ping', pingScreen);
router.post('/:screenId/unlink', unlinkScreen);

export default router;
