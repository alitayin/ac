import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isAgoraCanceled, detectAgoraTokenId, processMatchedTransaction } from '@/lib/chronik-transactions'
import { createMockTransaction, createCanceledTransaction } from '../helpers/mocks'

// Mock dependencies
vi.mock('@/lib/chronik', () => ({
  chronik: {
    tokenId: vi.fn().mockReturnThis(),
    history: vi.fn(),
  },
  fetchTokenDetails: vi.fn().mockResolvedValue({
    genesisInfo: { decimals: 2 }
  }),
  getTokenDecimalsFromDetails: vi.fn(() => 2),
  getTokenAmountFromToken: vi.fn((token: any) => token.amount || token.atoms || BigInt(0)),
}))

vi.mock('@/config/tokens', () => ({
  tokens: {},
}))

describe('chronik-transactions', () => {
  describe('isAgoraCanceled', () => {
    it('should return true for canceled transaction with OP_0', () => {
      const inputScript = '00' // OP_0
      expect(isAgoraCanceled(inputScript)).toBe(true)
    })

    it('should return false for non-canceled transaction', () => {
      const inputScript = '514d075041525449414c'
      expect(isAgoraCanceled(inputScript)).toBe(false)
    })

    it('should return false for empty input script', () => {
      expect(isAgoraCanceled('')).toBe(false)
    })

    it('should handle OP_PUSHDATA1 (0x4c)', () => {
      const inputScript = '4c0548656c6c6f' // OP_PUSHDATA1 + 5 bytes + "Hello"
      expect(isAgoraCanceled(inputScript)).toBe(false)
    })

    it('should handle OP_PUSHDATA2 (0x4d)', () => {
      const inputScript = '4d0500' + '00'.repeat(5) // OP_PUSHDATA2 + length + data
      expect(isAgoraCanceled(inputScript)).toBe(false)
    })

    it('should detect independent OP_0 in complex script', () => {
      const inputScript = '01ab00' // push 1 byte (0xab) + OP_0
      expect(isAgoraCanceled(inputScript)).toBe(true)
    })
  })

  describe('detectAgoraTokenId', () => {
    it('should detect valid Agora transaction and return tokenId', () => {
      const tx = createMockTransaction()
      const tokenId = detectAgoraTokenId(tx)
      expect(tokenId).toBe('mock-token-id')
    })

    it('should return null for transaction without required markers', () => {
      const tx = createMockTransaction({
        inputs: [{ inputScript: 'invalid' }],
      })
      const tokenId = detectAgoraTokenId(tx)
      expect(tokenId).toBe(null)
    })

    it('should return null for canceled transaction', () => {
      const tx = createCanceledTransaction()
      const tokenId = detectAgoraTokenId(tx)
      expect(tokenId).toBe(null)
    })

    it('should return null for transaction without token output', () => {
      const tx = createMockTransaction({
        outputs: [
          {},
          { sats: 100000 },
          {},
          {}, // No token
        ],
      })
      const tokenId = detectAgoraTokenId(tx)
      expect(tokenId).toBe(null)
    })

    it('should return null for transaction with zero token amount', () => {
      const tx = createMockTransaction({
        outputs: [
          {},
          { sats: 100000 },
          {},
          {
            token: {
              tokenId: 'mock-token-id',
              amount: BigInt(0),
            },
          },
        ],
      })
      const tokenId = detectAgoraTokenId(tx)
      expect(tokenId).toBe(null)
    })

    it('should handle transaction with missing inputs', () => {
      const tx = { ...createMockTransaction(), inputs: undefined }
      const tokenId = detectAgoraTokenId(tx)
      expect(tokenId).toBe(null)
    })

    it('should handle transaction with missing outputs', () => {
      const tx = { ...createMockTransaction(), outputs: undefined }
      const tokenId = detectAgoraTokenId(tx)
      expect(tokenId).toBe(null)
    })

    it('should handle null transaction', () => {
      const tokenId = detectAgoraTokenId(null)
      expect(tokenId).toBe(null)
    })

    it('should detect tokenId from output[2] if output[3] has no token', () => {
      const tx = createMockTransaction({
        outputs: [
          {},
          { sats: 100000 },
          {
            token: {
              tokenId: 'token-from-output-2',
              amount: BigInt(5000),
            },
          },
          {},
        ],
      })
      const tokenId = detectAgoraTokenId(tx)
      expect(tokenId).toBe('token-from-output-2')
    })

    it('should handle tokenIdHex field', () => {
      const tx = createMockTransaction({
        outputs: [
          {},
          { sats: 100000 },
          {},
          {
            token: {
              tokenIdHex: 'token-id-hex-format',
              amount: BigInt(1000),
            },
          },
        ],
      })
      const tokenId = detectAgoraTokenId(tx)
      expect(tokenId).toBe('token-id-hex-format')
    })

    it('should handle tokenIdStr field', () => {
      const tx = createMockTransaction({
        outputs: [
          {},
          { sats: 100000 },
          {},
          {
            token: {
              tokenIdStr: 'token-id-str-format',
              amount: BigInt(1000),
            },
          },
        ],
      })
      const tokenId = detectAgoraTokenId(tx)
      expect(tokenId).toBe('token-id-str-format')
    })

    it('should handle OP_PUSHDATA4 (0x4e)', () => {
      const inputScript = '4e05000000' + '00'.repeat(5) // OP_PUSHDATA4 + length + data
      expect(isAgoraCanceled(inputScript)).toBe(false)
    })

    it('should detect OP_0 at different positions', () => {
      expect(isAgoraCanceled('00')).toBe(true) // Start
      expect(isAgoraCanceled('01ab00')).toBe(true) // Middle
      expect(isAgoraCanceled('01ab00')).toBe(true) // End
    })
  })

  describe('processMatchedTransaction behavior', () => {
    it('should return null when xecOutput (outputs[1]) is missing', () => {
      const tx = createMockTransaction({
        outputs: [
          {},
          undefined, // Missing XEC output
          {},
          { token: { tokenId: 'test-token', amount: BigInt(1000) } },
        ],
      })

      const result = processMatchedTransaction(tx, 100)
      expect(result).toBe(null)
    })

    it('should prefer sats over value field for XEC amount', () => {
      const tx = createMockTransaction({
        outputs: [
          {},
          { sats: 50000, value: 99999 }, // sats should win
          {},
          { token: { tokenId: 'test', amount: BigInt(100000) } },
        ],
      })

      const result = processMatchedTransaction(tx, 100)
      expect(result).not.toBe(null)
      expect(result!.price).toBe((50000 / 1000) / 100) // 50000 sats / 1000 tokens / 100
    })

    it('should fallback to value when sats is undefined', () => {
      const tx = createMockTransaction({
        outputs: [
          {},
          { value: 30000 }, // Only value field
          {},
          { token: { tokenId: 'test', amount: BigInt(100000) } },
        ],
      })

      const result = processMatchedTransaction(tx, 100)
      expect(result).not.toBe(null)
      expect(result!.price).toBe((30000 / 1000) / 100)
    })

    it('should use 0 when both sats and value are missing', () => {
      const tx = createMockTransaction({
        outputs: [
          {},
          {}, // No sats or value
          {},
          { token: { tokenId: 'test', amount: BigInt(100000) } },
        ],
      })

      const result = processMatchedTransaction(tx, 100)
      expect(result).not.toBe(null)
      expect(result!.price).toBe(0)
    })

    it('should select earliest valid timestamp from block.timestamp and timeFirstSeen', () => {
      const now = Math.floor(Date.now() / 1000)

      const tx = createMockTransaction({
        block: { height: 800000, timestamp: now - 100 },
        timeFirstSeen: now - 50,
        outputs: [
          {},
          { sats: 10000 },
          {},
          { token: { tokenId: 'test', amount: BigInt(100000) } },
        ],
      })

      const result = processMatchedTransaction(tx, 100)
      expect(result!.timestamp).toBe(now - 100) // Should pick earlier one
    })

    it('should use timeFirstSeen when block.timestamp is missing', () => {
      const now = Math.floor(Date.now() / 1000)

      const tx = createMockTransaction({
        block: undefined,
        timeFirstSeen: now - 200,
        outputs: [
          {},
          { sats: 10000 },
          {},
          { token: { tokenId: 'test', amount: BigInt(100000) } },
        ],
      })

      const result = processMatchedTransaction(tx, 100)
      expect(result!.timestamp).toBe(now - 200)
    })

    it('should clamp future timestamps to current time', () => {
      const now = Math.floor(Date.now() / 1000)
      const futureTime = now + 10000

      const tx = createMockTransaction({
        block: { height: 800000, timestamp: futureTime },
        timeFirstSeen: futureTime + 5000,
        outputs: [
          {},
          { sats: 10000 },
          {},
          { token: { tokenId: 'test', amount: BigInt(100000) } },
        ],
      })

      const result = processMatchedTransaction(tx, 100)
      expect(result!.timestamp).toBeLessThanOrEqual(now + 1) // Allow 1 sec tolerance
    })

    it('should use fallback timestamp when all timestamps are invalid', () => {
      const now = Math.floor(Date.now() / 1000)

      const tx = createMockTransaction({
        block: { height: 800000, timestamp: -1 },
        timeFirstSeen: 0,
        outputs: [
          {},
          { sats: 10000 },
          {},
          { token: { tokenId: 'test', amount: BigInt(100000) } },
        ],
      })

      const result = processMatchedTransaction(tx, 100)
      expect(result!.timestamp).toBeGreaterThan(now - 5) // Should be close to now
    })

    it('should fallback to hash when txid is missing', () => {
      const tx = createMockTransaction({
        outputs: [
          {},
          { sats: 10000 },
          {},
          { token: { tokenId: 'test', amount: BigInt(100000) } },
        ],
      })
      delete (tx as any).txid
      ;(tx as any).hash = 'fallback-hash-value'

      const result = processMatchedTransaction(tx, 100)
      expect(result!.txid).toBe('fallback-hash-value')
    })

    it('should return null when both txid and hash are missing', () => {
      const tx = createMockTransaction({
        outputs: [
          {},
          { sats: 10000 },
          {},
          { token: { tokenId: 'test', amount: BigInt(100000) } },
        ],
      })
      delete (tx as any).txid
      delete (tx as any).hash

      const result = processMatchedTransaction(tx, 100)
      expect(result).toBe(null)
    })

    it('should return null when token amount is zero after division', () => {
      const tx = createMockTransaction({
        outputs: [
          {},
          { sats: 10000 },
          {},
          { token: { tokenId: 'test', amount: BigInt(0) } },
        ],
      })

      const result = processMatchedTransaction(tx, 100)
      expect(result).toBe(null)
    })

    it('should return null when token amount is negative', () => {
      const tx = createMockTransaction({
        outputs: [
          {},
          { sats: 10000 },
          {},
          { token: { tokenId: 'test', amount: BigInt(-1000) } },
        ],
      })

      const result = processMatchedTransaction(tx, 100)
      expect(result).toBe(null)
    })

    it('should return null when token amount becomes Infinity', () => {
      const tx = createMockTransaction({
        outputs: [
          {},
          { sats: 10000 },
          {},
          { token: { tokenId: 'test', amount: BigInt('99999999999999999999999999') } },
        ],
      })

      const result = processMatchedTransaction(tx, 0) // divisor = 0 causes Infinity
      expect(result).toBe(null)
    })
  })

  describe('fetchAgoraTransactionsFromChronik pagination', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should stop when reaching targetCount', async () => {
      const { fetchAgoraTransactionsFromChronik } = await import('@/lib/chronik-transactions')
      const mockChronik = {
        tokenId: vi.fn().mockReturnThis(),
        history: vi.fn()
          .mockResolvedValueOnce({
            txs: Array(5).fill(createMockTransaction()),
          })
          .mockResolvedValueOnce({
            txs: Array(5).fill(createMockTransaction()),
          }),
      }

      await fetchAgoraTransactionsFromChronik('test-token', undefined, { targetCount: 3 }, mockChronik as any)

      expect(mockChronik.history).toHaveBeenCalledTimes(1) // Should stop after first page
    })

    it('should stop when page returns fewer items than pageSize', async () => {
      const { fetchAgoraTransactionsFromChronik } = await import('@/lib/chronik-transactions')
      const mockChronik = {
        tokenId: vi.fn().mockReturnThis(),
        history: vi.fn().mockResolvedValueOnce({
          txs: Array(50).fill(createMockTransaction()), // Less than default pageSize (200)
        }),
      }

      await fetchAgoraTransactionsFromChronik('test-token', undefined, {}, mockChronik as any)

      expect(mockChronik.history).toHaveBeenCalledTimes(1)
    })

    it('should stop when maxBlocksBack threshold is reached', async () => {
      const { fetchAgoraTransactionsFromChronik } = await import('@/lib/chronik-transactions')
      const mockChronik = {
        tokenId: vi.fn().mockReturnThis(),
        history: vi.fn()
          .mockResolvedValueOnce({
            txs: [
              createMockTransaction({ block: { height: 800000, timestamp: 1000 } }),
              createMockTransaction({ block: { height: 799900, timestamp: 1000 } }),
            ],
          })
          .mockResolvedValueOnce({
            txs: [
              createMockTransaction({ block: { height: 799800, timestamp: 1000 } }), // Should be filtered
            ],
          }),
      }

      const result = await fetchAgoraTransactionsFromChronik(
        'test-token',
        undefined,
        { maxBlocksBack: 150, pageSize: 2 },
        mockChronik as any
      )

      expect(result.length).toBe(2) // Only first 2 txs within range
    })

    it('should stop when stopBelowHeight threshold is reached', async () => {
      const { fetchAgoraTransactionsFromChronik } = await import('@/lib/chronik-transactions')
      const mockChronik = {
        tokenId: vi.fn().mockReturnThis(),
        history: vi.fn().mockResolvedValueOnce({
          txs: [
            createMockTransaction({ block: { height: 800100, timestamp: 1000 } }),
            createMockTransaction({ block: { height: 800001, timestamp: 1000 } }),
            createMockTransaction({ block: { height: 799999, timestamp: 1000 } }), // Below threshold
          ],
        }),
      }

      const result = await fetchAgoraTransactionsFromChronik(
        'test-token',
        undefined,
        { stopBelowHeight: 800000, pageSize: 10 },
        mockChronik as any
      )

      expect(result.length).toBe(2)
    })

    it('should throw error when failOnError is true and fetch fails', async () => {
      const { fetchAgoraTransactionsFromChronik } = await import('@/lib/chronik-transactions')
      const mockChronik = {
        tokenId: vi.fn().mockReturnThis(),
        history: vi.fn().mockRejectedValue(new Error('Network error')),
      }

      await expect(
        fetchAgoraTransactionsFromChronik('test-token', undefined, { failOnError: true }, mockChronik as any)
      ).rejects.toThrow('Network error')
    })

    it('should return empty array when failOnError is false and fetch fails', async () => {
      const { fetchAgoraTransactionsFromChronik } = await import('@/lib/chronik-transactions')
      const mockChronik = {
        tokenId: vi.fn().mockReturnThis(),
        history: vi.fn().mockRejectedValue(new Error('Network error')),
      }

      const result = await fetchAgoraTransactionsFromChronik(
        'test-token',
        undefined,
        { failOnError: false },
        mockChronik as any
      )

      expect(result).toEqual([])
    })
  })
})
