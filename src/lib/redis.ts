import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

// If no REDIS_URL is provided, we won't throw immediately, 
// to allow graceful fallback when the cache is accessed.
const redisUrl = process.env.REDIS_URL || '';

export const redis =
  globalForRedis.redis ??
  new Redis(redisUrl, {
    // Retry strategy for graceful degradation
    retryStrategy(times) {
      // Don't retry more than 3 times to avoid hanging the app
      if (times > 3) {
        return null; // Stop retrying
      }
      return Math.min(times * 50, 2000);
    },
    maxRetriesPerRequest: 1,
    lazyConnect: true, // Only connect when needed
  });

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}
