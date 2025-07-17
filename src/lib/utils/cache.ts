/**
 * A simple in-memory cache with expiration
 */
export class Cache {
  private cache: Map<string, { value: any; expiry: number }> = new Map();
  
  /**
   * Set a value in the cache with an optional expiration time
   * 
   * @param key The cache key
   * @param value The value to store
   * @param ttlSeconds Time to live in seconds (default: 5 minutes)
   */
  set(key: string, value: any, ttlSeconds: number = 300): void {
    const expiry = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expiry });
  }
  
  /**
   * Get a value from the cache
   * 
   * @param key The cache key
   * @returns The cached value or undefined if not found or expired
   */
  get<T>(key: string): T | undefined {
    const item = this.cache.get(key);
    
    // Return undefined if item doesn't exist or has expired
    if (!item || Date.now() > item.expiry) {
      if (item) {
        // Clean up expired item
        this.cache.delete(key);
      }
      return undefined;
    }
    
    return item.value as T;
  }
  
  /**
   * Remove a value from the cache
   * 
   * @param key The cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  /**
   * Clear all items from the cache
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get a value from the cache, or compute and cache it if not present
   * 
   * @param key The cache key
   * @param fn Function to compute the value if not in cache
   * @param ttlSeconds Time to live in seconds
   * @returns The cached or computed value
   */
  async getOrSet<T>(key: string, fn: () => Promise<T>, ttlSeconds: number = 300): Promise<T> {
    const cachedValue = this.get<T>(key);
    if (cachedValue !== undefined) {
      return cachedValue;
    }
    
    const value = await fn();
    this.set(key, value, ttlSeconds);
    return value;
  }
}

// Export a singleton instance
export const cache = new Cache();