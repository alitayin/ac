import { beforeEach, describe, expect, it, vi } from "vitest"

const VALID_TOKEN_ID =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

const {
  mockFetchEtokenDbTokenCandles,
  mockFetchHourlyData,
} = vi.hoisted(() => ({
  mockFetchEtokenDbTokenCandles: vi.fn(),
  mockFetchHourlyData: vi.fn(),
}))

vi.mock("@/lib/etokendb", () => ({
  fetchEtokenDbTokenCandles: mockFetchEtokenDbTokenCandles,
}))

vi.mock("@/lib/hourly-cache", () => ({
  fetchHourlyData: mockFetchHourlyData,
}))

import {
  clearTokenChartCache,
  fetchTokenChartSeries,
  fillTokenChartPoints,
  getTokenChartRequest,
  mapChronikHourlyDataToTokenChartPoints,
} from "@/lib/token-chart-data"

describe("token chart data", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearTokenChartCache()
  })

  it("maps chart ranges to etokendb candle intervals and limits", () => {
    expect(getTokenChartRequest("72h")).toEqual({
      interval: "hour",
      limit: 72,
      hours: 72,
    })
    expect(getTokenChartRequest("60d")).toEqual({
      interval: "day",
      limit: 60,
      hours: 1440,
    })
  })

  it("fills missing buckets with zero volume and previous close", () => {
    const points = fillTokenChartPoints(
      [
        {
          bucketStart: 1_710_000_000_000,
          bucketEnd: 1_710_003_600_000,
          volumeXec: 10,
          tradeCount: 2,
          openPriceXec: 1,
          highPriceXec: 1.2,
          lowPriceXec: 0.9,
          closePriceXec: 1.1,
        },
        {
          bucketStart: 1_710_007_200_000,
          bucketEnd: 1_710_010_800_000,
          volumeXec: 5,
          tradeCount: 1,
          openPriceXec: 1.1,
          highPriceXec: 1.3,
          lowPriceXec: 1.05,
          closePriceXec: 1.25,
        },
      ],
      "hour",
      3,
    )

    expect(points).toEqual([
      expect.objectContaining({
        bucketStart: 1_710_000_000_000,
        volumeXec: 10,
        closePriceXec: 1.1,
      }),
      expect.objectContaining({
        bucketStart: 1_710_003_600_000,
        volumeXec: 0,
        tradeCount: 0,
        openPriceXec: 1.1,
        closePriceXec: 1.1,
      }),
      expect.objectContaining({
        bucketStart: 1_710_007_200_000,
        volumeXec: 5,
        closePriceXec: 1.25,
      }),
    ])
  })

  it("uses the first known price for leading empty buckets instead of zero", () => {
    const points = fillTokenChartPoints(
      [
        {
          bucketStart: 1_710_007_200_000,
          bucketEnd: 1_710_010_800_000,
          volumeXec: 5,
          tradeCount: 1,
          openPriceXec: 1.2,
          highPriceXec: 1.3,
          lowPriceXec: 1.1,
          closePriceXec: 1.25,
        },
      ],
      "hour",
      3,
    )

    expect(points).toEqual([
      expect.objectContaining({
        bucketStart: 1_710_000_000_000,
        volumeXec: 0,
        tradeCount: 0,
        openPriceXec: 1.2,
        closePriceXec: 1.2,
      }),
      expect.objectContaining({
        bucketStart: 1_710_003_600_000,
        volumeXec: 0,
        tradeCount: 0,
        openPriceXec: 1.2,
        closePriceXec: 1.2,
      }),
      expect.objectContaining({
        bucketStart: 1_710_007_200_000,
        volumeXec: 5,
        closePriceXec: 1.25,
      }),
    ])
  })

  it("aggregates chronik hourly rows into daily token chart points", () => {
    const points = mapChronikHourlyDataToTokenChartPoints(
      [
        {
          date: "2026-04-20 10:00",
          amount: 500,
          matchedTxCount: 2,
          averagePrice: 1,
          latestPrice: 1.1,
        },
        {
          date: "2026-04-20 12:00",
          amount: 300,
          matchedTxCount: 1,
          averagePrice: 1.05,
          latestPrice: 1.2,
        },
      ],
      "day",
    )

    expect(points).toEqual([
      expect.objectContaining({
        volumeXec: 8,
        tradeCount: 3,
        openPriceXec: 1,
        highPriceXec: 1.2,
        lowPriceXec: 1,
        closePriceXec: 1.2,
      }),
    ])
  })

  it("prefers etokendb candles and caches the result", async () => {
    mockFetchEtokenDbTokenCandles.mockResolvedValue({
      tokenId: VALID_TOKEN_ID,
      interval: "hour",
      tokenDecimals: 2,
      timezone: "UTC",
      items: [
        {
          bucketStart: 1_710_000_000_000,
          bucketEnd: 1_710_003_600_000,
          volumeXec: 10,
          tradeCount: 2,
          openPriceXec: 1,
          highPriceXec: 1.1,
          lowPriceXec: 0.9,
          closePriceXec: 1.05,
          soldTokenAmount: 100,
        },
      ],
    })

    const first = await fetchTokenChartSeries(VALID_TOKEN_ID, "24h")
    const second = await fetchTokenChartSeries(VALID_TOKEN_ID, "24h")

    expect(first.source).toBe("etokendb")
    expect(first.points).toHaveLength(24)
    expect(second.source).toBe("etokendb")
    expect(mockFetchEtokenDbTokenCandles).toHaveBeenCalledTimes(1)
    expect(mockFetchHourlyData).not.toHaveBeenCalled()
  })

  it("falls back to chronik aggregation when etokendb is unavailable", async () => {
    mockFetchEtokenDbTokenCandles.mockRejectedValue(new Error("offline"))
    mockFetchHourlyData.mockResolvedValue([
      {
        date: "2026-04-20 10:00",
        amount: 500,
        matchedTxCount: 2,
        totalTxCount: 2,
        averagePrice: 1,
        latestPrice: 1.1,
      },
      {
        date: "2026-04-20 11:00",
        amount: 300,
        matchedTxCount: 1,
        totalTxCount: 1,
        averagePrice: 1.1,
        latestPrice: 1.2,
      },
    ])

    const result = await fetchTokenChartSeries(VALID_TOKEN_ID, "72h")

    expect(result.source).toBe("chronik")
    expect(result.interval).toBe("hour")
    expect(result.points).toHaveLength(72)
    expect(result.points.at(-1)).toEqual(
      expect.objectContaining({
        volumeXec: 3,
        tradeCount: 1,
        closePriceXec: 1.2,
      }),
    )
  })
})
