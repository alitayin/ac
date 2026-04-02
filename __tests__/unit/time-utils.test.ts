import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getRelativeTime,
  formatTime,
  getLastNDays,
  parseUTCDate,
  formatDateShort,
} from '@/lib/time-utils'

describe('time-utils', () => {
  describe('getRelativeTime', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return "just now" for timestamps < 60 seconds ago', () => {
      const now = Math.floor(Date.now() / 1000)
      expect(getRelativeTime(now)).toBe('just now')
      expect(getRelativeTime(now - 30)).toBe('just now')
      expect(getRelativeTime(now - 59)).toBe('just now')
    })

    it('should return minutes for timestamps < 1 hour ago', () => {
      const now = Math.floor(Date.now() / 1000)
      expect(getRelativeTime(now - 60)).toBe('1m ago')
      expect(getRelativeTime(now - 300)).toBe('5m ago')
      expect(getRelativeTime(now - 3599)).toBe('59m ago')
    })

    it('should return hours for timestamps < 24 hours ago', () => {
      const now = Math.floor(Date.now() / 1000)
      expect(getRelativeTime(now - 3600)).toBe('1h ago')
      expect(getRelativeTime(now - 7200)).toBe('2h ago')
      expect(getRelativeTime(now - 86399)).toBe('23h ago')
    })

    it('should return days for timestamps >= 24 hours ago', () => {
      const now = Math.floor(Date.now() / 1000)
      expect(getRelativeTime(now - 86400)).toBe('1d ago')
      expect(getRelativeTime(now - 172800)).toBe('2d ago')
      expect(getRelativeTime(now - 2592000)).toBe('30d ago')
    })

    it('should handle boundary at 60 seconds', () => {
      const now = Math.floor(Date.now() / 1000)
      expect(getRelativeTime(now - 59)).toBe('just now')
      expect(getRelativeTime(now - 60)).toBe('1m ago')
    })

    it('should handle boundary at 1 hour', () => {
      const now = Math.floor(Date.now() / 1000)
      expect(getRelativeTime(now - 3599)).toBe('59m ago')
      expect(getRelativeTime(now - 3600)).toBe('1h ago')
    })

    it('should handle boundary at 24 hours', () => {
      const now = Math.floor(Date.now() / 1000)
      expect(getRelativeTime(now - 86399)).toBe('23h ago')
      expect(getRelativeTime(now - 86400)).toBe('1d ago')
    })

    it('should handle very old timestamps', () => {
      const now = Math.floor(Date.now() / 1000)
      expect(getRelativeTime(now - 31536000)).toBe('365d ago')
    })
  })

  describe('formatTime', () => {
    it('should format timestamp to M/D, HH:MM', () => {
      const timestamp = new Date('2024-01-15T14:30:00Z').getTime() / 1000
      const result = formatTime(timestamp)
      expect(result).toMatch(/1\/15, \d{2}:\d{2}/)
    })

    it('should pad hours and minutes with zeros', () => {
      const timestamp = new Date('2024-03-05T09:05:00Z').getTime() / 1000
      const result = formatTime(timestamp)
      expect(result).toMatch(/3\/5, \d{2}:\d{2}/)
    })

    it('should handle midnight', () => {
      const timestamp = new Date('2024-06-10T00:00:00Z').getTime() / 1000
      const result = formatTime(timestamp)
      expect(result).toMatch(/6\/10, \d{2}:\d{2}/)
    })

    it('should handle noon', () => {
      const timestamp = new Date('2024-12-25T12:00:00Z').getTime() / 1000
      const result = formatTime(timestamp)
      expect(result).toMatch(/12\/25, \d{2}:\d{2}/)
    })

    it('should handle month boundaries', () => {
      const timestamp = new Date('2024-02-29T23:59:00Z').getTime() / 1000
      const result = formatTime(timestamp)
      // Note: formatTime uses local timezone, so result may vary
      expect(result).toMatch(/\d{1,2}\/\d{1,2}, \d{2}:\d{2}/)
    })
  })

  describe('getLastNDays', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return array of last N days in ISO format', () => {
      const result = getLastNDays(3)
      expect(result).toHaveLength(3)
      expect(result[0]).toBe('2024-01-13')
      expect(result[1]).toBe('2024-01-14')
      expect(result[2]).toBe('2024-01-15')
    })

    it('should return single day for N=1', () => {
      const result = getLastNDays(1)
      expect(result).toHaveLength(1)
      expect(result[0]).toBe('2024-01-15')
    })

    it('should return 7 days for a week', () => {
      const result = getLastNDays(7)
      expect(result).toHaveLength(7)
      expect(result[0]).toBe('2024-01-09')
      expect(result[6]).toBe('2024-01-15')
    })

    it('should return 30 days for a month', () => {
      const result = getLastNDays(30)
      expect(result).toHaveLength(30)
      expect(result[0]).toBe('2023-12-17')
      expect(result[29]).toBe('2024-01-15')
    })

    it('should return dates in ascending order', () => {
      const result = getLastNDays(5)
      for (let i = 1; i < result.length; i++) {
        expect(new Date(result[i]) > new Date(result[i - 1])).toBe(true)
      }
    })
  })

  describe('parseUTCDate', () => {
    it('should parse date string as UTC', () => {
      const result = parseUTCDate('2024-01-15 12:00:00')
      expect(result.toISOString()).toBe('2024-01-15T12:00:00.000Z')
    })

    it('should handle date without time', () => {
      const result = parseUTCDate('2024-06-10')
      expect(result.toISOString()).toBe('2024-06-10T00:00:00.000Z')
    })

    it('should append Z for UTC timezone', () => {
      const result = parseUTCDate('2024-12-25 23:59:59')
      expect(result.toISOString()).toBe('2024-12-25T23:59:59.000Z')
    })
  })

  describe('formatDateShort', () => {
    it('should format date to short locale string', () => {
      const result = formatDateShort('2024-01-15 12:00:00')
      expect(result).toBe('Jan 15')
    })

    it('should handle different months', () => {
      expect(formatDateShort('2024-06-10 00:00:00')).toBe('Jun 10')
      expect(formatDateShort('2024-12-25 00:00:00')).toBe('Dec 25')
    })

    it('should handle single digit days', () => {
      expect(formatDateShort('2024-03-05 00:00:00')).toBe('Mar 5')
    })
  })
})
