import rateLimit from 'express-rate-limit';
import { isRedisReady, redis } from '../redis';

/**
 * Redis store for rate limiting, with an in-process fallback so a Redis outage
 * degrades this to a per-instance limiter instead of disabling limiting
 * entirely. windowMs comes from each limiter's own config via init() — it
 * used to be hardcoded to 60s here, which silently reset the 15-minute auth
 * limiter and hour-long upload/payment limiters every 60 seconds whenever
 * Redis was reachable.
 */
class RedisStore {
  prefix: string;
  private windowMs = 60000;
  private memoryFallback = new Map<string, { count: number; resetAt: number }>();

  constructor(prefix = 'rl:') {
    this.prefix = prefix;
  }

  init(options: { windowMs: number }): void {
    this.windowMs = options.windowMs;
  }

  private incrementMemoryFallback(redisKey: string): { totalHits: number; resetTime: Date } {
    const now = Date.now();
    const existing = this.memoryFallback.get(redisKey);
    if (!existing || existing.resetAt <= now) {
      const resetAt = now + this.windowMs;
      this.memoryFallback.set(redisKey, { count: 1, resetAt });
      return { totalHits: 1, resetTime: new Date(resetAt) };
    }
    existing.count += 1;
    return { totalHits: existing.count, resetTime: new Date(existing.resetAt) };
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const redisKey = `${this.prefix}${key}`;

    if (!isRedisReady()) {
      return this.incrementMemoryFallback(redisKey);
    }

    try {
      // Increment counter with expiry
      const hits = await redis.incr(redisKey);

      // Set expiry on first hit, using this limiter's actual configured window
      if (hits === 1) {
        await redis.pexpire(redisKey, this.windowMs);
      }

      const ttl = await redis.pttl(redisKey);
      const resetTime = new Date(Date.now() + (ttl > 0 ? ttl : this.windowMs));

      return {
        totalHits: hits,
        resetTime
      };
    } catch (error) {
      console.error('Redis rate limit error:', error);
      // Redis errored mid-request — fall back to an in-process counter instead
      // of reporting "1 hit" forever, which would disable this limiter
      // platform-wide until the process restarts.
      return this.incrementMemoryFallback(redisKey);
    }
  }

  async decrement(key: string): Promise<void> {
    const redisKey = `${this.prefix}${key}`;

    if (!isRedisReady()) {
      const existing = this.memoryFallback.get(redisKey);
      if (existing && existing.count > 0) existing.count -= 1;
      return;
    }

    try {
      await redis.decr(redisKey);
    } catch (error) {
      console.error('Redis rate limit decrement error:', error);
    }
  }

  async resetKey(key: string): Promise<void> {
    const redisKey = `${this.prefix}${key}`;
    this.memoryFallback.delete(redisKey);

    if (!isRedisReady()) return;

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
    return (req.headers['x-screen-id'] as string) || req.ip || '127.0.0.1';
  },
  ...(isRedisReady() ? { store: new RedisStore('device:') as any } : {})
});
