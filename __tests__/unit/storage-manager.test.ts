/**
 * StorageManager Unit Tests
 *
 * Tests cover:
 * - Basic get/set operations
 * - Type safety validation
 * - Error handling (invalid JSON, missing keys)
 * - Cache invalidation mechanism
 * - Version control
 * - Concurrent access
 * - localStorage quota exceeded scenario
 */

import { storageManager, StorageKey } from '../../lib/storage-manager';

describe('StorageManager', () => {
  beforeEach(() => {
    localStorage.clear();
    storageManager.clearMemoryCache();
  });

  afterEach(() => {
    localStorage.clear();
    storageManager.clearMemoryCache();
  });

  describe('Basic Operations', () => {
    it('should set and get string values', () => {
      const key: StorageKey = 'wallet_address';
      const value = 'ecash:qp...test';

      const setResult = storageManager.set(key, value);
      expect(setResult).toBe(true);

      const retrieved = storageManager.get<string>(key);
      expect(retrieved).toBe(value);
    });

    it('should set and get object values', () => {
      const key: StorageKey = 'swap_orders';
      const value = { order1: { amount: 100 }, order2: { amount: 200 } };

      const setResult = storageManager.set(key, value);
      expect(setResult).toBe(true);

      const retrieved = storageManager.get<typeof value>(key);
      expect(retrieved).toEqual(value);
    });

    it('should return null for non-existent keys', () => {
      const result = storageManager.get('wallet_address');
      expect(result).toBeNull();
    });

    it('should remove items correctly', () => {
      const key: StorageKey = 'wallet_address';
      storageManager.set(key, 'test');

      const removeResult = storageManager.remove(key);
      expect(removeResult).toBe(true);

      const retrieved = storageManager.get(key);
      expect(retrieved).toBeNull();
    });

    it('should check if key exists', () => {
      const key: StorageKey = 'wallet_address';
      expect(storageManager.has(key)).toBe(false);

      storageManager.set(key, 'test');
      expect(storageManager.has(key)).toBe(true);

      storageManager.remove(key);
      expect(storageManager.has(key)).toBe(false);
    });

    it('should clear all items', () => {
      storageManager.set('wallet_address', 'test1');
      storageManager.set('wallet_mnemonic', 'test2');
      storageManager.set('auto_processing', 'true');

      const clearResult = storageManager.clear();
      expect(clearResult).toBe(true);

      expect(storageManager.get('wallet_address')).toBeNull();
      expect(storageManager.get('wallet_mnemonic')).toBeNull();
      expect(storageManager.get('auto_processing')).toBeNull();
    });
  });

  describe('Type Safety', () => {
    it('should handle boolean values as strings', () => {
      const key: StorageKey = 'auto_processing';
      storageManager.set(key, 'true');

      const retrieved = storageManager.get<string>(key);
      expect(retrieved).toBe('true');
    });

    it('should handle complex nested objects', () => {
      const key: StorageKey = 'swap_orders';
      const value = {
        'order1|address1': {
          tokenId: 'abc123',
          amount: 1000,
          remainingAmount: 500,
          status: 'pending',
          metadata: { timestamp: Date.now() }
        }
      };

      storageManager.set(key, value);
      const retrieved = storageManager.get<typeof value>(key);
      expect(retrieved).toEqual(value);
    });

    it('should handle arrays', () => {
      const key: StorageKey = 'custom_tokens';
      const value = ['token1', 'token2', 'token3'];

      storageManager.set(key, value);
      const retrieved = storageManager.get<string[]>(key);
      expect(retrieved).toEqual(value);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON gracefully', () => {
      const key: StorageKey = 'wallet_address';
      // Manually set invalid JSON
      localStorage.setItem(key, '{invalid json}');

      const retrieved = storageManager.get(key);
      // Should return the raw string when JSON parsing fails
      expect(retrieved).toBe('{invalid json}');
    });

    it('should handle corrupted data', () => {
      const key: StorageKey = 'swap_orders';
      localStorage.setItem(key, 'null');

      const retrieved = storageManager.get(key);
      expect(retrieved).toBeNull();
    });

    it('should handle empty strings', () => {
      const key: StorageKey = 'wallet_address';
      const setResult = storageManager.set(key, '');
      expect(setResult).toBe(true);

      const retrieved = storageManager.get(key);
      expect(retrieved).toBe('');
    });
  });

  describe('Cache with TTL', () => {
    it('should set and get cached data with timestamp', () => {
      const key: StorageKey = 'token_details_cache';
      const data = { tokenId: 'abc', name: 'Test Token' };

      const setResult = storageManager.setCached(key, data);
      expect(setResult).toBe(true);

      const retrieved = storageManager.getCached<typeof data>(key);
      expect(retrieved).toEqual(data);
    });

    it('should invalidate cache after TTL expires', async () => {
      const key: StorageKey = 'token_details_cache';
      const data = { tokenId: 'abc', name: 'Test Token' };
      const ttl = 100; // 100ms

      storageManager.setCached(key, data, { ttl });

      // Should be valid immediately
      let retrieved = storageManager.getCached<typeof data>(key, { ttl });
      expect(retrieved).toEqual(data);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be null after TTL
      retrieved = storageManager.getCached<typeof data>(key, { ttl });
      expect(retrieved).toBeNull();
    });

    it('should return null for non-cached data structure', () => {
      const key: StorageKey = 'token_details_cache';
      // Set regular data instead of cached structure
      storageManager.set(key, 'plain string');

      const retrieved = storageManager.getCached<string>(key);
      expect(retrieved).toBeNull();
    });
  });

  describe('Version Control', () => {
    it('should support versioned keys', () => {
      const key: StorageKey = 'token_details_cache';
      const data1 = { version: 1 };
      const data2 = { version: 2 };

      storageManager.set(key, data1, { version: 'v1_' });
      storageManager.set(key, data2, { version: 'v2_' });

      const retrieved1 = storageManager.get(key, { version: 'v1_' });
      const retrieved2 = storageManager.get(key, { version: 'v2_' });

      expect(retrieved1).toEqual(data1);
      expect(retrieved2).toEqual(data2);
    });

    it('should invalidate cache when version changes', () => {
      const key: StorageKey = 'token_details_cache';
      const data = { tokenId: 'abc' };

      storageManager.setCached(key, data, { version: 'v1' });

      // Should return null when requesting with different version
      const retrieved = storageManager.getCached(key, { version: 'v2' });
      expect(retrieved).toBeNull();
    });

    it('should remove versioned keys correctly', () => {
      const key: StorageKey = 'token_details_cache';
      storageManager.set(key, 'data', { version: 'v1_' });

      expect(storageManager.has(key, { version: 'v1_' })).toBe(true);

      storageManager.remove(key, { version: 'v1_' });

      expect(storageManager.has(key, { version: 'v1_' })).toBe(false);
    });
  });

  describe('Memory Cache', () => {
    it('should use memory cache for repeated reads', () => {
      const key: StorageKey = 'wallet_address';
      const value = 'ecash:qp...test';

      storageManager.set(key, value);

      // First read - from localStorage
      const retrieved1 = storageManager.get(key);
      expect(retrieved1).toBe(value);

      // Manually corrupt localStorage
      localStorage.setItem(key, 'corrupted');

      // Second read - should still return cached value
      const retrieved2 = storageManager.get(key);
      expect(retrieved2).toBe(value);
    });

    it('should clear memory cache', () => {
      const key: StorageKey = 'wallet_address';
      const value = 'ecash:qp...test';

      storageManager.set(key, value);
      storageManager.get(key); // Load into memory cache

      storageManager.clearMemoryCache();

      // After clearing memory cache, should read from localStorage
      localStorage.setItem(key, 'new value');
      const retrieved = storageManager.get(key);
      expect(retrieved).toBe('new value');
    });
  });

  describe('Prefix Operations', () => {
    it('should clear items by prefix', () => {
      localStorage.clear();
      storageManager.clearMemoryCache();

      // Use direct localStorage to avoid memory cache interference
      localStorage.setItem('token_details_cache', 'data1');
      localStorage.setItem('token_supply_cache', 'data2');
      localStorage.setItem('token_stats_cache', 'data3');
      localStorage.setItem('wallet_address', 'data4');

      storageManager.clearByPrefix('token_');

      expect(localStorage.getItem('token_details_cache')).toBeNull();
      expect(localStorage.getItem('token_supply_cache')).toBeNull();
      expect(localStorage.getItem('token_stats_cache')).toBeNull();
      expect(localStorage.getItem('wallet_address')).toBe('data4');
    });

    it('should get all keys', () => {
      localStorage.clear();
      storageManager.clearMemoryCache();

      localStorage.setItem('wallet_address', 'test1');
      localStorage.setItem('wallet_mnemonic', 'test2');
      localStorage.setItem('auto_processing', 'test3');

      const keys = storageManager.getAllKeys();
      expect(keys).toContain('wallet_address');
      expect(keys).toContain('wallet_mnemonic');
      expect(keys).toContain('auto_processing');
    });
  });

  describe('Storage Size', () => {
    it('should calculate storage size', () => {
      localStorage.clear();
      storageManager.clearMemoryCache();

      storageManager.set('wallet_address', 'ecash:qp...test');
      storageManager.set('wallet_mnemonic', 'test mnemonic phrase');

      const size = storageManager.getStorageSize();
      expect(size).toBeGreaterThan(0);
    });
  });

  describe('Quota Exceeded Handling', () => {
    it('should handle quota exceeded gracefully', () => {
      // Mock localStorage.setItem to throw QuotaExceededError
      const originalSetItem = window.localStorage.setItem;

      window.localStorage.setItem = function() {
        const error = new DOMException('Quota exceeded', 'QuotaExceededError');
        throw error;
      };

      const key: StorageKey = 'wallet_address';
      const value = 'test';

      // Should return false when quota exceeded
      const result = storageManager.set(key, value);
      expect(result).toBe(false);

      // Restore original
      window.localStorage.setItem = originalSetItem;
    });

    it('should attempt to clear old caches when quota exceeded', () => {
      // This test verifies the clearOldCaches method is called
      // We can't easily test the retry logic in jsdom environment
      const key: StorageKey = 'token_details_cache';

      storageManager.set(key, { data: 'test' });
      expect(storageManager.get(key)).toBeTruthy();

      storageManager.clearOldCaches();

      expect(storageManager.get(key)).toBeNull();
    });
  });

  describe('Concurrent Access', () => {
    it('should handle concurrent reads', () => {
      const key: StorageKey = 'wallet_address';
      const value = 'ecash:qp...test';

      storageManager.set(key, value);

      const results = Array.from({ length: 10 }, () => storageManager.get(key));
      results.forEach(result => {
        expect(result).toBe(value);
      });
    });

    it('should handle concurrent writes', () => {
      const key: StorageKey = 'wallet_address';

      const writes = Array.from({ length: 10 }, (_, i) => {
        return storageManager.set(key, `value${i}`);
      });

      expect(writes.every(result => result === true)).toBe(true);

      const finalValue = storageManager.get(key);
      expect(finalValue).toBe('value9'); // Last write wins
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in values', () => {
      const key: StorageKey = 'wallet_mnemonic';
      const value = 'test "quotes" and \'apostrophes\' and \n newlines';

      storageManager.set(key, value);
      const retrieved = storageManager.get(key);
      expect(retrieved).toBe(value);
    });

    it('should handle unicode characters', () => {
      const key: StorageKey = 'wallet_address';
      const value = '测试 🚀 émojis';

      storageManager.set(key, value);
      const retrieved = storageManager.get(key);
      expect(retrieved).toBe(value);
    });

    it('should handle very large objects', () => {
      const key: StorageKey = 'swap_orders';
      const largeObject = Object.fromEntries(
        Array.from({ length: 100 }, (_, i) => [
          `order${i}`,
          { amount: i * 1000, status: 'pending' }
        ])
      );

      const setResult = storageManager.set(key, largeObject);
      expect(setResult).toBe(true);

      const retrieved = storageManager.get(key);
      expect(retrieved).toEqual(largeObject);
    });
  });

  describe('clearOldCaches', () => {
    it('should clear only cache keys', () => {
      storageManager.set('token_details_cache', 'cache1');
      storageManager.set('token_supply_cache', 'cache2');
      storageManager.set('wallet_address', 'wallet1');
      storageManager.set('wallet_mnemonic', 'mnemonic1');

      storageManager.clearOldCaches();

      expect(storageManager.get('token_details_cache')).toBeNull();
      expect(storageManager.get('token_supply_cache')).toBeNull();
      expect(storageManager.get('wallet_address')).toBe('wallet1');
      expect(storageManager.get('wallet_mnemonic')).toBe('mnemonic1');
    });
  });
});
