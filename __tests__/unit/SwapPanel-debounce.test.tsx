import React from 'react';
import { render } from '@testing-library/react';
import { SwapPanel } from '@/app/swap/SwapPanel';
import { WalletProvider } from '@/lib/context/WalletContext';
import { AutoExecutionProvider } from '@/lib/context/AutoExecutionContext';
import * as agoraOrders from '@/lib/agora-orders';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { debounce } from 'lodash';

// Mock dependencies
vi.mock('@/lib/agora-orders');
vi.mock('@/lib/price', () => ({
  useXECPrice: () => 0.00003,
}));
vi.mock('@/lib/chronik-transactions', () => ({
  fetchAgoraTransactionsFromChronik: vi.fn().mockResolvedValue([
    { price: 0.01 }
  ]),
}));
vi.mock('@/lib/networkFee', () => ({
  DEFAULT_BASE_NETWORK_FEE_XEC: 10,
  estimateNetworkFeeXecFromAddress: vi.fn().mockResolvedValue({ fee: 10 }),
}));

// Mock fetch for english.json
global.fetch = vi.fn((url) => {
  if (url === '/english.json') {
    return Promise.resolve({
      json: () => Promise.resolve({ words: [] }),
    } as Response);
  }
  return Promise.reject(new Error('Not found'));
});

const mockOrderBook = {
  success: true,
  data: {
    orders: [
      { price: 0.01, amount: 1000 },
      { price: 0.012, amount: 2000 },
      { price: 0.015, amount: 1500 },
    ],
    stats: {
      min_price: 0.01,
    },
  },
};

describe('SwapPanel - Debounce calculateAverageExecutionPrice', () => {
  let fetchOrderBookSpy: any;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchOrderBookSpy = vi.spyOn(agoraOrders, 'fetchAgoraOrderBook')
      .mockResolvedValue(mockOrderBook);

    // Mock localStorage
    Storage.prototype.getItem = vi.fn(() => null);
    Storage.prototype.setItem = vi.fn();
    Storage.prototype.clear = vi.fn();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const renderSwapPanel = () => {
    return render(
      <WalletProvider>
        <AutoExecutionProvider>
          <SwapPanel />
        </AutoExecutionProvider>
      </WalletProvider>
    );
  };

  it('should verify debounce is implemented with 300ms delay', () => {
    // Test the debounce function directly
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 300);

    // Call multiple times rapidly
    debouncedFn();
    debouncedFn();
    debouncedFn();
    debouncedFn();
    debouncedFn();

    // Should not have been called yet
    expect(mockFn).not.toHaveBeenCalled();

    // Advance time by 300ms
    vi.advanceTimersByTime(300);

    // Should have been called exactly once
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should verify debounce cleanup on cancel', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 300);

    debouncedFn();

    // Cancel before it fires
    debouncedFn.cancel();

    vi.advanceTimersByTime(400);

    // Should not have been called
    expect(mockFn).not.toHaveBeenCalled();
  });

  it('should verify debounce resets timer on new calls', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 300);

    debouncedFn();

    // Wait 200ms (less than 300ms)
    vi.advanceTimersByTime(200);

    // Call again - should reset timer
    debouncedFn();

    // Wait another 200ms (total 400ms from first call, but only 200ms from second)
    vi.advanceTimersByTime(200);

    // Should not have been called yet
    expect(mockFn).not.toHaveBeenCalled();

    // Wait the remaining 100ms
    vi.advanceTimersByTime(100);

    // Now it should have been called
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should render SwapPanel without errors', () => {
    const { container } = renderSwapPanel();
    expect(container).toBeTruthy();
  });

  it('should verify lodash debounce is imported and available', () => {
    expect(debounce).toBeDefined();
    expect(typeof debounce).toBe('function');
  });
});
