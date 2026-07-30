import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

// If no REDIS_URL is provided, we won't throw immediately, 
// to allow graceful fallback when the cache is accessed.
const redisUrl = process.env.REDIS_URL;

export const redis = redisUrl
  ? (globalForRedis.redis ??
      new Redis(redisUrl, {
        retryStrategy(times) {
          if (times > 3) return null;
          return Math.min(times * 50, 2000);
        },
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      }))
  : null;

if (process.env.NODE_ENV !== 'production' && redis) {
  globalForRedis.redis = redis;
}

