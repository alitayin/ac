/**
 * Storage Migration Integration Tests
 *
 * Tests data migration scenarios:
 * - Backward compatibility with existing localStorage data
 * - Migration from direct localStorage to StorageManager
 * - Data integrity during migration
 * - Handling of corrupted legacy data
 */

import { storageManager, StorageKey } from '../../lib/storage-manager';

describe('Storage Migration', () => {
  beforeEach(() => {
    localStorage.clear();
    storageManager.clearMemoryCache();
  });

  afterEach(() => {
    localStorage.clear();
    storageManager.clearMemoryCache();
  });

  describe('Backward Compatibility', () => {
    it('should read legacy wallet data', () => {
      // Simulate legacy data written directly to localStorage
      localStorage.setItem('wallet_address', 'ecash:qp...legacy');
      localStorage.setItem('wallet_mnemonic', 'legacy mnemonic phrase');
      localStorage.setItem('wallet_is_guest', 'false');

      // StorageManager should read it correctly
      expect(storageManager.get('wallet_address')).toBe('ecash:qp...legacy');
      expect(storageManager.get('wallet_mnemonic')).toBe('legacy mnemonic phrase');
      // Note: 'false' string will be parsed as boolean false by JSON.parse
      expect(storageManager.get('wallet_is_guest')).toBe(false);
    });

    it('should read legacy swap_orders data', () => {
      const legacyOrders = {
        'order1|address1': {
          tokenId: 'abc123',
          amount: 1000,
          remainingAmount: 500,
          status: 'pending'
        }
      };

      localStorage.setItem('swap_orders', JSON.stringify(legacyOrders));

      const retrieved = storageManager.get<typeof legacyOrders>('swap_orders');
      expect(retrieved).toEqual(legacyOrders);
    });

    it('should read legacy auto_processing boolean string', () => {
      localStorage.setItem('auto_processing', 'true');

      const retrieved = storageManager.get<string | boolean>('auto_processing');
      // 'true' string will be parsed as boolean true
      expect(retrieved).toBe(true);
    });

    it('should read legacy cache data', () => {
      const legacyCache = {
        'token123': {
          name: 'Test Token',
          symbol: 'TEST',
          decimals: 2
        }
      };

      localStorage.setItem('token_details_cache', JSON.stringify(legacyCache));

      const retrieved = storageManager.get<typeof legacyCache>('token_details_cache');
      expect(retrieved).toEqual(legacyCache);
    });
  });

  describe('Migration from Direct Access', () => {
    it('should migrate wallet data to StorageManager', () => {
      // Legacy write
      localStorage.setItem('wallet_address', 'ecash:qp...test');
      localStorage.setItem('wallet_mnemonic', 'test mnemonic');

      // Read with StorageManager
      const address = storageManager.get('wallet_address');
      const mnemonic = storageManager.get('wallet_mnemonic');

      expect(address).toBe('ecash:qp...test');
      expect(mnemonic).toBe('test mnemonic');

      // Update with StorageManager
      storageManager.set('wallet_address', 'ecash:qp...updated');

      // Verify update
      expect(storageManager.get('wallet_address')).toBe('ecash:qp...updated');
      expect(localStorage.getItem('wallet_address')).toBe('ecash:qp...updated');
    });

    it('should migrate complex order data', () => {
      const legacyOrders = {
        'order1|addr1': { amount: 100, status: 'pending' },
        'order2|addr2': { amount: 200, status: 'completed' }
      };

      // Legacy write
      localStorage.setItem('swap_orders', JSON.stringify(legacyOrders));

      // Read with StorageManager
      const orders = storageManager.get<typeof legacyOrders>('swap_orders');
      expect(orders).toEqual(legacyOrders);

      // Update with StorageManager
      const updatedOrders = {
        ...legacyOrders,
        'order3|addr3': { amount: 300, status: 'pending' }
      };
      storageManager.set('swap_orders', updatedOrders);

      // Verify
      const retrieved = storageManager.get<typeof updatedOrders>('swap_orders');
      expect(retrieved).toEqual(updatedOrders);
    });
  });

  describe('Data Integrity', () => {
    it('should preserve data types during migration', () => {
      // Set various data types
      localStorage.setItem('wallet_address', 'string value');
      localStorage.setItem('auto_processing', 'true');
      localStorage.setItem('swap_orders', JSON.stringify({ key: 'value' }));
      localStorage.setItem('custom_tokens', JSON.stringify(['token1', 'token2']));

      // Read with StorageManager
      expect(storageManager.get('wallet_address')).toBe('string value');
      // 'true' string will be parsed as boolean
      expect(storageManager.get('auto_processing')).toBe(true);
      expect(storageManager.get('swap_orders')).toEqual({ key: 'value' });
      expect(storageManager.get('custom_tokens')).toEqual(['token1', 'token2']);
    });

    it('should handle mixed legacy and new data', () => {
      // Legacy data
      localStorage.setItem('wallet_address', 'legacy_address');

      // New data via StorageManager
      storageManager.set('wallet_mnemonic', 'new_mnemonic');

      // Both should be accessible
      expect(storageManager.get('wallet_address')).toBe('legacy_address');
      expect(storageManager.get('wallet_mnemonic')).toBe('new_mnemonic');
    });

    it('should maintain data consistency across updates', () => {
      const orders = {
        'order1|addr1': { amount: 100, remainingAmount: 50 }
      };

      // Initial write
      storageManager.set('swap_orders', orders);

      // Update
      const updatedOrders = {
        ...orders,
        'order1|addr1': { amount: 100, remainingAmount: 25 }
      };
      storageManager.set('swap_orders', updatedOrders);

      // Verify
      const retrieved = storageManager.get<typeof updatedOrders>('swap_orders');
      expect(retrieved).toEqual(updatedOrders);
      expect(retrieved?.['order1|addr1'].remainingAmount).toBe(25);
    });
  });

  describe('Corrupted Legacy Data', () => {
    it('should handle corrupted JSON gracefully', () => {
      localStorage.setItem('swap_orders', '{invalid json}');

      const retrieved = storageManager.get('swap_orders');
      // Should return the raw string when JSON parsing fails
      expect(retrieved).toBe('{invalid json}');
    });

    it('should handle null values', () => {
      localStorage.setItem('wallet_address', 'null');

      const retrieved = storageManager.get('wallet_address');
      expect(retrieved).toBeNull();
    });

    it('should handle undefined values', () => {
      localStorage.setItem('wallet_address', 'undefined');

      const retrieved = storageManager.get('wallet_address');
      expect(retrieved).toBe('undefined');
    });

    it('should handle empty objects', () => {
      localStorage.setItem('swap_orders', '{}');

      const retrieved = storageManager.get('swap_orders');
      expect(retrieved).toEqual({});
    });

    it('should handle empty arrays', () => {
      localStorage.setItem('custom_tokens', '[]');

      const retrieved = storageManager.get('custom_tokens');
      expect(retrieved).toEqual([]);
    });
  });

  describe('Cache Migration', () => {
    it('should migrate legacy cache to new format with TTL', () => {
      const legacyCache = {
        'token123': { name: 'Token', decimals: 2 }
      };

      localStorage.setItem('token_details_cache', JSON.stringify(legacyCache));

      // Read legacy cache
      const legacy = storageManager.get<typeof legacyCache>('token_details_cache');
      expect(legacy).toEqual(legacyCache);

      // Migrate to new cached format
      storageManager.setCached('token_details_cache', legacyCache, { ttl: 3600000 });

      // Verify new format
      const migrated = storageManager.getCached<typeof legacyCache>('token_details_cache', { ttl: 3600000 });
      expect(migrated).toEqual(legacyCache);
    });

    it('should handle cache version upgrades', () => {
      const v1Data = { version: 1, data: 'old' };
      const v2Data = { version: 2, data: 'new' };

      // Set v1 cache
      storageManager.setCached('token_details_cache', v1Data, { version: 'v1' });

      // Upgrade to v2
      storageManager.setCached('token_details_cache', v2Data, { version: 'v2' });

      // v1 should still exist
      const v1Retrieved = storageManager.getCached('token_details_cache', { version: 'v1' });
      expect(v1Retrieved).toEqual(v1Data);

      // v2 should exist
      const v2Retrieved = storageManager.getCached('token_details_cache', { version: 'v2' });
      expect(v2Retrieved).toEqual(v2Data);
    });
  });

  describe('Multi-User Data Migration', () => {
    it('should handle multiple wallet addresses in orders', () => {
      const orders = {
        'order1|address1': { amount: 100, status: 'pending' },
        'order2|address2': { amount: 200, status: 'pending' },
        'order3|address1': { amount: 300, status: 'completed' }
      };

      localStorage.setItem('swap_orders', JSON.stringify(orders));

      const retrieved = storageManager.get<typeof orders>('swap_orders');
      expect(retrieved).toEqual(orders);

      // Filter orders for address1
      const address1Orders = Object.entries(retrieved || {})
        .filter(([key]) => key.includes('address1'));
      expect(address1Orders.length).toBe(2);
    });

    it('should handle wallet switching', () => {
      // User 1
      storageManager.set('wallet_address', 'address1');
      storageManager.set('wallet_mnemonic', 'mnemonic1');

      expect(storageManager.get('wallet_address')).toBe('address1');

      // Switch to User 2
      storageManager.set('wallet_address', 'address2');
      storageManager.set('wallet_mnemonic', 'mnemonic2');

      expect(storageManager.get('wallet_address')).toBe('address2');
      expect(storageManager.get('wallet_mnemonic')).toBe('mnemonic2');
    });
  });

  describe('Guest Mode Migration', () => {
    it('should migrate guest mode flag', () => {
      localStorage.setItem('wallet_is_guest', 'true');
      localStorage.setItem('wallet_address', 'guest_address');

      // 'true' string will be parsed as boolean
      expect(storageManager.get('wallet_is_guest')).toBe(true);
      expect(storageManager.get('wallet_address')).toBe('guest_address');

      // Verify mnemonic is not set for guest
      expect(storageManager.get('wallet_mnemonic')).toBeNull();
    });

    it('should handle guest to regular wallet migration', () => {
      // Start as guest
      storageManager.set('wallet_is_guest', 'true');
      storageManager.set('wallet_address', 'guest_address');

      // Convert to regular wallet
      storageManager.remove('wallet_is_guest');
      storageManager.set('wallet_mnemonic', 'new_mnemonic');
      storageManager.set('wallet_address', 'regular_address');

      expect(storageManager.get('wallet_is_guest')).toBeNull();
      expect(storageManager.get('wallet_mnemonic')).toBe('new_mnemonic');
      expect(storageManager.get('wallet_address')).toBe('regular_address');
    });
  });

  describe('Bulk Migration', () => {
    it('should migrate all wallet-related keys at once', () => {
      // Legacy data
      localStorage.setItem('wallet_address', 'address');
      localStorage.setItem('wallet_mnemonic', 'mnemonic');
      localStorage.setItem('wallet_is_guest', 'false');
      localStorage.setItem('auto_processing', 'true');

      // Read all with StorageManager
      const walletData = {
        address: storageManager.get('wallet_address'),
        mnemonic: storageManager.get('wallet_mnemonic'),
        isGuest: storageManager.get('wallet_is_guest'),
        autoProcessing: storageManager.get('auto_processing')
      };

      expect(walletData).toEqual({
        address: 'address',
        mnemonic: 'mnemonic',
        isGuest: false, // 'false' string parsed as boolean
        autoProcessing: true // 'true' string parsed as boolean
      });
    });

    it('should migrate all cache keys at once', () => {
      localStorage.setItem('token_details_cache', JSON.stringify({ a: 1 }));
      localStorage.setItem('token_supply_cache', JSON.stringify({ b: 2 }));
      localStorage.setItem('token_stats_cache', JSON.stringify({ c: 3 }));

      const caches = {
        details: storageManager.get('token_details_cache'),
        supply: storageManager.get('token_supply_cache'),
        stats: storageManager.get('token_stats_cache')
      };

      expect(caches).toEqual({
        details: { a: 1 },
        supply: { b: 2 },
        stats: { c: 3 }
      });
    });
  });

  describe('Rollback Scenarios', () => {
    it('should allow rollback to legacy localStorage', () => {
      // Write with StorageManager
      storageManager.set('wallet_address', 'new_address');

      // Read with legacy method
      const legacyRead = localStorage.getItem('wallet_address');
      expect(legacyRead).toBe('new_address');

      // Update with legacy method
      localStorage.setItem('wallet_address', 'rolled_back_address');

      // Clear memory cache to force re-read
      storageManager.clearMemoryCache();

      // Read with StorageManager
      const newRead = storageManager.get('wallet_address');
      expect(newRead).toBe('rolled_back_address');
    });
  });
});
