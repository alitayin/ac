import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock chronik
const mockFetchTokenDetails = vi.fn()

vi.mock('@/lib/chronik', () => ({
  fetchTokenDetails: mockFetchTokenDetails
}))

vi.mock('@/lib/context/ChronikContext', () => ({
  useChronik: () => ({
    chronik: {}
  })
}))

describe('AllEtokensView Batch Fetching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should batch fetch token details for multiple tokens', async () => {
    const tokenIds = ['token-1', 'token-2', 'token-3']
    const mockTokenData = (id: string) => ({
      genesisInfo: {
        tokenTicker: `${id}-ticker`,
        tokenName: `${id}-name`,
        decimals: 2,
        url: `https://${id}.com`
      }
    })

    mockFetchTokenDetails
      .mockResolvedValueOnce(mockTokenData('token-1'))
      .mockResolvedValueOnce(mockTokenData('token-2'))
      .mockResolvedValueOnce(mockTokenData('token-3'))

    // Simulate batch fetching
    const results = await Promise.all(
      tokenIds.map(id => mockFetchTokenDetails(id, {}))
    )

    expect(mockFetchTokenDetails).toHaveBeenCalledTimes(3)
    expect(results).toHaveLength(3)
    expect(results[0].genesisInfo.tokenName).toBe('token-1-name')
    expect(results[1].genesisInfo.tokenName).toBe('token-2-name')
    expect(results[2].genesisInfo.tokenName).toBe('token-3-name')
  })

  it('should handle partial failures in batch fetch', async () => {
    const tokenIds = ['token-1', 'token-2', 'token-3']
    const mockTokenData = (id: string) => ({
      genesisInfo: {
        tokenTicker: `${id}-ticker`,
        tokenName: `${id}-name`,
        decimals: 2,
        url: `https://${id}.com`
      }
    })

    mockFetchTokenDetails
      .mockResolvedValueOnce(mockTokenData('token-1'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockTokenData('token-3'))

    // Simulate batch fetching with error handling
    const results = await Promise.allSettled(
      tokenIds.map(id => mockFetchTokenDetails(id, {}))
    )

    expect(results[0].status).toBe('fulfilled')
    expect(results[1].status).toBe('rejected')
    expect(results[2].status).toBe('fulfilled')

    if (results[0].status === 'fulfilled') {
      expect(results[0].value.genesisInfo.tokenName).toBe('token-1-name')
    }
    if (results[2].status === 'fulfilled') {
      expect(results[2].value.genesisInfo.tokenName).toBe('token-3-name')
    }
  })

  it('should verify sequential vs parallel fetch performance', async () => {
    const tokenIds = ['token-1', 'token-2', 'token-3']
    const mockTokenData = (id: string) => ({
      genesisInfo: {
        tokenTicker: `${id}-ticker`,
        tokenName: `${id}-name`,
        decimals: 2,
        url: `https://${id}.com`
      }
    })

    // Mock with delay to simulate network
    mockFetchTokenDetails.mockImplementation((id: string) =>
      new Promise(resolve => setTimeout(() => resolve(mockTokenData(id)), 50))
    )

    const startParallel = Date.now()
    await Promise.all(tokenIds.map(id => mockFetchTokenDetails(id, {})))
    const parallelTime = Date.now() - startParallel

    mockFetchTokenDetails.mockClear()

    const startSequential = Date.now()
    for (const id of tokenIds) {
      await mockFetchTokenDetails(id, {})
    }
    const sequentialTime = Date.now() - startSequential

    // Parallel should be significantly faster
    expect(parallelTime).toBeLessThan(sequentialTime)
    expect(sequentialTime).toBeGreaterThanOrEqual(150) // 3 * 50ms
    expect(parallelTime).toBeLessThan(100) // Should be close to 50ms
  })

  it('should handle empty token list', async () => {
    const tokenIds: string[] = []

    const results = await Promise.all(
      tokenIds.map(id => mockFetchTokenDetails(id, {}))
    )

    expect(results).toHaveLength(0)
    expect(mockFetchTokenDetails).not.toHaveBeenCalled()
  })

  it('should deduplicate token IDs in batch', async () => {
    const tokenIds = ['token-1', 'token-1', 'token-2']
    const uniqueIds = [...new Set(tokenIds)]

    const mockTokenData = (id: string) => ({
      genesisInfo: {
        tokenTicker: `${id}-ticker`,
        tokenName: `${id}-name`,
        decimals: 2,
        url: `https://${id}.com`
      }
    })

    mockFetchTokenDetails
      .mockResolvedValueOnce(mockTokenData('token-1'))
      .mockResolvedValueOnce(mockTokenData('token-2'))

    const results = await Promise.all(
      uniqueIds.map(id => mockFetchTokenDetails(id, {}))
    )

    // Should only fetch unique tokens
    expect(mockFetchTokenDetails).toHaveBeenCalledTimes(2)
    expect(results).toHaveLength(2)
  })
})
