/**
 * StorageManager - Unified localStorage abstraction layer
 *
 * Provides:
 * - Type-safe get/set operations
 * - Schema validation
 * - Unified error handling
 * - Cache invalidation
 * - Version control support
 */

export interface StorageSchema {
  // Wallet keys
  wallet_mnemonic: string;
  wallet_address: string;
  wallet_is_guest: string;

  // Order processing keys
  auto_processing: string;
  swap_orders: string;

  // Cache keys
  token_details_cache: string;
  token_supply_cache: string;
  token_stats_cache: string;
  token_stats_summary_cache: string;

  // UI preferences
  filter_option: string;
  custom_tokens: string;
  promotional_dialog: string;
}

export type StorageKey = keyof StorageSchema;

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  version?: string; // Version prefix for cache invalidation
}

export interface CachedData<T> {
  data: T;
  timestamp: number;
  version?: string;
}

class StorageManager {
  private static instance: StorageManager;
  private memoryCache: Map<string, any> = new Map();
  private readonly VERSION_PREFIX = 'v1_';

  private constructor() {}

  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  /**
   * Check if localStorage is available
   */
  private isAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const test = '__storage_test__';
      window.localStorage.setItem(test, test);
      window.localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Get prefixed key with version
   */
  private getPrefixedKey(key: string, version?: string): string {
    const prefix = version || this.VERSION_PREFIX;
    return `${prefix}${key}`;
  }

  /**
   * Get item from localStorage with type safety
   */
  get<T = string>(key: StorageKey, options?: CacheOptions): T | null {
    if (!this.isAvailable()) return null;

    try {
      const storageKey = options?.version
        ? this.getPrefixedKey(key, options.version)
        : key;

      const value = window.localStorage.getItem(storageKey);
      if (value === null) return null;

      // Check memory cache first for performance
      const cacheKey = `${storageKey}_parsed`;
      if (this.memoryCache.has(cacheKey)) {
        return this.memoryCache.get(cacheKey) as T;
      }

      // Handle empty string marker
      if (value === '""') {
        this.memoryCache.set(cacheKey, '');
        return '' as T;
      }

      // Try to parse as JSON, fallback to string
      try {
        const parsed = JSON.parse(value) as T;
        this.memoryCache.set(cacheKey, parsed);
        return parsed;
      } catch {
        // Not JSON, return as string
        return value as T;
      }
    } catch (error) {
      console.error(`StorageManager.get error for key "${key}":`, error);
      return null;
    }
  }

  /**
   * Get cached data with TTL validation
   */
  getCached<T>(key: StorageKey, options?: CacheOptions): T | null {
    const cached = this.get<CachedData<T>>(key, options);
    if (!cached) return null;

    // Validate structure
    if (typeof cached !== 'object' || !('data' in cached) || !('timestamp' in cached)) {
      return null;
    }

    // Check TTL
    if (options?.ttl) {
      const now = Date.now();
      if (now - cached.timestamp > options.ttl) {
        this.remove(key, options);
        return null;
      }
    }

    // Check version
    if (options?.version && cached.version !== options.version) {
      this.remove(key, options);
      return null;
    }

    return cached.data;
  }

  /**
   * Set item in localStorage with type safety
   */
  set<T>(key: StorageKey, value: T, options?: CacheOptions): boolean {
    if (!this.isAvailable()) return false;

    try {
      const storageKey = options?.version
        ? this.getPrefixedKey(key, options.version)
        : key;

      let stringValue: string;
      if (typeof value === 'string') {
        // For empty strings, store a special marker to distinguish from null
        stringValue = value === '' ? '""' : value;
      } else {
        stringValue = JSON.stringify(value);
      }

      window.localStorage.setItem(storageKey, stringValue);

      // Update memory cache
      const cacheKey = `${storageKey}_parsed`;
      this.memoryCache.set(cacheKey, value);

      return true;
    } catch (error) {
      // Handle quota exceeded error
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.error('localStorage quota exceeded');
        this.clearOldCaches();
        // Retry once after clearing
        try {
          const storageKey = options?.version
            ? this.getPrefixedKey(key, options.version)
            : key;
          const stringValue = typeof value === 'string'
            ? value
            : JSON.stringify(value);
          window.localStorage.setItem(storageKey, stringValue);
          return true;
        } catch (retryError) {
          console.error(`StorageManager.set retry failed for key "${key}":`, retryError);
          return false;
        }
      }
      console.error(`StorageManager.set error for key "${key}":`, error);
      return false;
    }
  }

  /**
   * Set cached data with timestamp and version
   */
  setCached<T>(key: StorageKey, data: T, options?: CacheOptions): boolean {
    const cached: CachedData<T> = {
      data,
      timestamp: Date.now(),
      version: options?.version,
    };
    return this.set(key, cached, options);
  }

  /**
   * Remove item from localStorage
   */
  remove(key: StorageKey, options?: CacheOptions): boolean {
    if (!this.isAvailable()) return false;

    try {
      const storageKey = options?.version
        ? this.getPrefixedKey(key, options.version)
        : key;

      window.localStorage.removeItem(storageKey);

      // Clear memory cache
      const cacheKey = `${storageKey}_parsed`;
      this.memoryCache.delete(cacheKey);

      return true;
    } catch (error) {
      console.error(`StorageManager.remove error for key "${key}":`, error);
      return false;
    }
  }

  /**
   * Clear all items from localStorage
   */
  clear(): boolean {
    if (!this.isAvailable()) return false;

    try {
      window.localStorage.clear();
      this.memoryCache.clear();
      return true;
    } catch (error) {
      console.error('StorageManager.clear error:', error);
      return false;
    }
  }

  /**
   * Clear old cache entries to free up space
   */
  clearOldCaches(): void {
    if (!this.isAvailable()) return;

    const cacheKeys = [
      'token_details_cache',
      'token_supply_cache',
      'token_stats_cache',
      'token_stats_summary_cache',
    ];

    cacheKeys.forEach(key => {
      try {
        window.localStorage.removeItem(key);
      } catch (error) {
        console.error(`Failed to clear cache key "${key}":`, error);
      }
    });

    this.memoryCache.clear();
  }

  /**
   * Clear cache entries by prefix
   */
  clearByPrefix(prefix: string): void {
    if (!this.isAvailable()) return;

    try {
      // Get keys from the actual storage object, not Object.keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }

      // Remove the keys
      keysToRemove.forEach(key => {
        window.localStorage.removeItem(key);
        this.memoryCache.delete(`${key}_parsed`);
      });
    } catch (error) {
      console.error(`StorageManager.clearByPrefix error for prefix "${prefix}":`, error);
    }
  }

  /**
   * Get all keys in localStorage
   */
  getAllKeys(): string[] {
    if (!this.isAvailable()) return [];

    try {
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key) keys.push(key);
      }
      return keys;
    } catch (error) {
      console.error('StorageManager.getAllKeys error:', error);
      return [];
    }
  }

  /**
   * Check if key exists
   */
  has(key: StorageKey, options?: CacheOptions): boolean {
    if (!this.isAvailable()) return false;

    const storageKey = options?.version
      ? this.getPrefixedKey(key, options.version)
      : key;

    return window.localStorage.getItem(storageKey) !== null;
  }

  /**
   * Get storage size estimate in bytes
   */
  getStorageSize(): number {
    if (!this.isAvailable()) return 0;

    try {
      let size = 0;
      for (const key in window.localStorage) {
        if (window.localStorage.hasOwnProperty(key)) {
          const value = window.localStorage.getItem(key);
          size += key.length + (value?.length || 0);
        }
      }
      return size;
    } catch (error) {
      console.error('StorageManager.getStorageSize error:', error);
      return 0;
    }
  }

  /**
   * Clear memory cache only (keep localStorage intact)
   */
  clearMemoryCache(): void {
    this.memoryCache.clear();
  }
}

// Export singleton instance
export const storageManager = StorageManager.getInstance();
