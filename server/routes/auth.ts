import express from 'express';
import { login, forgotPassword, resetPassword } from '../controllers/auth';

const router = express.Router();
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
