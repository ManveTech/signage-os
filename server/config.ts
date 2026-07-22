import dotenv from 'dotenv';
dotenv.config();

const isDev = process.env.NODE_ENV !== 'production';

// In production these MUST be set via environment variables.
// Hardcoded fallbacks are only active in development to ease local setup.
function requireEnv(key: string, devFallback: string): string {
  const val = process.env[key];
  if (val) return val.trim();
  if (isDev) {
    console.warn(`[Config] WARNING: ${key} not set — using dev fallback. Set it in .env for production.`);
    return devFallback;
  }
  throw new Error(`[Config] FATAL: Required env var ${key} is not set. Server cannot start in production without it.`);
}

export const PORT = process.env.PORT || 5000;
export const JWT_SECRET = requireEnv('JWT_SECRET', 'signageos_dev_jwt_secret_CHANGE_IN_PRODUCTION');
export const PB_ADMIN_EMAIL = requireEnv('PB_ADMIN_EMAIL', 'anand@gmail.com');
export const PB_ADMIN_PASSWORD = requireEnv('PB_ADMIN_PASSWORD', 'demo@123');
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

// Cloudflare R2 / S3 Storage Configuration
export const S3_ENABLED = (process.env.S3_ENABLED || '').trim() === 'true' || Boolean((process.env.S3_BUCKET || '').trim() && (process.env.S3_ACCESS_KEY || '').trim());
export const S3_BUCKET = (process.env.S3_BUCKET || '').trim();
export const S3_REGION = (process.env.S3_REGION || '').trim() || 'auto';
export const S3_ENDPOINT = (process.env.S3_ENDPOINT || '').trim();
export const S3_ACCESS_KEY = (process.env.S3_ACCESS_KEY || '').trim();
export const S3_SECRET = (process.env.S3_SECRET || '').trim();


