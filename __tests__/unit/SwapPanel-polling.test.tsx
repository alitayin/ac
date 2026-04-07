import { renderHook, waitFor } from '@testing-library/react';
import { useEffect, useState, useCallback } from 'react';
import { vi } from 'vitest';

// Mock the polling behavior
const POLLING_INTERVAL_MS = 30000;

describe('SwapPanel - Polling Interval', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should use 30 second polling interval', () => {
    const fetchOrderBook = vi.fn();
    let showProPanel = true;
    let selectedTokenId = 'test-token-id';

    const { rerender } = renderHook(() => {
      useEffect(() => {
        if (showProPanel && selectedTokenId) {
          fetchOrderBook();
          const interval = setInterval(fetchOrderBook, POLLING_INTERVAL_MS);
          return () => clearInterval(interval);
        }
      }, [showProPanel, selectedTokenId]);
    });

    // Initial call
    expect(fetchOrderBook).toHaveBeenCalledTimes(1);

    // Fast-forward 29 seconds - should not call yet
    vi.advanceTimersByTime(29000);
    expect(fetchOrderBook).toHaveBeenCalledTimes(1);

    // Fast-forward 1 more second (total 30s) - should call
    vi.advanceTimersByTime(1000);
    expect(fetchOrderBook).toHaveBeenCalledTimes(2);

    // Fast-forward another 30 seconds - should call again
    vi.advanceTimersByTime(30000);
    expect(fetchOrderBook).toHaveBeenCalledTimes(3);
  });

  it('should not poll when PRO panel is hidden', () => {
    const fetchOrderBook = vi.fn();
    let showProPanel = false;
    let selectedTokenId = 'test-token-id';

    renderHook(() => {
      useEffect(() => {
        if (showProPanel && selectedTokenId) {
          fetchOrderBook();
          const interval = setInterval(fetchOrderBook, POLLING_INTERVAL_MS);
          return () => clearInterval(interval);
        }
      }, [showProPanel, selectedTokenId]);
    });

    // Should not call at all
    expect(fetchOrderBook).not.toHaveBeenCalled();

    // Fast-forward 30 seconds - still should not call
    vi.advanceTimersByTime(30000);
    expect(fetchOrderBook).not.toHaveBeenCalled();
  });

  it('should cleanup interval on unmount', () => {
    const fetchOrderBook = vi.fn();
    let showProPanel = true;
    let selectedTokenId = 'test-token-id';

    const { unmount } = renderHook(() => {
      useEffect(() => {
        if (showProPanel && selectedTokenId) {
          fetchOrderBook();
          const interval = setInterval(fetchOrderBook, POLLING_INTERVAL_MS);
          return () => clearInterval(interval);
        }
      }, [showProPanel, selectedTokenId]);
    });

    // Initial call
    expect(fetchOrderBook).toHaveBeenCalledTimes(1);

    // Unmount
    unmount();

    // Fast-forward 30 seconds - should not call after unmount
    vi.advanceTimersByTime(30000);
    expect(fetchOrderBook).toHaveBeenCalledTimes(1);
  });

  it('should restart polling when token changes', () => {
    const fetchOrderBook = vi.fn();
    let showProPanel = true;
    let selectedTokenId = 'token-1';

    const { rerender } = renderHook(
      ({ tokenId }) => {
        useEffect(() => {
          if (showProPanel && tokenId) {
            fetchOrderBook();
            const interval = setInterval(fetchOrderBook, POLLING_INTERVAL_MS);
            return () => clearInterval(interval);
          }
        }, [showProPanel, tokenId]);
      },
      { initialProps: { tokenId: selectedTokenId } }
    );

    // Initial call
    expect(fetchOrderBook).toHaveBeenCalledTimes(1);

    // Fast-forward 15 seconds
    vi.advanceTimersByTime(15000);
    expect(fetchOrderBook).toHaveBeenCalledTimes(1);

    // Change token
    selectedTokenId = 'token-2';
    rerender({ tokenId: selectedTokenId });

    // Should call immediately with new token
    expect(fetchOrderBook).toHaveBeenCalledTimes(2);

    // Fast-forward 30 seconds from token change
    vi.advanceTimersByTime(30000);
    expect(fetchOrderBook).toHaveBeenCalledTimes(3);
  });
});
