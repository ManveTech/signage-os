import Redis from 'ioredis';
import dotenv from 'dotenv';
import net from 'net';
import os from 'os';
import fs from 'fs';
import { spawn } from 'child_process';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Initialize Redis client. Suppress crashing if Redis is not locally running by catching errors on event listeners.
export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  showFriendlyErrorStack: true,
  retryStrategy(times) {
    // Retry indefinitely, backing off up to 3 seconds
    return Math.min(times * 200, 3000);
  }
});

let isRedisConnected = false;

redis.on('connect', async () => {
  isRedisConnected = true;
  console.log('[Redis] Successfully connected to Redis.');
  
  // Dynamically set maxmemory to 5% of RAM on connection to ensure the running instance is capped
  try {
    const totalMem = os.totalmem();
    const maxMemory = Math.floor(totalMem * 0.05);
    const maxMemoryMb = Math.floor(maxMemory / (1024 * 1024));
    
    await redis.config('SET', 'maxmemory', maxMemory.toString());
    await redis.config('SET', 'maxmemory-policy', 'allkeys-lru');
    console.log(`[Redis Config] Capped running instance maxmemory to 5% of system RAM (${maxMemoryMb} MB).`);
  } catch (err: any) {
    console.warn('[Redis Config] Failed to set maxmemory config on connect:', err.message);
  }
});

redis.on('error', (err) => {
  isRedisConnected = false;
  console.warn('[Redis] Connection error/offline:', err.message);
});

// Check if Redis is alive
export function isRedisReady(): boolean {
  return isRedisConnected;
}

let redisHost = '127.0.0.1';
let redisPort = 6379;
try {
  const parsed = new URL(REDIS_URL);
  redisHost = parsed.hostname || '127.0.0.1';
  redisPort = parsed.port ? parseInt(parsed.port, 10) : 6379;
} catch (e) {
  const match = REDIS_URL.match(/redis:\/\/([^:]+)(?::(\d+))?/);
  if (match) {
    redisHost = match[1];
    if (match[2]) {
      redisPort = parseInt(match[2], 10);
    }
  }
}

function checkRedisPort(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function startRedisServer(): Promise<void> {
  const totalMem = os.totalmem();
  const maxMemory = Math.floor(totalMem * 0.05);
  
  // Look for our compiled binary first
  let redisBin = '/home/manve/projects/signage-os/redis-local/redis-stable/src/redis-server';
  if (!fs.existsSync(redisBin)) {
    redisBin = 'redis-server'; // fallback to global
  }

  console.log(`[Redis Boot] Starting Redis using binary: ${redisBin}`);
  console.log(`[Redis Boot] Capping memory to 5% of system RAM: ${Math.floor(maxMemory / (1024 * 1024))} MB (${maxMemory} bytes)`);

  const child = spawn(redisBin, [
    '--port', redisPort.toString(),
    '--maxmemory', maxMemory.toString(),
    '--maxmemory-policy', 'allkeys-lru'
  ], {
    detached: true,
    stdio: 'ignore'
  });

  child.unref();

  // Wait for Redis to start listening (up to 5 seconds)
  for (let i = 0; i < 25; i++) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (await checkRedisPort(redisHost, redisPort)) {
      console.log(`[Redis Boot] Redis started successfully and is listening on port ${redisPort}.`);
      return;
    }
  }
  throw new Error('Failed to start Redis server or verify it is listening.');
}

export async function ensureRedisRunning(): Promise<void> {
  const isPortOpen = await checkRedisPort(redisHost, redisPort);
  if (isPortOpen) {
    console.log(`[Redis Boot] Redis port ${redisPort} on ${redisHost} is already open. Connection will proceed.`);
    return;
  }

  // Only attempt to start a local Redis server if configured to localhost/127.0.0.1
  const isLocal = redisHost === '127.0.0.1' || redisHost === 'localhost';
  if (!isLocal) {
    console.log(`[Redis Boot] Redis is configured to remote host ${redisHost}:${redisPort}. Skipping local server startup.`);
    return;
  }

  console.log(`[Redis Boot] Redis port ${redisPort} is closed. Attempting to start local Redis server...`);
  await startRedisServer();
}

/**
 * Acquire a distributed lock for a specific resource.
 * @param resource Name of the resource
 * @param ttlMs Time-to-live in milliseconds
 * @returns A unique token string if lock acquired, null otherwise
 */
export async function acquireLock(resource: string, ttlMs: number): Promise<string | null> {
  if (!isRedisConnected) return null;
  try {
    const lockKey = `lock:${resource}`;
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const result = await redis.set(lockKey, token, 'PX', ttlMs, 'NX');
    return result === 'OK' ? token : null;
  } catch (err: any) {
    console.error(`[Redis Lock] Error acquiring lock for ${resource}:`, err.message);
    return null;
  }
}

/**
 * Release a distributed lock safely using a Lua script to ensure atomic verification of ownership.
 * @param resource Name of the resource
 * @param token Unique token returned during acquisition
 * @returns true if lock was deleted, false otherwise
 */
export async function releaseLock(resource: string, token: string): Promise<boolean> {
  if (!isRedisConnected) return false;
  try {
    const lockKey = `lock:${resource}`;
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await redis.eval(luaScript, 1, lockKey, token);
    return result === 1;
  } catch (err: any) {
    console.error(`[Redis Lock] Error releasing lock for ${resource}:`, err.message);
    return false;
  }
}
