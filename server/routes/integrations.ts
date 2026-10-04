import express from 'express';
import { listIntegrations, updateIntegration, testIntegrationConnection, sendTestEmail, getMediaMigration, startMediaMigration } from '../controllers/integrations';

const router = express.Router();

router.get('/', listIntegrations);
router.post('/smtp/send-test', sendTestEmail);
router.get('/cloudflare/migration', getMediaMigration);
router.post('/cloudflare/migration', startMediaMigration);
router.put('/:type', updateIntegration);
router.post('/:type/test', testIntegrationConnection);

export default router;
