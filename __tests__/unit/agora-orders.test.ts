import { describe, it, expect, vi, beforeEach } from 'vitest'
import { agoraPartialOffer, agoraHigherPriceOffer, agoraInvalidMakerPkOffer, agoraFallbackDecimalsOffer, agoraInvalidOffer } from '../fixtures/agora'

const mockActiveOffersByTokenId = vi.fn()
const mockActiveOffersByPubKey = vi.fn()
const mockFetchTokenDetails = vi.fn().mockResolvedValue({
  genesisInfo: { decimals: 2 },
})
const mockGetTokenDecimalsFromDetails = vi.fn(() => 2)

vi.mock('ecash-agora', () => ({
  Agora: vi.fn(function MockAgora() {
    return {
      activeOffersByTokenId: mockActiveOffersByTokenId,
      activeOffersByPubKey: mockActiveOffersByPubKey,
    }
  }),
}))

// Mock the dependencies before importing the module
vi.mock('@/lib/chronik', () => ({
  chronik: {},
  fetchTokenDetails: mockFetchTokenDetails,
  getTokenDecimalsFromDetails: mockGetTokenDecimalsFromDetails,
  getTokenAmountFromToken: vi.fn((token: any) => token.amount || token.atoms || BigInt(0)),
}))

vi.mock('ecashaddrjs', () => ({
  encodeCashAddress: vi.fn((prefix: string, type: string, hash: Uint8Array) =>
    `ecash:mock_address_${hash.length}`
  ),
}))

vi.mock('ecash-lib', () => ({
  shaRmd160: vi.fn((bytes: Uint8Array) => new Uint8Array(20)),
  mnemonicToSeed: vi.fn(() => new Uint8Array(32)),
  HdNode: {
    fromSeed: vi.fn(() => ({
      derivePath: vi.fn(() => ({
        pubkey: vi.fn(() => new Uint8Array(33)),
      })),
    })),
  },
}))

vi.mock('@/config/tokens', () => ({
  tokens: {
    mockToken: {
      tokenId: 'mock-token-id',
      decimals: 2,
    },
  },
}))

describe('agora-orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveOffersByTokenId.mockReset()
    mockActiveOffersByPubKey.mockReset()
    mockFetchTokenDetails.mockReset()
    mockFetchTokenDetails.mockResolvedValue({
      genesisInfo: { decimals: 2 },
    })
    mockGetTokenDecimalsFromDetails.mockReset()
    mockGetTokenDecimalsFromDetails.mockReturnValue(2)
  })

  describe('fetchAgoraOrderBook', () => {
    it('should return error for missing tokenId', async () => {
      const { fetchAgoraOrderBook } = await import('@/lib/agora-orders')
      const result = await fetchAgoraOrderBook('')
      expect(result.success).toBe(false)
      expect(result.error).toBe('tokenId is required')
    })

    it('should format valid offers and calculate stats', async () => {
      mockActiveOffersByTokenId.mockResolvedValue([agoraPartialOffer])

      const { fetchAgoraOrderBook } = await import('@/lib/agora-orders')
      const result = await fetchAgoraOrderBook('mock-token-id')

      expect(result.success).toBe(true)
      expect(result.data?.orders).toEqual([
        {
          price: 0.1,
          amount: 10000,
          total: 1000,
          makerAddress: 'ecash:mock_address_20',
        },
      ])
      expect(result.data?.stats).toEqual({
        count: 1,
        min_price: 0.1,
        max_price: 0.1,
        avg_price: 0.1,
        total_amount: 10000,
        total_value: 1000,
      })
    })

    it('should sort orders by descending price and compute aggregate stats', async () => {
      mockActiveOffersByTokenId.mockResolvedValue([agoraPartialOffer, agoraHigherPriceOffer])

      const { fetchAgoraOrderBook } = await import('@/lib/agora-orders')
      const result = await fetchAgoraOrderBook('mock-token-id')

      expect(result.success).toBe(true)
      expect(result.data?.orders).toEqual([
        {
          price: 0.3,
          amount: 5000,
          total: 1500,
          makerAddress: 'ecash:mock_address_20',
        },
        {
          price: 0.1,
          amount: 10000,
          total: 1000,
          makerAddress: 'ecash:mock_address_20',
        },
      ])
      expect(result.data?.stats).toEqual({
        count: 2,
        min_price: 0.1,
        max_price: 0.3,
        avg_price: 0.2,
        total_amount: 15000,
        total_value: 2500,
      })
    })

    it('should omit makerAddress when makerPk is invalid', async () => {
      mockActiveOffersByTokenId.mockResolvedValue([agoraInvalidMakerPkOffer])

      const { fetchAgoraOrderBook } = await import('@/lib/agora-orders')
      const result = await fetchAgoraOrderBook('mock-token-id')

      expect(result.success).toBe(true)
      expect(result.data?.orders).toEqual([
        {
          price: 0.1,
          amount: 10000,
          total: 1000,
          makerAddress: undefined,
        },
      ])
    })

    it('should use fetchTokenDetails decimals fallback for tokens missing from config', async () => {
      mockActiveOffersByTokenId.mockResolvedValue([agoraFallbackDecimalsOffer])
      mockFetchTokenDetails.mockResolvedValue({
        genesisInfo: { decimals: 3 },
      })
      mockGetTokenDecimalsFromDetails.mockReturnValue(3)

      const { fetchAgoraOrderBook } = await import('@/lib/agora-orders')
      const result = await fetchAgoraOrderBook('fallback-token-id')

      expect(result.success).toBe(true)
      expect(mockFetchTokenDetails).toHaveBeenCalledWith('fallback-token-id')
      expect(result.data?.orders).toEqual([
        {
          price: 0.19998915,
          amount: 1234.567,
          total: 246.9,
          makerAddress: 'ecash:mock_address_20',
        },
      ])
      expect(result.data?.stats).toEqual({
        count: 1,
        min_price: 0.19998915,
        max_price: 0.19998915,
        avg_price: 0.19998915,
        total_amount: 1234.567,
        total_value: 246.9,
      })
    })

    it('should filter invalid offers', async () => {
      mockActiveOffersByTokenId.mockResolvedValue([agoraPartialOffer, agoraInvalidOffer])

      const { fetchAgoraOrderBook } = await import('@/lib/agora-orders')
      const result = await fetchAgoraOrderBook('mock-token-id')

      expect(result.success).toBe(true)
      expect(result.data?.orders).toHaveLength(1)
      expect(result.data?.stats.count).toBe(1)
    })
  })

  describe('fetchUserListings', () => {
    it('returns raw atom amount and decimals for cancellation', async () => {
      mockActiveOffersByPubKey.mockResolvedValue([
        {
          ...agoraFallbackDecimalsOffer,
          status: 'OPEN',
        },
      ])
      mockFetchTokenDetails.mockResolvedValue({
        genesisInfo: {
          decimals: 3,
          tokenName: 'Fallback Token',
        },
      })
      mockGetTokenDecimalsFromDetails.mockReturnValue(3)

      const { fetchUserListings } = await import('@/lib/agora-orders')
      const result = await fetchUserListings('test mnemonic')

      expect(result.success).toBe(true)
      expect(mockActiveOffersByPubKey).toHaveBeenCalledWith(
        Buffer.from(new Uint8Array(33)).toString('hex'),
      )
      expect(result.data?.listings).toEqual([
        expect.objectContaining({
          tokenId: 'fallback-token-id',
          tokenName: 'Fallback Token',
          tokenDecimals: 3,
          amount: 1234.567,
          totalTokenAmountAtoms: 1234567n,
        }),
      ])
    })
  })
})
