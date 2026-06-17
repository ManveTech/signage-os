import express from 'express';
import { pairScreen, reconnectScreen, assignPlaylistToScreen } from '../controllers/screens';

const router = express.Router();

router.post('/pair', pairScreen);
router.post('/reconnect', reconnectScreen);
router.put('/:screenId/assign-playlist', assignPlaylistToScreen);

export default router;
