import express from 'express';
import { 
  createOrder, 
  verifyPayment, 
  handleWebhook,
  getRazorpayConfig,
  saveRazorpayConfig,
  getPaymentHistory
} from '../controllers/payments';
import { createCrudRouter } from '../controllers/crud';

const router = express.Router();

router.get('/config', getRazorpayConfig);
router.post('/config', saveRazorpayConfig);
router.get('/history', getPaymentHistory);
router.post('/create-order', createOrder);
router.post('/verify', verifyPayment);
router.post('/webhook', handleWebhook);

// Mount CRUD router for generic list/get/create/update/delete operations on payments collection (e.g. GET /)
router.use('/', createCrudRouter('payments'));

export default router;
