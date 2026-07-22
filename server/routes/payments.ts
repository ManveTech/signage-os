import express from 'express';
import { 
  createOrder, 
  verifyPayment, 
  handleWebhook,
  getRazorpayConfig,
  saveRazorpayConfig,
  getPaymentHistory
} from '../controllers/payments';

const router = express.Router();

router.get('/config', getRazorpayConfig);
router.post('/config', saveRazorpayConfig);
router.get('/history', getPaymentHistory);
router.post('/create-order', createOrder);
router.post('/verify', verifyPayment);
router.post('/webhook', handleWebhook);

export default router;
