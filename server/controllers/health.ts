import { pb } from '../db';
import { isRedisReady, redis } from '../redis';
import { getCloudflareConfig } from '../integrationsStore';
import { testR2Connection } from '../r2';

interface HealthStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  latency?: number;
  details?: any;
}

/**
 * Check PocketBase database connection
 */
async function checkPocketBase(): Promise<HealthStatus> {
  const start = Date.now();
  try {
    // Simple health check: fetch collection list
    await pb.collections.getList(1, 1);
    const latency = Date.now() - start;

    return {
      service: 'pocketbase',
      status: 'healthy',
      latency,
      details: {
        authenticated: pb.authStore.isValid,
        url: pb.baseUrl
      }
    };
  } catch (error: any) {
    return {
      service: 'pocketbase',
      status: 'unhealthy',
      message: error.message || 'Connection failed',
      latency: Date.now() - start
    };
  }
}

/**
 * Check Redis connection
 */
async function checkRedis(): Promise<HealthStatus> {
  if (!isRedisReady()) {
    return {
      service: 'redis',
      status: 'unhealthy',
      message: 'Redis client not initialized'
    };
  }

  const start = Date.now();
  try {
    const pong = await redis.ping();
    const latency = Date.now() - start;

    return {
      service: 'redis',
      status: pong === 'PONG' ? 'healthy' : 'degraded',
      latency,
      details: {
        response: pong
      }
    };
  } catch (error: any) {
    return {
      service: 'redis',
      status: 'unhealthy',
      message: error.message || 'Connection failed',
      latency: Date.now() - start
    };
  }
}

/**
 * Check S3/R2 storage connection (if enabled)
 */
async function checkS3(): Promise<HealthStatus> {
  // Reflects whichever config is actually in effect right now — the
  // Admin > Integrations dashboard's saved Cloudflare config when enabled,
  // otherwise the .env fallback. See integrationsStore.getCloudflareConfig().
  const cfg = await getCloudflareConfig();
  if (!cfg.enabled) {
    return {
      service: 's3',
      status: 'healthy',
      message: 'S3 storage not enabled (using PocketBase storage)'
    };
  }

  if (!cfg.bucket || !cfg.endpoint || !cfg.accessKeyId || !cfg.secretAccessKey) {
    return {
      service: 's3',
      status: 'degraded',
      message: 'S3 enabled but configuration incomplete'
    };
  }

  const start = Date.now();
  const result = await testR2Connection(cfg);
  const latency = Date.now() - start;

  if (result.ok) {
    return {
      service: 's3',
      status: 'healthy',
      latency,
      details: {
        bucket: cfg.bucket,
        endpoint: cfg.endpoint
      }
    };
  }
  return {
    service: 's3',
    status: 'unhealthy',
    message: result.error || 'Connection failed',
    latency
  };
}

/**
 * Comprehensive health check endpoint
 */
export async function healthCheck(req: any, res: any) {
  const start = Date.now();

  // Run all health checks in parallel
  const [pocketbaseHealth, redisHealth, s3Health] = await Promise.all([
    checkPocketBase(),
    checkRedis(),
    checkS3()
  ]);

  const services = [pocketbaseHealth, redisHealth, s3Health];

  // Determine overall status
  const hasUnhealthy = services.some(s => s.status === 'unhealthy');
  const hasDegraded = services.some(s => s.status === 'degraded');

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  if (hasUnhealthy) {
    overallStatus = 'unhealthy';
  } else if (hasDegraded) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'healthy';
  }

  const totalLatency = Date.now() - start;

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    latency: totalLatency,
    services,
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  };

  // Return appropriate HTTP status code
  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

  res.status(statusCode).json(response);
}

/**
 * Readiness probe - checks if app is ready to accept traffic
 */
export async function readinessCheck(req: any, res: any) {
  try {
    // Check critical dependencies only
    const pocketbaseHealth = await checkPocketBase();

    if (pocketbaseHealth.status === 'unhealthy') {
      return res.status(503).json({
        ready: false,
        message: 'Database not available',
        details: pocketbaseHealth
      });
    }

    res.status(200).json({
      ready: true,
      message: 'Service is ready'
    });
  } catch (error: any) {
    res.status(503).json({
      ready: false,
      message: error.message || 'Service not ready'
    });
  }
}

/**
 * Liveness probe - checks if app is running
 */
export async function livenessCheck(req: any, res: any) {
  // Simple check - if this endpoint responds, the app is alive
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
}
