/**
 * Generic per-key async-result cache with a time-to-live. Useful for caching
 * expensive per-org (or any other key) lookups — settings, feature flags,
 * external tokens, licence claims, etc — without hitting the source on every call.
 */
export class HuemulTtlCache<T> {
  private data = new Map<string, {value: T; cachedAt: Date}>();

  constructor(private ttlSeconds: number) {}

  /**
   * Returns the cached value for key if it's still within ttlSeconds; otherwise
   * calls fetch(), caches the result, and returns it.
   * @param {string} key cache key
   * @param {Function} fetch called only on a cache miss/expiry
   * @return {Promise<T>}
   */
  async getOrFetch(key: string, fetch: () => Promise<T>): Promise<T> {
    const cached = this.data.get(key);
    if (cached && (Date.now() - cached.cachedAt.getTime()) / 1000 <= this.ttlSeconds) {
      return cached.value;
    }

    const value = await fetch();
    this.data.set(key, {value, cachedAt: new Date()});

    return value;
  }

  /**
   * Removes a single key from the cache, forcing the next getOrFetch to refetch it.
   * @param {string} key cache key
   * @return {void}
   */
  invalidate(key: string): void {
    this.data.delete(key);
  }

  /**
   * Removes every entry from the cache.
   * @return {void}
   */
  clear(): void {
    this.data.clear();
  }
}
