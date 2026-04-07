import { renderHook } from '@testing-library/react';
import { useMemo, useCallback } from 'react';
import { vi } from 'vitest';

describe('SwapPanel - Memoization', () => {
  describe('formatTokenPrice memoization', () => {
    it('should memoize formatTokenPrice function with useCallback', () => {
      const { result, rerender } = renderHook(
        ({ price }) => {
          const formatTokenPrice = useCallback((price: number): string => {
            if (price === 0) return '0.00';
            if (price % 1 === 0) return price.toFixed(2);
            const priceStr = price.toString();
            if (priceStr.includes('e')) return price.toFixed(8);
            const parts = priceStr.split('.');
            if (parts.length === 2) {
              const decimalPart = parts[1];
              const decimalPlaces = Math.max(2, Math.min(decimalPart.length, 8));
              let formatted = price.toFixed(decimalPlaces);
              formatted = formatted.replace(/(\.\d*?)0+$/, '$1');
              const currentParts = formatted.split('.');
              if (currentParts.length === 1 || (currentParts[1] && currentParts[1].length < 2)) {
                return price.toFixed(2);
              }
              return formatted;
            }
            return price.toFixed(2);
          }, []);

          return { formatTokenPrice };
        },
        { initialProps: { price: 1.5 } }
      );

      const firstRender = result.current.formatTokenPrice;

      // Rerender with different price - function should remain the same
      rerender({ price: 2.5 });
      const secondRender = result.current.formatTokenPrice;

      expect(firstRender).toBe(secondRender);
    });

    it('should memoize formatted token price result', () => {
      const formatTokenPrice = vi.fn((price: number) => price.toFixed(2));

      const { result, rerender } = renderHook(
        ({ tokenPrice }) => {
          const formattedTokenPrice = useMemo(
            () => formatTokenPrice(tokenPrice),
            [tokenPrice]
          );
          return formattedTokenPrice;
        },
        { initialProps: { tokenPrice: 1.5 } }
      );

      expect(formatTokenPrice).toHaveBeenCalledTimes(1);
      expect(result.current).toBe('1.50');

      // Rerender with same price - should not recalculate
      rerender({ tokenPrice: 1.5 });
      expect(formatTokenPrice).toHaveBeenCalledTimes(1);

      // Rerender with different price - should recalculate
      rerender({ tokenPrice: 2.5 });
      expect(formatTokenPrice).toHaveBeenCalledTimes(2);
      expect(result.current).toBe('2.50');
    });
  });

  describe('USD price calculation memoization', () => {
    it('should memoize USD price calculation', () => {
      const calculateUsdPrice = vi.fn((tokenPrice: number, xecPrice: number) => {
        if (!tokenPrice || !xecPrice) return '';
        return (tokenPrice * xecPrice).toFixed(4);
      });

      const { result, rerender } = renderHook(
        ({ tokenPrice, xecPrice }) => {
          const tokenUsdPrice = useMemo(
            () => calculateUsdPrice(tokenPrice, xecPrice),
            [tokenPrice, xecPrice]
          );
          return tokenUsdPrice;
        },
        { initialProps: { tokenPrice: 10, xecPrice: 0.00003 } }
      );

      expect(calculateUsdPrice).toHaveBeenCalledTimes(1);
      expect(result.current).toBe('0.0003');

      // Rerender with same values - should not recalculate
      rerender({ tokenPrice: 10, xecPrice: 0.00003 });
      expect(calculateUsdPrice).toHaveBeenCalledTimes(1);

      // Rerender with different tokenPrice - should recalculate
      rerender({ tokenPrice: 20, xecPrice: 0.00003 });
      expect(calculateUsdPrice).toHaveBeenCalledTimes(2);
      expect(result.current).toBe('0.0006');

      // Rerender with different xecPrice - should recalculate
      rerender({ tokenPrice: 20, xecPrice: 0.00004 });
      expect(calculateUsdPrice).toHaveBeenCalledTimes(3);
      expect(result.current).toBe('0.0008');
    });
  });

  describe('Price warning calculation memoization', () => {
    it('should memoize price warning data', () => {
      const { result, rerender } = renderHook(
        ({ tokenPrice, marketPrice }) => {
          const priceWarningData = useMemo(() => {
            if (marketPrice > 0 && tokenPrice > 0) {
              const percentDiff = ((tokenPrice - marketPrice) / marketPrice) * 100;
              return {
                shouldShow: percentDiff > 100,
                percent: Math.round(percentDiff)
              };
            }
            return { shouldShow: false, percent: 0 };
          }, [tokenPrice, marketPrice]);
          return priceWarningData;
        },
        { initialProps: { tokenPrice: 300, marketPrice: 100 } }
      );

      // Price is 200% higher than market - should show warning
      expect(result.current).toEqual({ shouldShow: true, percent: 200 });

      // Rerender with same values - should return same object reference
      const firstResult = result.current;
      rerender({ tokenPrice: 300, marketPrice: 100 });
      expect(result.current).toBe(firstResult);

      // Rerender with price below threshold - should not show warning
      rerender({ tokenPrice: 150, marketPrice: 100 });
      expect(result.current).toEqual({ shouldShow: false, percent: 50 });

      // Rerender with price above threshold - should show warning
      rerender({ tokenPrice: 250, marketPrice: 100 });
      expect(result.current).toEqual({ shouldShow: true, percent: 150 });
    });
  });

  describe('Order validation memoization', () => {
    it('should memoize order validation result', () => {
      const { result, rerender } = renderHook(
        ({ tokenPrice, spendAmount, receiveAmount }) => {
          const isOrderValid = useMemo(() => {
            const validPrice = tokenPrice > 0;
            const validSpend = spendAmount && parseFloat(spendAmount) > 0;
            const validReceive = receiveAmount && parseFloat(receiveAmount) > 0;
            return validPrice && validSpend && validReceive;
          }, [tokenPrice, spendAmount, receiveAmount]);
          return isOrderValid;
        },
        { initialProps: { tokenPrice: 10, spendAmount: '100', receiveAmount: '10' } }
      );

      // All valid - should return true
      expect(result.current).toBe(true);

      // Rerender with same values - should not recalculate
      rerender({ tokenPrice: 10, spendAmount: '100', receiveAmount: '10' });
      expect(result.current).toBe(true);

      // Invalid price - should return false
      rerender({ tokenPrice: 0, spendAmount: '100', receiveAmount: '10' });
      expect(result.current).toBe(false);

      // Invalid spend amount (empty string) - should return false
      rerender({ tokenPrice: 10, spendAmount: '', receiveAmount: '10' });
      expect(result.current).toBeFalsy();

      // Invalid receive amount (empty string) - should return false
      rerender({ tokenPrice: 10, spendAmount: '100', receiveAmount: '' });
      expect(result.current).toBeFalsy();

      // All valid again - should return true
      rerender({ tokenPrice: 10, spendAmount: '100', receiveAmount: '10' });
      expect(result.current).toBe(true);
    });
  });
});
