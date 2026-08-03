import rateLimit from 'express-rate-limit';
import { isRedisReady, redis } from '../redis';

/**
 * Redis store for rate limiting (optional - falls back to in-memory if Redis unavailable)
 */
class RedisStore {
  prefix: string;

  constructor(prefix = 'rl:') {
    this.prefix = prefix;
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const redisKey = `${this.prefix}${key}`;
    const now = Date.now();
    const windowMs = 60000; // 1 minute window

    if (!isRedisReady()) {
      // Fallback to simple counter if Redis not available
      return {
        totalHits: 1,
        resetTime: new Date(now + windowMs)
      };
    }

    try {
      // Increment counter with expiry
      const hits = await redis.incr(redisKey);

      // Set expiry on first hit
      if (hits === 1) {
        await redis.pexpire(redisKey, windowMs);
      }

      const ttl = await redis.pttl(redisKey);
      const resetTime = new Date(now + (ttl > 0 ? ttl : windowMs));

      return {
        totalHits: hits,
        resetTime
      };
    } catch (error) {
      console.error('Redis rate limit error:', error);
      // Fallback on error
      return {
        totalHits: 1,
        resetTime: new Date(now + windowMs)
      };
    }
  }

  async decrement(key: string): Promise<void> {
    if (!isRedisReady()) return;

    const redisKey = `${this.prefix}${key}`;
    try {
      await redis.decr(redisKey);
    } catch (error) {
      console.error('Redis rate limit decrement error:', error);
    }
  }

  async resetKey(key: string): Promise<void> {
    if (!isRedisReady()) return;

    const redisKey = `${this.prefix}${key}`;
    try {
      await redis.del(redisKey);
    } catch (error) {
      console.error('Redis rate limit reset error:', error);
    }
  }
}

/**
 * General API rate limiter - 100 requests per minute per IP
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 60
  },
  // Use Redis store if available
  ...(isRedisReady() ? { store: new RedisStore('api:') as any } : {})
});

/**
 * Strict rate limiter for authentication endpoints - 5 requests per 15 minutes
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  message: {
    error: 'Too many authentication attempts from this IP, please try again later.',
    retryAfter: 900
  },
  ...(isRedisReady() ? { store: new RedisStore('auth:') as any } : {})
});

/**
 * Media upload rate limiter - 20 uploads per hour
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Upload limit exceeded. Please try again later.',
    retryAfter: 3600
  },
  ...(isRedisReady() ? { store: new RedisStore('upload:') as any } : {})
});

/**
 * Payment rate limiter - 10 payment attempts per hour
 */
export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Payment request limit exceeded. Please contact support.',
    retryAfter: 3600
  },
  ...(isRedisReady() ? { store: new RedisStore('payment:') as any } : {})
});

/**
 * Device sync rate limiter - More lenient for device heartbeats
 */
export const deviceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Device sync rate limit exceeded.',
    retryAfter: 60
  },
  keyGenerator: (req) => {
    // Use device ID or screen ID if available, otherwise IP
    return req.headers['x-screen-id'] || req.ip;
  },
  ...(isRedisReady() ? { store: new RedisStore('device:') as any } : {})
});
