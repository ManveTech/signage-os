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
import { paymentLimiter } from '../middleware/rateLimiter';

const router = express.Router();

router.get('/config', getRazorpayConfig);
router.post('/config', saveRazorpayConfig);
router.get('/history', getPaymentHistory);
// paymentLimiter existed in rateLimiter.ts (10/hour) but was never actually
// wired to these routes, so creating/verifying a payment only ever got the
// generic 100-req/min API limit. webhook is deliberately excluded — it's
// called by Razorpay's own servers (verified via X-Razorpay-Signature, see
// auth.ts's bypass list), and rate-limiting it risks dropping legitimate
// webhook retries.
router.post('/create-order', paymentLimiter, createOrder);
router.post('/verify', paymentLimiter, verifyPayment);
router.post('/webhook', handleWebhook);

// Mount CRUD router for generic list/get/create/update/delete operations on payments collection (e.g. GET /)
router.use('/', createCrudRouter('payments'));

export default router;
