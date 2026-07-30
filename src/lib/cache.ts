import { unstable_cache, revalidateTag } from 'next/cache';
import { redis } from './redis';

/**
 * Interface to support both Next.js Data Cache tags and Redis Keys
 */
export interface CacheConfig {
  key: string;       // Unique Redis Key
  tags: string[];    // Next.js Cache Tags
  revalidate: number; // TTL in seconds
}

/**
 * Fetches data using a dual-layer caching strategy:
 * 1. Next.js App Router Data Cache (in-memory / file system / edge)
 * 2. Redis (Application Cache Layer)
 * 3. PostgreSQL Database (Single Source of Truth)
 */
export async function getCachedData<T>(
  config: CacheConfig,
  fetcher: () => Promise<T>
): Promise<T> {
  const layeredFetcher = async () => {
    try {
      // 1. Try fetching from Redis
      if (process.env.REDIS_URL && redis) {
        const cached = await redis.get(config.key);
        if (cached) {
          return JSON.parse(cached) as T;
        }
      }
    } catch (e) {
      console.warn(`[Redis Cache Miss/Error] Key: ${config.key}`, e);
    }

    // 2. Cache miss or Redis unavailable, fallback to Database
    const freshData = await fetcher();

    // 3. Save to Redis in the background (fire-and-forget) to not block the request
    if (process.env.REDIS_URL && redis) {
      redis.set(config.key, JSON.stringify(freshData), 'EX', config.revalidate).catch((e) => {
        console.warn(`[Redis Cache Set Error] Key: ${config.key}`, e);
      });
    }

    return freshData;
  };

  // Wrap the entire layered fetcher in Next.js internal caching mechanism
  return unstable_cache(layeredFetcher, [config.key], { 
    tags: config.tags, 
    revalidate: config.revalidate 
  })();
}

/**
 * Invalidates both Redis and Next.js internal caches for given keys and tags.
 * This should ONLY be called AFTER a successful database transaction.
 */
export async function invalidateCache(keys: string[], tags: string[]) {
  try {
    // 1. Invalidate Redis Application Cache
    if (process.env.REDIS_URL && redis && keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (e) {
    console.error(`[Redis Invalidate Error] Keys: ${keys.join(', ')}`, e);
  }

  // 2. Invalidate Next.js Data Cache
  for (const tag of tags) {
    // @ts-ignore - Next.js 15 canary typing issue
    revalidateTag(tag);
  }
}
