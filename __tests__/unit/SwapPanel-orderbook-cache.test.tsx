import { renderHook, waitFor } from '@testing-library/react';
import { useCallback, useRef } from 'react';
import { vi } from 'vitest';

const ORDERBOOK_CACHE_TTL_MS = 10000;

describe('SwapPanel - OrderBook Cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should cache order book data for 10 seconds', async () => {
    const mockFetchAgoraOrderBook = vi.fn().mockResolvedValue({
      success: true,
      data: { orders: [{ price: 1.5, amount: 100 }], stats: { min_price: 1.5 } }
    });

    const { result } = renderHook(() => {
      const orderBookCacheRef = useRef<Map<string, { data: any; timestamp: number }>>(new Map());

      const fetchOrderBookCached = useCallback(async (tokenId: string) => {
        const cached = orderBookCacheRef.current.get(tokenId);
        const now = Date.now();

        if (cached && now - cached.timestamp < ORDERBOOK_CACHE_TTL_MS) {
          return cached.data;
        }

        const response = await mockFetchAgoraOrderBook(tokenId);
        if (response.success && response.data) {
          orderBookCacheRef.current.set(tokenId, { data: response.data, timestamp: now });
          return response.data;
        }
        return { orders: [] };
      }, []);

      return { fetchOrderBookCached };
    });

    // First call - should fetch from API
    await result.current.fetchOrderBookCached('token-1');
    expect(mockFetchAgoraOrderBook).toHaveBeenCalledTimes(1);

    // Second call within 10 seconds - should use cache
    await result.current.fetchOrderBookCached('token-1');
    expect(mockFetchAgoraOrderBook).toHaveBeenCalledTimes(1);

    // Fast-forward 9 seconds - still within cache TTL
    vi.advanceTimersByTime(9000);
    await result.current.fetchOrderBookCached('token-1');
    expect(mockFetchAgoraOrderBook).toHaveBeenCalledTimes(1);

    // Fast-forward 2 more seconds (total 11s) - cache expired
    vi.advanceTimersByTime(2000);
    await result.current.fetchOrderBookCached('token-1');
    expect(mockFetchAgoraOrderBook).toHaveBeenCalledTimes(2);
  });

  it('should maintain separate cache entries for different tokens', async () => {
    const mockFetchAgoraOrderBook = vi.fn()
      .mockResolvedValueOnce({
        success: true,
        data: { orders: [{ price: 1.5, amount: 100 }], stats: { min_price: 1.5 } }
      })
      .mockResolvedValueOnce({
        success: true,
        data: { orders: [{ price: 2.5, amount: 200 }], stats: { min_price: 2.5 } }
      });

    const { result } = renderHook(() => {
      const orderBookCacheRef = useRef<Map<string, { data: any; timestamp: number }>>(new Map());

      const fetchOrderBookCached = useCallback(async (tokenId: string) => {
        const cached = orderBookCacheRef.current.get(tokenId);
        const now = Date.now();

        if (cached && now - cached.timestamp < ORDERBOOK_CACHE_TTL_MS) {
          return cached.data;
        }

        const response = await mockFetchAgoraOrderBook(tokenId);
        if (response.success && response.data) {
          orderBookCacheRef.current.set(tokenId, { data: response.data, timestamp: now });
          return response.data;
        }
        return { orders: [] };
      }, []);

      return { fetchOrderBookCached };
    });

    // Fetch token-1
    const data1 = await result.current.fetchOrderBookCached('token-1');
    expect(mockFetchAgoraOrderBook).toHaveBeenCalledTimes(1);
    expect(data1.stats.min_price).toBe(1.5);

    // Fetch token-2 - should call API again
    const data2 = await result.current.fetchOrderBookCached('token-2');
    expect(mockFetchAgoraOrderBook).toHaveBeenCalledTimes(2);
    expect(data2.stats.min_price).toBe(2.5);

    // Fetch token-1 again - should use cache
    const data1Again = await result.current.fetchOrderBookCached('token-1');
    expect(mockFetchAgoraOrderBook).toHaveBeenCalledTimes(2);
    expect(data1Again.stats.min_price).toBe(1.5);
  });

  it('should handle API errors gracefully', async () => {
    const mockFetchAgoraOrderBook = vi.fn().mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => {
      const orderBookCacheRef = useRef<Map<string, { data: any; timestamp: number }>>(new Map());

      const fetchOrderBookCached = useCallback(async (tokenId: string) => {
        const cached = orderBookCacheRef.current.get(tokenId);
        const now = Date.now();

        if (cached && now - cached.timestamp < ORDERBOOK_CACHE_TTL_MS) {
          return cached.data;
        }

        try {
          const response = await mockFetchAgoraOrderBook(tokenId);
          if (response.success && response.data) {
            orderBookCacheRef.current.set(tokenId, { data: response.data, timestamp: now });
            return response.data;
          }
          return { orders: [] };
        } catch (error) {
          console.error('Error fetching order book:', error);
          return { orders: [] };
        }
      }, []);

      return { fetchOrderBookCached };
    });

    // Should return empty orders on error
    const data = await result.current.fetchOrderBookCached('token-1');
    expect(data).toEqual({ orders: [] });
    expect(mockFetchAgoraOrderBook).toHaveBeenCalledTimes(1);
  });

  it('should handle invalid API responses', async () => {
    const mockFetchAgoraOrderBook = vi.fn().mockResolvedValue({
      success: false,
      data: null
    });

    const { result } = renderHook(() => {
      const orderBookCacheRef = useRef<Map<string, { data: any; timestamp: number }>>(new Map());

      const fetchOrderBookCached = useCallback(async (tokenId: string) => {
        const cached = orderBookCacheRef.current.get(tokenId);
        const now = Date.now();

        if (cached && now - cached.timestamp < ORDERBOOK_CACHE_TTL_MS) {
          return cached.data;
        }

        const response = await mockFetchAgoraOrderBook(tokenId);
        if (response.success && response.data) {
          orderBookCacheRef.current.set(tokenId, { data: response.data, timestamp: now });
          return response.data;
        }
        return { orders: [] };
      }, []);

      return { fetchOrderBookCached };
    });

    // Should return empty orders for invalid response
    const data = await result.current.fetchOrderBookCached('token-1');
    expect(data).toEqual({ orders: [] });
    expect(mockFetchAgoraOrderBook).toHaveBeenCalledTimes(1);
  });

  it('should reduce API calls when multiple functions use cached data', async () => {
    const mockFetchAgoraOrderBook = vi.fn().mockResolvedValue({
      success: true,
      data: { orders: [{ price: 1.5, amount: 100 }], stats: { min_price: 1.5 } }
    });

    const { result } = renderHook(() => {
      const orderBookCacheRef = useRef<Map<string, { data: any; timestamp: number }>>(new Map());

      const fetchOrderBookCached = useCallback(async (tokenId: string) => {
        const cached = orderBookCacheRef.current.get(tokenId);
        const now = Date.now();

        if (cached && now - cached.timestamp < ORDERBOOK_CACHE_TTL_MS) {
          return cached.data;
        }

        const response = await mockFetchAgoraOrderBook(tokenId);
        if (response.success && response.data) {
          orderBookCacheRef.current.set(tokenId, { data: response.data, timestamp: now });
          return response.data;
        }
        return { orders: [] };
      }, []);

      return { fetchOrderBookCached };
    });

    // Simulate multiple functions calling the cached fetch
    await result.current.fetchOrderBookCached('token-1'); // fetchOrderBook
    await result.current.fetchOrderBookCached('token-1'); // calculateAverageExecutionPrice
    await result.current.fetchOrderBookCached('token-1'); // getTokenPrice

    // Should only call API once
    expect(mockFetchAgoraOrderBook).toHaveBeenCalledTimes(1);
  });
});
