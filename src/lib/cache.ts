interface CacheEntry<T> {
  data: T
  expiry: number
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>()

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiry) {
      this.cache.delete(key)
      return null
    }
    return entry.data as T
  }

  set<T>(key: string, data: T, ttlMs: number = 60 * 1000): void {
    this.cache.set(key, { data, expiry: Date.now() + ttlMs })
  }

  invalidate(key: string): void {
    this.cache.delete(key)
  }

  invalidatePattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key)
      }
    }
  }

  clear(): void {
    this.cache.clear()
  }
}

export const cache = new MemoryCache()
