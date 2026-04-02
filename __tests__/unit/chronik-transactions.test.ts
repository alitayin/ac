import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isAgoraCanceled, detectAgoraTokenId } from '@/lib/chronik-transactions'
import { createMockTransaction, createCanceledTransaction } from '../helpers/mocks'

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
  })
})
