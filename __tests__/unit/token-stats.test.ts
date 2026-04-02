import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  calculateStats,
  pruneRecentTransactions,
  compute24hStats,
  getCachedTokenData,
  setCachedTokenData,
  clearTokenCache,
  invalidateTokenCache,
  getCachedTokenSummary,
  setCachedTokenSummary,
  deleteSummaryCache,
  refreshSummaryCacheTimestamps,
  BLOCKS_PER_MONTH,
  CACHE_KEY_PREFIX,
  SUMMARY_CACHE_KEY_PREFIX,
} from '@/lib/token-stats'
import { createMockProcessedTransaction, mockCachedTokenData } from '../helpers/mocks'
import { Transaction } from '@/lib/types'

describe('token-stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('calculateStats', () => {
    it('should return zero stats for empty transactions', () => {
      const stats = calculateStats([], null, null)
      expect(stats).toEqual({
        latestPrice: 0,
        priceChange24h: 0,
        last24HoursXECAmount: 0,
        last30DaysXECAmount: 0,
        totalTransactions: 0,
        totalXECAmount: 0,
      })
    })

    it('should calculate stats for single transaction', () => {
      const tx = createMockProcessedTransaction({
        price: 0.5,
        amount: 1000,
        timestamp: Math.floor(Date.now() / 1000),
      })
      const stats = calculateStats([tx], null, null)

      expect(stats.latestPrice).toBe(0.5)
      expect(stats.last24HoursXECAmount).toBe(500) // 0.5 * 1000
      expect(stats.totalTransactions).toBe(1)
    })

    it('should calculate 24h price change correctly', () => {
      const now = Math.floor(Date.now() / 1000)
      const txs: Transaction[] = [
        createMockProcessedTransaction({
          price: 1.0,
          amount: 100,
          timestamp: now,
          blockHeight: 800000,
        }),
        createMockProcessedTransaction({
          price: 0.8,
          amount: 100,
          timestamp: now - 86400, // 24h ago
          blockHeight: 799856,
        }),
      ]

      const stats = calculateStats(txs, 800000, 800000)
      expect(stats.latestPrice).toBe(1.0)
      // Price change: ((1.0 - 0.8) / 0.8) * 100 = 25%
      expect(stats.priceChange24h).toBeCloseTo(25, 1)
    })

    it('should calculate 30-day volume using block height', () => {
      const tipHeight = 800000
      const txs: Transaction[] = [
        createMockProcessedTransaction({
          price: 0.5,
          amount: 1000,
          blockHeight: 800000,
          timestamp: Math.floor(Date.now() / 1000),
        }),
        createMockProcessedTransaction({
          price: 0.4,
          amount: 500,
          blockHeight: 800000 - BLOCKS_PER_MONTH + 10, // Within 30 days
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 29,
        }),
        createMockProcessedTransaction({
          price: 0.3,
          amount: 200,
          blockHeight: 800000 - BLOCKS_PER_MONTH - 100, // Outside 30 days
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 35,
        }),
      ]

      const stats = calculateStats(txs, tipHeight, tipHeight)
      // Should include first two: 0.5*1000 + 0.4*500 = 700
      expect(stats.last30DaysXECAmount).toBe(700)
      expect(stats.totalTransactions).toBe(2)
    })

    it('should handle transactions without blockHeight', () => {
      const now = Math.floor(Date.now() / 1000)
      const txs: Transaction[] = [
        createMockProcessedTransaction({
          price: 0.5,
          amount: 100,
          timestamp: now,
          blockHeight: undefined,
        }),
      ]

      const stats = calculateStats(txs, null, null)
      expect(stats.latestPrice).toBe(0.5)
      expect(stats.last24HoursXECAmount).toBe(50)
    })
  })

  describe('pruneRecentTransactions', () => {
    it('should filter transactions within 30 days by block height', () => {
      const tipHeight = 800000
      const txs: Transaction[] = [
        createMockProcessedTransaction({
          blockHeight: 800000,
          timestamp: Math.floor(Date.now() / 1000),
        }),
        createMockProcessedTransaction({
          blockHeight: 800000 - BLOCKS_PER_MONTH + 10,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 29,
        }),
        createMockProcessedTransaction({
          blockHeight: 800000 - BLOCKS_PER_MONTH - 100,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 35,
        }),
      ]

      const result = pruneRecentTransactions(txs, tipHeight, tipHeight)
      expect(result.filtered.length).toBe(2)
      expect(result.latestBlockHeight).toBe(800000)
    })

    it('should filter by timestamp when no block height threshold', () => {
      const now = Math.floor(Date.now() / 1000)
      const txs: Transaction[] = [
        createMockProcessedTransaction({
          blockHeight: 800000,
          timestamp: now - 86400 * 10, // 10 days ago
        }),
        createMockProcessedTransaction({
          blockHeight: 799000,
          timestamp: now - 86400 * 35, // 35 days ago
        }),
      ]

      const result = pruneRecentTransactions(txs, null, null)
      expect(result.filtered.length).toBe(1)
    })

    it('should exclude transactions without blockHeight', () => {
      const txs: Transaction[] = [
        createMockProcessedTransaction({
          blockHeight: 800000,
          timestamp: Math.floor(Date.now() / 1000),
        }),
        createMockProcessedTransaction({
          blockHeight: undefined,
          timestamp: Math.floor(Date.now() / 1000),
        }),
      ]

      const result = pruneRecentTransactions(txs, 800000, 800000)
      expect(result.filtered.length).toBe(1)
    })
  })

  describe('compute24hStats', () => {
    it('should return zero stats for empty transactions', () => {
      const stats = compute24hStats([], null, null)
      expect(stats.latestPrice).toBe(0)
      expect(stats.priceChange24h).toBe(0)
      expect(stats.last24HoursXECAmount).toBe(0)
      expect(stats.totalTransactions).toBe(0)
      expect(stats.latestBlockHeight).toBe(null)
    })

    it('should calculate price change from earliest to latest', () => {
      const txs: Transaction[] = [
        createMockProcessedTransaction({
          price: 1.0,
          amount: 100,
          timestamp: 1700000000,
        }),
        createMockProcessedTransaction({
          price: 0.5,
          amount: 100,
          timestamp: 1699900000,
        }),
      ]

      const stats = compute24hStats(txs, null, null)
      expect(stats.latestPrice).toBe(1.0)
      // ((1.0 - 0.5) / 0.5) * 100 = 100%
      expect(stats.priceChange24h).toBe(100)
    })

    it('should calculate total XEC volume', () => {
      const txs: Transaction[] = [
        createMockProcessedTransaction({ price: 0.5, amount: 1000 }),
        createMockProcessedTransaction({ price: 0.3, amount: 500 }),
      ]

      const stats = compute24hStats(txs, null, null)
      // 0.5*1000 + 0.3*500 = 650
      expect(stats.last24HoursXECAmount).toBe(650)
    })
  })

  describe('cache functions', () => {
    it('should save and retrieve cached token data', () => {
      const tokenId = 'test-token-id'
      const data = mockCachedTokenData

      setCachedTokenData(tokenId, data)
      const retrieved = getCachedTokenData(tokenId)

      expect(retrieved).toEqual(data)
    })

    it('should return null for non-existent cache', () => {
      const retrieved = getCachedTokenData('non-existent')
      expect(retrieved).toBe(null)
    })

    it('should return null for invalid cache data', () => {
      localStorage.setItem(`${CACHE_KEY_PREFIX}_invalid`, 'invalid-json')
      const retrieved = getCachedTokenData('invalid')
      expect(retrieved).toBe(null)
    })

    it('should clear all token caches', () => {
      setCachedTokenData('token1', mockCachedTokenData)
      setCachedTokenData('token2', mockCachedTokenData)

      clearTokenCache()

      expect(getCachedTokenData('token1')).toBe(null)
      expect(getCachedTokenData('token2')).toBe(null)
    })

    it('should invalidate specific token cache', () => {
      const tokenId = 'test-token'
      setCachedTokenData(tokenId, mockCachedTokenData)

      invalidateTokenCache(tokenId)

      const retrieved = getCachedTokenData(tokenId)
      expect(retrieved?.computedAt).toBe(0)
    })
  })

  describe('summary cache functions', () => {
    it('should save and retrieve cached token summary', () => {
      const tokenId = 'test-token-id'
      const summary = {
        computedAt: Date.now(),
        data: {
          latestPrice: 0.5,
          priceChange24h: 10.5,
          last24HoursXECAmount: 5000,
          totalTransactions: 25,
        },
      }

      setCachedTokenSummary(tokenId, summary)
      const retrieved = getCachedTokenSummary(tokenId)

      expect(retrieved).toEqual(summary)
    })

    it('should return null for non-existent summary cache', () => {
      const retrieved = getCachedTokenSummary('non-existent')
      expect(retrieved).toBe(null)
    })

    it('should return null for invalid summary cache data', () => {
      localStorage.setItem(`${SUMMARY_CACHE_KEY_PREFIX}_invalid`, 'invalid-json')
      const retrieved = getCachedTokenSummary('invalid')
      expect(retrieved).toBe(null)
    })

    it('should return null for summary cache with missing fields', () => {
      localStorage.setItem(`${SUMMARY_CACHE_KEY_PREFIX}_incomplete`, JSON.stringify({
        computedAt: Date.now(),
        // missing data field
      }))
      const retrieved = getCachedTokenSummary('incomplete')
      expect(retrieved).toBe(null)
    })

    it('should delete specific summary cache', () => {
      const tokenId = 'test-token'
      const summary = {
        computedAt: Date.now(),
        data: { latestPrice: 0.5 },
      }

      setCachedTokenSummary(tokenId, summary)
      expect(getCachedTokenSummary(tokenId)).not.toBe(null)

      deleteSummaryCache(tokenId)
      expect(getCachedTokenSummary(tokenId)).toBe(null)
    })

    it('should refresh summary cache timestamps', () => {
      const tokenIds = ['token1', 'token2']
      const oldTime = Date.now() - 10000

      tokenIds.forEach(id => {
        setCachedTokenSummary(id, {
          computedAt: oldTime,
          data: { latestPrice: 0.5 },
        })
      })

      refreshSummaryCacheTimestamps(tokenIds)

      tokenIds.forEach(id => {
        const cached = getCachedTokenSummary(id)
        expect(cached?.computedAt).toBeGreaterThan(oldTime)
      })
    })

    it('should handle refresh for non-existent caches', () => {
      // Should not throw error
      expect(() => refreshSummaryCacheTimestamps(['non-existent'])).not.toThrow()
    })
  })

  describe('edge cases', () => {
    it('should handle transactions with zero price', () => {
      const txs: Transaction[] = [
        createMockProcessedTransaction({ price: 0, amount: 1000 }),
      ]
      const stats = calculateStats(txs, null, null)
      expect(stats.latestPrice).toBe(0)
      expect(stats.last24HoursXECAmount).toBe(0)
    })

    it('should handle transactions with identical prices', () => {
      const now = Math.floor(Date.now() / 1000)
      const txs: Transaction[] = [
        createMockProcessedTransaction({ price: 0.5, amount: 100, timestamp: now }),
        createMockProcessedTransaction({ price: 0.5, amount: 200, timestamp: now - 3600 }),
      ]
      const stats = calculateStats(txs, null, null)
      expect(stats.priceChange24h).toBe(0)
    })

    it('should handle very large price values', () => {
      const tx = createMockProcessedTransaction({ price: 1000000, amount: 1 })
      const stats = calculateStats([tx], null, null)
      expect(stats.latestPrice).toBe(1000000)
    })

    it('should handle very small price values', () => {
      const tx = createMockProcessedTransaction({ price: 0.00000001, amount: 1000000 })
      const stats = calculateStats([tx], null, null)
      expect(stats.latestPrice).toBe(0.00000001)
    })

    it('should handle transactions exactly at 24h boundary', () => {
      const now = Math.floor(Date.now() / 1000)
      const txs: Transaction[] = [
        createMockProcessedTransaction({ price: 1.0, amount: 100, timestamp: now }),
        createMockProcessedTransaction({ price: 0.8, amount: 100, timestamp: now - 86400 }),
      ]
      const stats = calculateStats(txs, null, null)
      expect(stats.last24HoursXECAmount).toBeGreaterThan(0)
    })

    it('should handle empty array in pruneRecentTransactions', () => {
      const result = pruneRecentTransactions([], 800000, 800000)
      expect(result.filtered).toEqual([])
      expect(result.latestBlockHeight).toBe(null)
    })

    it('should handle transaction exactly at threshold in pruneRecentTransactions', () => {
      const tipHeight = 800000
      const txs: Transaction[] = [
        createMockProcessedTransaction({
          blockHeight: tipHeight - BLOCKS_PER_MONTH,
          timestamp: Math.floor(Date.now() / 1000),
        }),
      ]
      const result = pruneRecentTransactions(txs, tipHeight, tipHeight)
      expect(result.filtered.length).toBe(1)
    })
  })
})
