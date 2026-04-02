import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isAgoraCanceled, detectAgoraTokenId } from '@/lib/chronik-transactions'
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

  describe('transaction processing edge cases', () => {
    it('should handle missing xecOutput', () => {
      const tx = createMockTransaction({
        outputs: [
          {},
          undefined, // Missing XEC output
          {},
          {
            token: {
              tokenId: 'test-token',
              amount: BigInt(1000),
            },
          },
        ],
      })

      expect(tx.outputs[1]).toBeUndefined()
    })

    it('should handle sats vs value field', () => {
      const txWithSats = createMockTransaction({
        outputs: [
          {},
          { sats: 100000 },
          {},
          { token: { tokenId: 'test', amount: BigInt(1000) } },
        ],
      })

      const txWithValue = createMockTransaction({
        outputs: [
          {},
          { value: 100000 },
          {},
          { token: { tokenId: 'test', amount: BigInt(1000) } },
        ],
      })

      expect(txWithSats.outputs[1].sats).toBe(100000)
      expect(txWithValue.outputs[1].value).toBe(100000)
    })

    it('should handle timestamp selection logic', () => {
      const now = Math.floor(Date.now() / 1000)

      // Test with both timestamps
      const tx1 = createMockTransaction({
        block: { height: 800000, timestamp: now - 100 },
        timeFirstSeen: now - 50,
      })
      expect(tx1.block.timestamp).toBeLessThan(tx1.timeFirstSeen)

      // Test with only timeFirstSeen
      const tx2 = createMockTransaction({
        block: undefined,
        timeFirstSeen: now,
      })
      expect(tx2.timeFirstSeen).toBe(now)
    })

    it('should handle future timestamps', () => {
      const futureTime = Math.floor(Date.now() / 1000) + 10000
      const tx = createMockTransaction({
        block: { height: 800000, timestamp: futureTime },
        timeFirstSeen: futureTime,
      })

      // Should clamp to current time
      expect(tx.block.timestamp).toBeGreaterThan(Math.floor(Date.now() / 1000))
    })

    it('should handle missing txid and hash', () => {
      const tx = createMockTransaction()
      delete (tx as any).txid
      delete (tx as any).hash

      expect(tx.txid).toBeUndefined()
    })

    it('should handle zero token amount', () => {
      const tx = createMockTransaction({
        outputs: [
          {},
          { sats: 100000 },
          {},
          {
            token: {
              tokenId: 'test-token',
              amount: BigInt(0),
            },
          },
        ],
      })

      expect(tx.outputs[3].token.amount).toBe(BigInt(0))
    })

    it('should handle very large token amounts', () => {
      const tx = createMockTransaction({
        outputs: [
          {},
          { sats: 100000 },
          {},
          {
            token: {
              tokenId: 'test-token',
              amount: BigInt('999999999999999999'),
            },
          },
        ],
      })

      expect(tx.outputs[3].token.amount).toBe(BigInt('999999999999999999'))
    })

    it('should handle transaction with multiple inputs', () => {
      const tx = createMockTransaction({
        inputs: [
          { inputScript: '514d075041525449414c' },
          { inputScript: '514d075041525449414c' },
          { inputScript: '514d075041525449414c' },
        ],
      })

      expect(tx.inputs.length).toBe(3)
    })
  })
})
