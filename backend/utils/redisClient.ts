// lib/redis.ts (or wherever you keep it)
import { NextFunction } from 'express';
import { createClient } from 'redis';

let redisClient: ReturnType<typeof createClient> | null = null;
let isConnecting = false;

export async function getRedisClient() {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  if (isConnecting) {
    // Wait a bit if another request is already connecting
    await new Promise(resolve => setTimeout(resolve, 100));
    return getRedisClient();
  }

  isConnecting = true;

  try {
    redisClient = createClient({
      url: process.env.REDIS_URL!,
      // Add your full config here if needed
      socket: {
        connectTimeout: 10000,
        timeout: 5000,
        rejectUnauthorized: true
      }
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });
;
    redisClient.on('reconnecting', () => console.log('Redis reconnecting...'));

    await redisClient.connect();
    console.log('Redis connected');
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
    redisClient = null;
    throw err;
  } finally {
    isConnecting = false;
  }

  return redisClient;
}


export async function redisMiddleware(req: any, res: Response, next: NextFunction) {
  if (!redisClient) {
    redisClient = await getRedisClient();
  }
  req.redis = redisClient; // attach to request object
  next();
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (redisClient?.isOpen) {
    await redisClient.quit();
  }
});