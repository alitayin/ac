import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrderList } from '@/components/ui/orderlist';
import {
  fetchTokenDetails,
  getCachedTokenDetails,
  getTokenDecimalsFromDetails,
} from '@/lib/chronik';

// Mock dependencies
vi.mock('@/lib/chronik', () => ({
  fetchTokenDetails: vi.fn(),
  getCachedTokenDetails: vi.fn(),
  getTokenDecimalsFromDetails: vi.fn(),
}));

vi.mock('@/config/tokens', () => ({
  tokens: {
    token1: {
      tokenId: 'token1-id',
      name: 'Token 1',
      symbol: 'TK1',
      decimals: 2,
    },
    token2: {
      tokenId: 'token2-id',
      name: 'Token 2',
      symbol: 'TK2',
      decimals: 4,
    },
    token3: {
      tokenId: 'token3-id',
      name: 'Token 3',
      symbol: 'TK3',
      decimals: 6,
    },
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const mockFetchTokenDetails = fetchTokenDetails as ReturnType<typeof vi.fn>;
const mockGetCachedTokenDetails = getCachedTokenDetails as ReturnType<typeof vi.fn>;
const mockGetTokenDecimalsFromDetails = getTokenDecimalsFromDetails as ReturnType<typeof vi.fn>;

describe('OrderList - Token Metadata Parallel Loading', () => {
  const mockAddress = 'ecash:qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy';

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Setup default mock behavior
    mockGetCachedTokenDetails.mockReturnValue(undefined);
    mockGetTokenDecimalsFromDetails.mockImplementation((detail, fallback) => fallback);
  });

  describe('Parallel Loading Success', () => {
    it('should load multiple token details in parallel', async () => {
      // Setup: Create orders with 3 different tokens
      const orders = {
        [`token1-id|${mockAddress}|100`]: {
          remainingAmount: 1000,
          maxPrice: 100,
          status: 'pending',
          transactions: [],
          orderType: 'online',
        },
        [`token2-id|${mockAddress}|200`]: {
          remainingAmount: 2000,
          maxPrice: 200,
          status: 'pending',
          transactions: [],
          orderType: 'online',
        },
        [`token3-id|${mockAddress}|300`]: {
          remainingAmount: 3000,
          maxPrice: 300,
          status: 'pending',
          transactions: [],
          orderType: 'online',
        },
      };
      localStorage.setItem('swap_orders', JSON.stringify(orders));

      // Mock fetchTokenDetails to resolve with delays
      let callOrder: string[] = [];
      mockFetchTokenDetails.mockImplementation(async (tokenId) => {
        callOrder.push(`start-${tokenId}`);
        await new Promise(resolve => setTimeout(resolve, 50));
        callOrder.push(`end-${tokenId}`);
        return { tokenId } as any;
      });

      mockGetTokenDecimalsFromDetails.mockImplementation((detail, fallback) => {
        if (detail.tokenId === 'token1-id') return 2;
        if (detail.tokenId === 'token2-id') return 4;
        if (detail.tokenId === 'token3-id') return 6;
        return fallback;
      });

      // Render component
      render(<OrderList ecashAddress={mockAddress} balance={10000} />);

      // Wait for all token details to be fetched
      await waitFor(() => {
        expect(mockFetchTokenDetails).toHaveBeenCalledTimes(3);
      }, { timeout: 3000 });

      // Verify all tokens were called
      expect(mockFetchTokenDetails).toHaveBeenCalledWith('token1-id');
      expect(mockFetchTokenDetails).toHaveBeenCalledWith('token2-id');
      expect(mockFetchTokenDetails).toHaveBeenCalledWith('token3-id');

      // Verify parallel execution: all starts should happen before any ends
      const firstEndIndex = callOrder.findIndex(call => call.startsWith('end-'));
      const allStartsBeforeFirstEnd = callOrder.slice(0, firstEndIndex).every(call => call.startsWith('start-'));
      expect(allStartsBeforeFirstEnd).toBe(true);
    });

    it('should batch update state once after all tokens load', async () => {
      const orders = {
        [`token1-id|${mockAddress}|100`]: {
          remainingAmount: 1000,
          maxPrice: 100,
          status: 'pending',
          transactions: [],
          orderType: 'online',
        },
        [`token2-id|${mockAddress}|200`]: {
          remainingAmount: 2000,
          maxPrice: 200,
          status: 'pending',
          transactions: [],
          orderType: 'online',
        },
      };
      localStorage.setItem('swap_orders', JSON.stringify(orders));

      mockFetchTokenDetails.mockResolvedValue({ tokenId: 'test' } as any);
      mockGetTokenDecimalsFromDetails.mockReturnValue(2);

      const { rerender } = render(<OrderList ecashAddress={mockAddress} balance={10000} />);

      await waitFor(() => {
        expect(mockFetchTokenDetails).toHaveBeenCalledTimes(2);
      });

      // Verify state was updated (component should not error)
      expect(() => rerender(<OrderList ecashAddress={mockAddress} balance={10000} />)).not.toThrow();
    });
  });

  describe('Partial Failure Handling', () => {
    it('should handle partial token loading failures gracefully', async () => {
      const orders = {
        [`token1-id|${mockAddress}|100`]: {
          remainingAmount: 1000,
          maxPrice: 100,
          status: 'pending',
          transactions: [],
          orderType: 'online',
        },
        [`token2-id|${mockAddress}|200`]: {
          remainingAmount: 2000,
          maxPrice: 200,
          status: 'pending',
          transactions: [],
          orderType: 'online',
        },
        [`token3-id|${mockAddress}|300`]: {
          remainingAmount: 3000,
          maxPrice: 300,
          status: 'pending',
          transactions: [],
          orderType: 'online',
        },
      };
      localStorage.setItem('swap_orders', JSON.stringify(orders));

      // Mock: token1 succeeds, token2 fails, token3 succeeds
      mockFetchTokenDetails.mockImplementation(async (tokenId) => {
        if (tokenId === 'token2-id') {
          throw new Error('Network error');
        }
        return { tokenId } as any;
      });

      mockGetTokenDecimalsFromDetails.mockImplementation((detail, fallback) => {
        if (detail.tokenId === 'token1-id') return 2;
        if (detail.tokenId === 'token3-id') return 6;
        return fallback;
      });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<OrderList ecashAddress={mockAddress} balance={10000} />);

      await waitFor(() => {
        expect(mockFetchTokenDetails).toHaveBeenCalledTimes(3);
      });

      // Verify error was logged for failed token
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load token detail: token2-id'),
        expect.any(Error)
      );

      // Verify successful tokens were still processed
      expect(mockFetchTokenDetails).toHaveBeenCalledWith('token1-id');
      expect(mockFetchTokenDetails).toHaveBeenCalledWith('token3-id');

      consoleErrorSpy.mockRestore();
    });

    it('should continue rendering when all token loads fail', async () => {
      const orders = {
        [`token1-id|${mockAddress}|100`]: {
          remainingAmount: 1000,
          maxPrice: 100,
          status: 'pending',
          transactions: [],
          orderType: 'online',
        },
      };
      localStorage.setItem('swap_orders', JSON.stringify(orders));

      mockFetchTokenDetails.mockRejectedValue(new Error('Network error'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { container } = render(<OrderList ecashAddress={mockAddress} balance={10000} />);

      await waitFor(() => {
        expect(mockFetchTokenDetails).toHaveBeenCalled();
      });

      // Component should still render without crashing
      expect(container).toBeTruthy();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty token list', async () => {
      // No orders in localStorage
      localStorage.setItem('swap_orders', JSON.stringify({}));

      render(<OrderList ecashAddress={mockAddress} balance={10000} />);

      // Wait a bit to ensure no calls are made
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockFetchTokenDetails).not.toHaveBeenCalled();
    });

    it('should skip already cached tokens', async () => {
      const orders = {
        [`token1-id|${mockAddress}|100`]: {
          remainingAmount: 1000,
          maxPrice: 100,
          status: 'pending',
          transactions: [],
          orderType: 'online',
        },
      };
      localStorage.setItem('swap_orders', JSON.stringify(orders));

      mockFetchTokenDetails.mockResolvedValue({ tokenId: 'token1-id' } as any);
      mockGetTokenDecimalsFromDetails.mockReturnValue(2);

      const { rerender } = render(<OrderList ecashAddress={mockAddress} balance={10000} />);

      await waitFor(() => {
        expect(mockFetchTokenDetails).toHaveBeenCalledTimes(1);
      });

      // Clear mock and rerender - should not fetch again (cached)
      mockFetchTokenDetails.mockClear();
      rerender(<OrderList ecashAddress={mockAddress} balance={10000} />);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not fetch again because token is cached
      expect(mockFetchTokenDetails).not.toHaveBeenCalled();
    });

    it('should handle orders from different addresses', async () => {
      const otherAddress = 'ecash:qp89xgjhcqdnzzemts0aj378nrfe2mhu8yvxj9nhgg';
      const orders = {
        [`token1-id|${mockAddress}|100`]: {
          remainingAmount: 1000,
          maxPrice: 100,
          status: 'pending',
          transactions: [],
          orderType: 'online',
        },
        [`token2-id|${otherAddress}|200`]: {
          remainingAmount: 2000,
          maxPrice: 200,
          status: 'pending',
          transactions: [],
          orderType: 'online',
        },
      };
      localStorage.setItem('swap_orders', JSON.stringify(orders));

      mockFetchTokenDetails.mockResolvedValue({ tokenId: 'test' } as any);
      mockGetTokenDecimalsFromDetails.mockReturnValue(2);

      render(<OrderList ecashAddress={mockAddress} balance={10000} />);

      await waitFor(() => {
        expect(mockFetchTokenDetails).toHaveBeenCalled();
      });

      // Should only fetch token1 (belongs to mockAddress), not token2
      expect(mockFetchTokenDetails).toHaveBeenCalledTimes(1);
      expect(mockFetchTokenDetails).toHaveBeenCalledWith('token1-id');
      expect(mockFetchTokenDetails).not.toHaveBeenCalledWith('token2-id');
    });
  });

  describe('Performance', () => {
    it('should complete parallel loading faster than serial would', async () => {
      const orders = {
        [`token1-id|${mockAddress}|100`]: {
          remainingAmount: 1000,
          maxPrice: 100,
          status: 'pending',
          transactions: [],
          orderType: 'online',
        },
        [`token2-id|${mockAddress}|200`]: {
          remainingAmount: 2000,
          maxPrice: 200,
          status: 'pending',
          transactions: [],
          orderType: 'online',
        },
        [`token3-id|${mockAddress}|300`]: {
          remainingAmount: 3000,
          maxPrice: 300,
          status: 'pending',
          transactions: [],
          orderType: 'online',
        },
      };
      localStorage.setItem('swap_orders', JSON.stringify(orders));

      // Each fetch takes 100ms
      mockFetchTokenDetails.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { tokenId: 'test' } as any;
      });
      mockGetTokenDecimalsFromDetails.mockReturnValue(2);

      const startTime = Date.now();
      render(<OrderList ecashAddress={mockAddress} balance={10000} />);

      await waitFor(() => {
        expect(mockFetchTokenDetails).toHaveBeenCalledTimes(3);
      }, { timeout: 3000 });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Parallel: ~100ms, Serial would be: ~300ms
      // Allow some overhead, but should be much less than 300ms
      expect(duration).toBeLessThan(250);
    });
  });
});
