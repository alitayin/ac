import { beforeEach, describe, expect, it, vi } from "vitest"

import { createMockProcessedTransaction } from "../helpers/mocks"
import { getCachedTokenData, getCachedTokenSummary } from "@/lib/token-stats"

const {
  mockFetchBlockchainInfo,
  mockFetchAgoraTransactionsFromChronik,
  mockFetchEtokenDbTokenSummary,
} = vi.hoisted(() => ({
  mockFetchBlockchainInfo: vi.fn(),
  mockFetchAgoraTransactionsFromChronik: vi.fn(),
  mockFetchEtokenDbTokenSummary: vi.fn(),
}))

vi.mock("@/lib/chronik", () => ({
  fetchBlockchainInfo: mockFetchBlockchainInfo,
}))

vi.mock("@/lib/chronik-transactions", () => ({
  fetchAgoraTransactionsFromChronik: mockFetchAgoraTransactionsFromChronik,
}))

vi.mock("@/lib/etokendb", async () => {
  const actual = await vi.importActual<typeof import("@/lib/etokendb")>("@/lib/etokendb")
  return {
    ...actual,
    fetchEtokenDbTokenSummary: mockFetchEtokenDbTokenSummary,
  }
})

import {
  loadTokenPageStats,
  mapEtokenDbSummaryToTokenPageStats,
} from "@/lib/token-page-stats"

describe("token-page-stats", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it("maps etokendb summary fields into detail page stats", () => {
    expect(
      mapEtokenDbSummaryToTokenPageStats(
        {
          tokenId: "a".repeat(64),
          tokenDecimals: 4,
          recent24hTradeCount: 7,
          recent7dTradeCount: 35,
          recent30dTradeCount: 91,
          last24HoursXECAmount: 123.45,
          last7DaysXECAmount: 456.78,
          last30DaysVolumeXECAmount: 789.01,
          latestPriceXec: 1.25,
          priceChange24h: -2.5,
          hasLatestPriceXec: true,
          hasPriceChange24h: true,
          has30DayVolume: true,
          lastTradeBlockHeight: 900000,
          lastTradeBlockTimestamp: 1776231035,
          lastSyncedAt: 1776231053158,
        },
        {
          tokenId: "a".repeat(64),
          tokenName: "Alpha",
        },
      ),
    ).toEqual({
      latestPrice: 1.25,
      priceChange24h: -2.5,
      last24HoursXECAmount: 123.45,
      last30DaysXECAmount: 789.01,
      totalTransactions: 91,
      totalXECAmount: 789.01,
      tokenId: "a".repeat(64),
      tokenName: "Alpha",
    })
  })

  it("prefers etokendb summary and skips Chronik scanning when available", async () => {
    const tokenId = "b".repeat(64)
    mockFetchEtokenDbTokenSummary.mockResolvedValue({
      tokenId,
      tokenDecimals: 2,
      recent24hTradeCount: 5,
      recent7dTradeCount: 20,
      recent30dTradeCount: 60,
      last24HoursXECAmount: 321,
      last7DaysXECAmount: 654,
      last30DaysVolumeXECAmount: 987,
      latestPriceXec: 4.2,
      priceChange24h: 1.1,
      hasLatestPriceXec: true,
      hasPriceChange24h: true,
      has30DayVolume: true,
      lastTradeBlockHeight: 944000,
      lastTradeBlockTimestamp: 1776231035,
      lastSyncedAt: 1776231053158,
    })

    const result = await loadTokenPageStats({
      tokenId,
      tokenName: "Beta",
      chainTipHeight: 944500,
      etokenDbAvailable: true,
      tokenDecimals: 2,
    })

    expect(result).toEqual({
      source: "etokendb",
      nextChainTipHeight: 944500,
      stats: {
        latestPrice: 4.2,
        priceChange24h: 1.1,
        last24HoursXECAmount: 321,
        last30DaysXECAmount: 987,
        totalTransactions: 60,
        totalXECAmount: 987,
        tokenId,
        tokenName: "Beta",
      },
    })
    expect(mockFetchEtokenDbTokenSummary).toHaveBeenCalledWith(tokenId, {
      decimals: 2,
    })
    expect(mockFetchBlockchainInfo).not.toHaveBeenCalled()
    expect(mockFetchAgoraTransactionsFromChronik).not.toHaveBeenCalled()
    expect(getCachedTokenSummary(tokenId)).toBe(null)
  })

  it("falls back to Chronik when etokendb summary fetch fails", async () => {
    const tokenId = "c".repeat(64)
    const tx24h = [
      createMockProcessedTransaction({
        txid: "tx-24h-1",
        price: 2,
        amount: 3,
        timestamp: 2000,
        blockHeight: 995,
      }),
      createMockProcessedTransaction({
        txid: "tx-24h-2",
        price: 1,
        amount: 5,
        timestamp: 1900,
        blockHeight: 994,
      }),
    ]
    const tx30d = [
      ...tx24h,
      createMockProcessedTransaction({
        txid: "tx-30d-1",
        price: 3,
        amount: 1,
        timestamp: 1000,
        blockHeight: 980,
      }),
    ]

    mockFetchEtokenDbTokenSummary.mockRejectedValue(new Error("summary failed"))
    mockFetchBlockchainInfo.mockResolvedValue({ tipHeight: 1000 })
    mockFetchAgoraTransactionsFromChronik.mockImplementation(
      async (_tokenId, onBatch, options) => {
        if (typeof onBatch === "function") {
          onBatch(tx24h)
          return []
        }
        if (options?.maxBlocksBack === 144 * 30) {
          return tx30d
        }
        return []
      },
    )

    const result = await loadTokenPageStats({
      tokenId,
      tokenName: "Gamma",
      chainTipHeight: null,
      etokenDbAvailable: true,
    })

    expect(result).toEqual({
      source: "chronik",
      nextChainTipHeight: 1000,
      stats: {
        latestPrice: 2,
        priceChange24h: 100,
        last24HoursXECAmount: 11,
        last30DaysXECAmount: 14,
        totalTransactions: 3,
        totalXECAmount: 14,
        tokenId,
        tokenName: "Gamma",
      },
    })
    expect(mockFetchAgoraTransactionsFromChronik).toHaveBeenCalledTimes(2)
    expect(getCachedTokenData(tokenId)).toMatchObject({
      last30DaysXECAmount: 14,
      totalTransactions: 3,
    })
    expect(getCachedTokenSummary(tokenId)).toBe(null)
  })

  it("stores summary cache only for Chronik mode", async () => {
    const tokenId = "d".repeat(64)
    const tx24h = [
      createMockProcessedTransaction({
        txid: "tx-cache-1",
        price: 0.5,
        amount: 10,
        timestamp: 2000,
        blockHeight: 995,
      }),
    ]

    mockFetchBlockchainInfo.mockResolvedValue({ tipHeight: 1000 })
    mockFetchAgoraTransactionsFromChronik.mockImplementation(
      async (_tokenId, onBatch) => {
        if (typeof onBatch === "function") {
          onBatch(tx24h)
          return []
        }
        return tx24h
      },
    )

    const result = await loadTokenPageStats({
      tokenId,
      tokenName: "Delta",
      chainTipHeight: null,
      etokenDbAvailable: false,
    })

    expect(result.source).toBe("chronik")
    expect(getCachedTokenSummary(tokenId)).toMatchObject({
      data: {
        latestPrice: 0.5,
        last24HoursXECAmount: 5,
        last30DaysXECAmount: 5,
        totalTransactions: 1,
        tokenId,
        tokenName: "Delta",
      },
    })
  })
})
