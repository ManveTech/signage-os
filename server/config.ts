import dotenv from 'dotenv';
dotenv.config();

export const PORT = process.env.PORT || 5000;
export const JWT_SECRET = process.env.JWT_SECRET || 'signageos_jwt_secret_key_987654321_abcdef';
export const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || 'anand@gmail.com';
export const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || 'demo@123';
export const PB_URL = process.env.POCKETBASE_URL || 'https://demo.manve.co';

// SMTP Configuration
export const SMTP_HOST = process.env.SMTP_HOST || 'smtp.mailtrap.io';
export const SMTP_PORT = parseInt(process.env.SMTP_PORT || '2525', 10);
export const SMTP_USERNAME = process.env.SMTP_USERNAME || '';
export const SMTP_PASSWORD = process.env.SMTP_PASSWORD || '';
export const SMTP_SENDER_EMAIL = process.env.SMTP_SENDER_EMAIL || 'noreply@signageos.com';
export const SMTP_SENDER_NAME = process.env.SMTP_SENDER_NAME || 'SignageOS Admin';

// Razorpay Configuration
export const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_live_demo83920194';
export const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

