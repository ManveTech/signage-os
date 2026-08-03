import express from 'express';
import { login, forgotPassword, resetPassword, logout } from '../controllers/auth';
import { validateBody } from '../middleware/validation';
import { loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../validation/schemas';
import { authLimiter } from '../middleware/rateLimiter';

const router = express.Router();

// Apply strict rate limiting to authentication endpoints
router.post('/login', authLimiter, validateBody(loginSchema), login);
router.post('/forgot-password', authLimiter, validateBody(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', authLimiter, validateBody(resetPasswordSchema), resetPassword);
router.post('/logout', logout);

export default router;
