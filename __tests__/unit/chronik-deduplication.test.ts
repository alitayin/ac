import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockToken } = vi.hoisted(() => ({
  mockToken: vi.fn(),
}))

vi.mock("chronik-client", () => ({
  ChronikClient: class MockChronikClient {
    token = mockToken
    blockchainInfo = vi.fn()
    tokenId = vi.fn()
    address = vi.fn()
  },
}))

import {
  clearTokenDetailsCache,
  fetchTokenDetails,
  getCachedTokenDetails,
} from "@/lib/chronik"

describe("chronik token details cache", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    clearTokenDetailsCache()
  })

  it("fetches token details from Chronik when cache is empty", async () => {
    const mockTokenData = {
      tokenId: "test-token-123",
      genesisInfo: {
        tokenName: "Test Token",
        decimals: 2,
      },
    }

    mockToken.mockResolvedValueOnce(mockTokenData)

    await expect(fetchTokenDetails("test-token-123")).resolves.toEqual(mockTokenData)
    expect(mockToken).toHaveBeenCalledTimes(1)
    expect(mockToken).toHaveBeenCalledWith("test-token-123")
  })

  it("returns cached token details without a second Chronik request", async () => {
    const mockTokenData = {
      tokenId: "test-token-456",
      genesisInfo: {
        tokenName: "Cached Token",
        decimals: 4,
      },
    }

    mockToken.mockResolvedValueOnce(mockTokenData)

    await fetchTokenDetails("test-token-456")
    mockToken.mockClear()

    await expect(fetchTokenDetails("test-token-456")).resolves.toEqual(mockTokenData)
    expect(mockToken).not.toHaveBeenCalled()
  })

  it("deduplicates concurrent requests for the same token", async () => {
    const mockTokenData = {
      tokenId: "test-token-789",
      genesisInfo: {
        tokenName: "Concurrent Token",
        decimals: 8,
      },
    }

    mockToken.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(mockTokenData), 50)
        }),
    )

    const [result1, result2, result3] = await Promise.all([
      fetchTokenDetails("test-token-789"),
      fetchTokenDetails("test-token-789"),
      fetchTokenDetails("test-token-789"),
    ])

    expect(mockToken).toHaveBeenCalledTimes(1)
    expect(result1).toEqual(mockTokenData)
    expect(result2).toEqual(mockTokenData)
    expect(result3).toEqual(mockTokenData)
  })

  it("handles different token ids independently", async () => {
    const mockTokenData1 = {
      tokenId: "token-1",
      genesisInfo: { tokenName: "Token 1", decimals: 2 },
    }
    const mockTokenData2 = {
      tokenId: "token-2",
      genesisInfo: { tokenName: "Token 2", decimals: 4 },
    }

    mockToken
      .mockResolvedValueOnce(mockTokenData1)
      .mockResolvedValueOnce(mockTokenData2)

    const [result1, result2] = await Promise.all([
      fetchTokenDetails("token-1"),
      fetchTokenDetails("token-2"),
    ])

    expect(mockToken).toHaveBeenCalledTimes(2)
    expect(result1).toEqual(mockTokenData1)
    expect(result2).toEqual(mockTokenData2)
  })

  it("clears both in-memory and storage-backed token detail cache", async () => {
    const mockTokenData = {
      tokenId: "cache-test-token",
      genesisInfo: {
        tokenName: "Cache Test",
        decimals: 2,
      },
    }

    mockToken.mockResolvedValueOnce(mockTokenData)
    await fetchTokenDetails("cache-test-token")

    expect(getCachedTokenDetails("cache-test-token")).toEqual(mockTokenData)

    clearTokenDetailsCache()

    expect(getCachedTokenDetails("cache-test-token")).toBe(null)
  })
})
