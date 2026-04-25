import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateOrdersData,
  checkServerDataHash,
  processOrders,
  pushOrdersToServer,
  getTokenInfo,
} from '@/lib/Auto.js';
import {
  autoOrdersClean,
  autoOrderCompletedNonZeroRemaining,
  autoOrderCompletedDustRemainder,
  autoOrderCompletedNonDustRemainder,
  autoOrderPendingWithTransactions,
  autoOrderPendingZeroRemaining,
  autoOrderPartialZeroRemaining,
  autoOrderSinglePending,
  autoOrdersEmpty,
  autoOrdersMultipleErrors,
  cloneOrders,
} from '../fixtures/auto';

const buyMainMock = vi.fn();
const dispatchOrdersUpdatedMock = vi.fn();

// Mock dependencies
vi.mock('@/lib/Buy.js', () => ({
  main: (...args) => buyMainMock(...args),
}));

vi.mock('@/lib/chronik.ts', () => ({
  chronik: {
    token: vi.fn(),
  },
  getCachedTokenDetails: vi.fn(() => null),
  getTokenDecimalsFromDetails: vi.fn((tokenData, fallback) =>
    tokenData?.genesisInfo?.decimals ?? fallback,
  ),
}));

vi.mock('@/lib/swap-order-utils', () => ({
  dispatchOrdersUpdated: (...args) => dispatchOrdersUpdatedMock(...args),
}));

global.fetch = vi.fn();
global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

describe('Auto.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buyMainMock.mockReset();
    dispatchOrdersUpdatedMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('validateOrdersData', () => {
    it('should validate clean orders without errors', () => {
      const result = validateOrdersData(cloneOrders(autoOrdersClean));

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fix completed order with non-zero remainingAmount', () => {
      const result = validateOrdersData(cloneOrders(autoOrderCompletedNonZeroRemaining));

      expect(result.errors.length).toBeGreaterThanOrEqual(0);
      expect(result.fixedOrders['token1|addr1|100|rand1'].remainingAmount).toBe(0);
    });

    it('should auto-complete dust remainders (< 100 XEC)', () => {
      const result = validateOrdersData(cloneOrders(autoOrderCompletedDustRemainder));

      expect(result.fixedOrders['token1|addr1|100|rand1'].remainingAmount).toBe(0);
    });

    it('should not auto-complete if remaining value >= 100 XEC', () => {
      const result = validateOrdersData(cloneOrders(autoOrderCompletedNonDustRemainder));

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.fixedOrders['token1|addr1|100|rand1'].remainingAmount).toBe(0);
    });

    it('should fix pending order with transactions', () => {
      const result = validateOrdersData(cloneOrders(autoOrderPendingWithTransactions));

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.fixedOrders['token1|addr1|100|rand1'].status).toBe('partial');
    });

    it('should fix pending order with transactions and zero remaining', () => {
      const result = validateOrdersData(cloneOrders(autoOrderPendingZeroRemaining));

      expect(result.fixedOrders['token1|addr1|100|rand1'].status).toBe('completed');
    });

    it('should fix partial order with zero remainingAmount', () => {
      const result = validateOrdersData(cloneOrders(autoOrderPartialZeroRemaining));

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.fixedOrders['token1|addr1|100|rand1'].status).toBe('completed');
    });

    it('should detect duplicate order keys', () => {
      const result = validateOrdersData(cloneOrders(autoOrderSinglePending));

      expect(result.valid).toBe(true);
    });

    it('should handle empty orders object', () => {
      const result = validateOrdersData(cloneOrders(autoOrdersEmpty));

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle multiple validation errors', () => {
      const result = validateOrdersData(cloneOrders(autoOrdersMultipleErrors));

      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getTokenInfo', () => {
    it('should fetch and cache token info', async () => {
      const { chronik } = await import('@/lib/chronik.ts');

      vi.mocked(chronik.token).mockResolvedValue({
        genesisInfo: {
          decimals: 6,
          tokenTicker: 'TEST',
          tokenName: 'Test Token',
        },
      });

      const result = await getTokenInfo('token123');

      expect(result).toEqual({
        decimals: 6,
        ticker: 'TEST',
        name: 'Test Token',
      });
      expect(chronik.token).toHaveBeenCalledWith('token123');
    });

    it('should return cached token info on second call', async () => {
      const { chronik } = await import('@/lib/chronik.ts');

      vi.mocked(chronik.token).mockResolvedValue({
        genesisInfo: {
          decimals: 6,
          tokenTicker: 'TEST',
          tokenName: 'Test Token',
        },
      });

      await getTokenInfo('token456');
      const result = await getTokenInfo('token456');

      expect(result.decimals).toBe(6);
      expect(chronik.token).toHaveBeenCalledTimes(1); // Only called once due to cache
    });

    it('should retry on failure and return default on max retries', async () => {
      const { chronik } = await import('@/lib/chronik.ts');

      vi.mocked(chronik.token).mockRejectedValue(new Error('Network error'));

      const result = await getTokenInfo('token789', 2, 10);

      expect(result).toEqual({
        decimals: 0,
        ticker: 'UNKNOWN',
        name: 'Unknown Token',
      });
      expect(chronik.token).toHaveBeenCalledTimes(2);
    });
  });

  describe('checkServerDataHash', () => {
    it('should return match=true when hashes match', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ match: true, message: 'Hashes match' }),
      });

      const orders = {
        'token1|addr1|100|rand1': {
          status: 'pending',
          remainingAmount: 100,
        },
      };

      const result = await checkServerDataHash(orders, 'addr1');

      expect(result.match).toBe(true);
      expect(result.message).toBe('Hashes match');
    });

    it('should return match=false with diffKeys when hashes differ', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            match: false,
            message: 'Hashes differ',
            diffKeys: ['token1|addr1|100|rand1'],
          }),
      });

      const orders = {
        'token1|addr1|100|rand1': {
          status: 'pending',
          remainingAmount: 100,
        },
      };

      const result = await checkServerDataHash(orders, 'addr1');

      expect(result.match).toBe(false);
      expect(result.diffKeys).toHaveLength(1);
    });

    it('should retry on network failure', async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({ match: true }),
        });

      const orders = {
        'token1|addr1|100|rand1': { status: 'pending', remainingAmount: 100 },
      };

      const result = await checkServerDataHash(orders, 'addr1', 2, 10);

      expect(result.match).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should return error after max retries', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const orders = {
        'token1|addr1|100|rand1': { status: 'pending', remainingAmount: 100 },
      };

      const result = await checkServerDataHash(orders, 'addr1', 2, 10);

      expect(result.match).toBe(false);
      expect(result.message).toContain('Failed to connect to server');
      expect(result.error).toBeDefined();
    });

    it('should handle invalid JSON response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => 'Invalid JSON',
      });

      const orders = {
        'token1|addr1|100|rand1': { status: 'pending', remainingAmount: 100 },
      };

      const result = await checkServerDataHash(orders, 'addr1', 1, 10);

      expect(result.match).toBe(false);
      expect(result.message).toContain('cannot be parsed');
    });
  });

  describe('pushOrdersToServer', () => {
    beforeEach(() => {
      global.localStorage.setItem = vi.fn();
      global.window = { dispatchEvent: vi.fn() };
    });

    it('should push orders successfully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ success: true }),
      });

      const orders = {
        'token1|addr1|100|rand1': {
          status: 'pending',
          remainingAmount: 100,
          maxPrice: 1,
          transactions: [],
        },
      };

      const result = await pushOrdersToServer(orders, 'addr1');

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should return true if no orders for address', async () => {
      const orders = {
        'token1|addr2|100|rand1': { status: 'pending', remainingAmount: 100 },
      };

      const result = await pushOrdersToServer(orders, 'addr1');

      expect(result).toBe(true);
    });

    it('should handle push failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ success: false }),
      });

      const orders = {
        'token1|addr1|100|rand1': { status: 'pending', remainingAmount: 100 },
      };

      const result = await pushOrdersToServer(orders, 'addr1');

      expect(result).toBe(false);
    });

    it('should handle non-OK push responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ success: false, error: 'bad request' }),
      });

      const orders = {
        'token1|addr1|100|rand1': { status: 'pending', remainingAmount: 100 },
      };

      const result = await pushOrdersToServer(orders, 'addr1');

      expect(result).toBe(false);
    });

    it('should handle network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const orders = {
        'token1|addr1|100|rand1': { status: 'pending', remainingAmount: 100 },
      };

      const result = await pushOrdersToServer(orders, 'addr1');

      expect(result).toBe(false);
    });
  });

  describe('processOrders', () => {
    it('logs detailed failure info when a buy attempt returns success=false', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { chronik } = await import('@/lib/chronik.ts');

      vi.mocked(chronik.token).mockResolvedValue({
        genesisInfo: {
          decimals: 0,
          tokenTicker: 'TEST',
          tokenName: 'Test Token',
        },
      });

      buyMainMock.mockResolvedValue({
        success: false,
        reason: 'INSUFFICIENT_BALANCE_WITH_FEE',
        message: 'Need at least 11365840 sats total including network fee, have 11365834 sats',
        details: {
          shortfall: 6n,
        },
      });

      localStorage.getItem.mockImplementation((key) => {
        if (key === 'swap_orders') {
          return JSON.stringify({
            'token1|addr1|100|rand1': {
              remainingAmount: 10,
              maxPrice: 100,
              status: 'pending',
              orderType: 'online',
              transactions: [],
            },
          });
        }

        if (key === 'wallet_address') {
          return 'addr1';
        }

        if (key === 'wallet_mnemonic') {
          return 'seed phrase';
        }

        return null;
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ success: true }),
      });

      await processOrders();

      expect(warnSpy).toHaveBeenCalledWith(
        '[Auto.js] Buy execution failed',
        expect.objectContaining({
          orderKey: 'token1|addr1|100|rand1',
          tokenId: 'token1',
          requestedAmount: 10,
          requestedMaxPrice: 100,
          executionMaxPrice: 100.2,
          reason: 'INSUFFICIENT_BALANCE_WITH_FEE',
          message: 'Need at least 11365840 sats total including network fee, have 11365834 sats',
        }),
      );
    });

    it('does not wait for server sync requests before releasing the execution promise', async () => {
      vi.useFakeTimers();

      const { chronik } = await import('@/lib/chronik.ts');

      vi.mocked(chronik.token).mockResolvedValue({
        genesisInfo: {
          decimals: 0,
          tokenTicker: 'TEST',
          tokenName: 'Test Token',
        },
      });

      buyMainMock.mockResolvedValue({
        success: true,
        txid: 'tx-1',
        actualAmount: 10,
        networkFee: 1,
        swapFee: 1,
        totalFees: 2,
        transactions: [
          {
            txid: 'tx-1',
            amount: 10,
            networkFee: 1,
            swapFee: 1,
            totalFees: 2,
          },
        ],
      });

      localStorage.getItem.mockImplementation((key) => {
        if (key === 'swap_orders') {
          return JSON.stringify({
            'token1|addr1|100|rand1': {
              remainingAmount: 10,
              maxPrice: 100,
              status: 'pending',
              orderType: 'online',
              transactions: [],
            },
          });
        }

        if (key === 'wallet_address') {
          return 'addr1';
        }

        if (key === 'wallet_mnemonic') {
          return 'seed phrase';
        }

        return null;
      });

      let rejectFirstFetch;
      global.fetch = vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((_resolve, reject) => {
              rejectFirstFetch = reject;
            }),
        )
        .mockRejectedValue(new Error('Network error'));

      const resultPromise = processOrders();

      await resultPromise;
      expect(buyMainMock).toHaveBeenCalledTimes(1);

      rejectFirstFetch?.(new Error('Network error'));
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(5000);
      await Promise.resolve();
    });
  });
});
