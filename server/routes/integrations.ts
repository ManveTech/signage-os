import express from 'express';
import { listIntegrations, updateIntegration, testIntegrationConnection } from '../controllers/integrations';

const router = express.Router();

router.get('/', listIntegrations);
router.put('/:type', updateIntegration);
router.post('/:type/test', testIntegrationConnection);

export default router;
