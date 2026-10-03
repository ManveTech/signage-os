import express from 'express';
import { listIntegrations, updateIntegration, testIntegrationConnection, sendTestEmail } from '../controllers/integrations';

const router = express.Router();

router.get('/', listIntegrations);
router.post('/smtp/send-test', sendTestEmail);
router.put('/:type', updateIntegration);
router.post('/:type/test', testIntegrationConnection);

export default router;
