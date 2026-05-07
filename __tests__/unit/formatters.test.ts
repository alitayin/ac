import { describe, it, expect } from 'vitest'
import {
  formatNumber,
  formatPrice,
  convertPrice,
  shortenAddress,
  getChartColor,
} from '@/lib/formatters'

describe('formatters', () => {
  describe('formatNumber', () => {
    it('should return "0" for null', () => {
      expect(formatNumber(null)).toBe('0')
    })

    it('should return "0" for undefined', () => {
      expect(formatNumber(undefined)).toBe('0')
    })

    it('should format billions with B suffix', () => {
      expect(formatNumber(1_500_000_000)).toBe('1.500B')
      expect(formatNumber(5_000_000_000)).toBe('5.000B')
    })

    it('should format millions with M suffix', () => {
      expect(formatNumber(2_500_000)).toBe('2.50M')
      expect(formatNumber(10_000_000)).toBe('10.00M')
    })

    it('should format thousands with locale string', () => {
      expect(formatNumber(5_000)).toBe('5,000.00')
      expect(formatNumber(12_345)).toBe('12,345.00')
    })

    it('should format small numbers with 2 decimals', () => {
      expect(formatNumber(123.456)).toBe('123.46')
      expect(formatNumber(0.5)).toBe('0.50')
    })

    it('should format small numbers without decimals when noDecimals is true', () => {
      expect(formatNumber(123.456, true)).toBe('123')
      expect(formatNumber(0.9, true)).toBe('1')
    })

    it('should format large count values without decimals when noDecimals is true', () => {
      expect(formatNumber(38_543, true)).toBe('38,543')
      expect(formatNumber(1_234_567, true)).toBe('1,234,567')
    })

    it('should handle zero', () => {
      expect(formatNumber(0)).toBe('0.00')
      expect(formatNumber(0, true)).toBe('0')
    })

    it('should handle negative numbers with consistent formatting', () => {
      expect(formatNumber(-1000)).toBe('-1,000.00')
      expect(formatNumber(-5_000_000)).toBe('-5.00M')
      expect(formatNumber(-2_000_000_000)).toBe('-2.000B')
    })

    it('should handle very large numbers', () => {
      expect(formatNumber(999_999_999_999)).toBe('1000.000B')
    })
  })

  describe('formatPrice', () => {
    it('should return "0" for null', () => {
      expect(formatPrice(null)).toBe('0')
    })

    it('should return "0" for undefined', () => {
      expect(formatPrice(undefined)).toBe('0')
    })

    it('should format prices >= 1 with 2 decimals', () => {
      expect(formatPrice(1.0)).toBe('1.00')
      expect(formatPrice(5.5)).toBe('5.50')
      expect(formatPrice(100.123)).toBe('100.12')
    })

    it('should format prices >= 0.1 with 3 decimals', () => {
      expect(formatPrice(0.1)).toBe('0.1')
      expect(formatPrice(0.555)).toBe('0.555')
      expect(formatPrice(0.9999)).toBe('1') // Rounds to 1
    })

    it('should format prices >= 0.01 with 5 decimals', () => {
      expect(formatPrice(0.01)).toBe('0.01')
      expect(formatPrice(0.05555)).toBe('0.05555')
      expect(formatPrice(0.099)).toBe('0.099')
    })

    it('should format prices < 0.01 with 8 decimals', () => {
      expect(formatPrice(0.001)).toBe('0.001')
      expect(formatPrice(0.00000123)).toBe('0.00000123')
    })

    it('should handle zero', () => {
      expect(formatPrice(0)).toBe('0')
    })

    it('should handle very small numbers', () => {
      expect(formatPrice(0.00000001)).toBe('1e-8')
    })

    it('should round to 8 decimal places', () => {
      expect(formatPrice(1.123456789)).toBe('1.12')
    })

    it('should handle boundary at 1.0', () => {
      expect(formatPrice(0.99999999)).toBe('1')
      expect(formatPrice(1.00000001)).toBe('1.00')
    })

    it('should handle negative prices with consistent formatting', () => {
      expect(formatPrice(-1.5)).toBe('-1.50')
      expect(formatPrice(-0.5)).toBe('-0.5')
      expect(formatPrice(-0.05)).toBe('-0.05')
      expect(formatPrice(-0.001)).toBe('-0.001')
    })

    it('should handle USD conversion for negative prices', () => {
      expect(convertPrice(-100, true, 0.00003)).toBe('-0.003')
    })

    it('should remove trailing zeros for small prices', () => {
      expect(formatPrice(0.1)).toBe('0.1')
      expect(formatPrice(0.100)).toBe('0.1')
    })
  })

  describe('convertPrice', () => {
    describe('XEC mode (showUSD = false)', () => {
      it('should format prices >= 1 with 2 decimals', () => {
        expect(convertPrice(1.5, false, 0)).toBe('1.50')
        expect(convertPrice(100.0, false, 0)).toBe('100.00')
      })

      it('should format prices >= 0.01 with 3 decimals', () => {
        expect(convertPrice(0.05, false, 0)).toBe('0.05')
        expect(convertPrice(0.999, false, 0)).toBe('0.999')
      })

      it('should format prices >= 0.001 with 4 decimals', () => {
        expect(convertPrice(0.005, false, 0)).toBe('0.005')
      })

      it('should format prices >= 0.0001 with 5 decimals', () => {
        expect(convertPrice(0.0005, false, 0)).toBe('0.0005')
      })

      it('should format very small prices with 10 decimals', () => {
        expect(convertPrice(0.00001, false, 0)).toBe('0.00001')
      })

      it('should remove trailing zeros', () => {
        expect(convertPrice(1.0, false, 0)).toBe('1.00')
        expect(convertPrice(0.1, false, 0)).toBe('0.10')
      })

      it('should keep at least 2 decimal places', () => {
        expect(convertPrice(5.0, false, 0)).toBe('5.00')
      })
    })

    describe('USD mode (showUSD = true)', () => {
      it('should return XEC format when xecPrice is 0', () => {
        expect(convertPrice(1.5, true, 0)).toBe('1.50')
      })

      it('should convert to USD when xecPrice is provided', () => {
        expect(convertPrice(100, true, 0.00003)).toBe('0.003')
      })

      it('should format USD >= 1 with 2 decimals', () => {
        expect(convertPrice(50000, true, 0.00003)).toBe('1.5')
      })

      it('should format USD >= 0.01 with 4 decimals', () => {
        expect(convertPrice(500, true, 0.00003)).toBe('0.015')
      })

      it('should format USD >= 0.0001 with 6 decimals', () => {
        expect(convertPrice(10, true, 0.00003)).toBe('0.0003')
      })

      it('should format USD >= 0.000001 with 8 decimals', () => {
        expect(convertPrice(1, true, 0.00003)).toBe('0.00003')
      })

      it('should format very small USD with 10 decimals', () => {
        expect(convertPrice(0.1, true, 0.00003)).toBe('0.000003')
      })

      it('should remove trailing zeros in USD mode', () => {
        expect(convertPrice(100000, true, 0.00003)).toBe('3')
      })
    })

    it('should handle zero price', () => {
      expect(convertPrice(0, false, 0)).toBe('0.00')
    })

    it('should handle negative prices with consistent formatting', () => {
      expect(convertPrice(-1.5, false, 0)).toBe('-1.50')
      expect(convertPrice(-0.5, false, 0)).toBe('-0.50')
    })
  })

  describe('shortenAddress', () => {
    it('should return last 3 characters by default', () => {
      expect(shortenAddress('ecash:qp1234567890abcdef')).toBe('def')
    })

    it('should return last N characters when specified', () => {
      expect(shortenAddress('ecash:qp1234567890abcdef', 5)).toBe('bcdef')
      expect(shortenAddress('ecash:qp1234567890abcdef', 10)).toBe('7890abcdef')
    })

    it('should handle short addresses', () => {
      expect(shortenAddress('abc', 5)).toBe('abc')
    })
  })

  describe('getChartColor', () => {
    it('should return colors for indices 0-4 with opacity 1', () => {
      expect(getChartColor(0)).toBe('hsla(var(--chart-1) / 1)')
      expect(getChartColor(1)).toBe('hsla(var(--chart-2) / 1)')
      expect(getChartColor(4)).toBe('hsla(var(--chart-5) / 1)')
    })

    it('should return colors for indices >= 5 with opacity 0.9', () => {
      expect(getChartColor(5)).toBe('hsla(var(--chart-1) / 0.9)')
      expect(getChartColor(6)).toBe('hsla(var(--chart-2) / 0.9)')
    })

    it('should cycle through 5 colors', () => {
      expect(getChartColor(10)).toBe('hsla(var(--chart-1) / 0.9)')
      expect(getChartColor(11)).toBe('hsla(var(--chart-2) / 0.9)')
    })

    it('should handle large indices', () => {
      expect(getChartColor(100)).toBe('hsla(var(--chart-1) / 0.9)')
    })
  })
})
