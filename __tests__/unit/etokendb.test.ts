import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  fetchEtokenDbTokenCandles,
  fetchEtokenDbTopVolumeTokens,
  fetchEtokenDbTopVolumeTokenIds,
  fetchEtokenDbTokenSummary,
  getEtokenDbPriceChange24h,
  isEtokenDbAvailable,
  isEtokenDbAvailableWithRetry,
  mapEtokenDbTokenCandles,
  mapEtokenDbTokenSummary,
  nanosatsPerAtomToXec,
  resetEtokenDbAvailabilityCache,
  satsToXec,
} from "@/lib/etokendb"

describe("etokendb", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetEtokenDbAvailabilityCache()
  })

  it("converts sats to XEC using the 1:100 ratio", () => {
    expect(satsToXec("12345")).toBe(123.45)
  })

  it("converts nanosats per atom into XEC per token using decimals", () => {
    expect(nanosatsPerAtomToXec("1000000000", 2)).toBe(1)
  })

  it("prefers pct for price change and falls back to bps", () => {
    expect(getEtokenDbPriceChange24h("1.25", "200")).toEqual({
      value: 1.25,
      hasValue: true,
    })
    expect(getEtokenDbPriceChange24h(undefined, "250")).toEqual({
      value: 2.5,
      hasValue: true,
    })
  })

  it("maps upstream token summaries into table stats", () => {
    const mapped = mapEtokenDbTokenSummary(
      {
        ok: true,
        data: {
          summary: {
            tokenId: "c67bf5c2b6d91cfb46a5c1772582eff80d88686887be10aa63b0945479cf4ed4",
            latestPriceNanosatsPerAtom: "1000000000",
            recent144TradeCount: 92,
            recent144VolumeSats: "53000806969",
            recent144PriceChangePct: "1.25",
            recent1008TradeCount: 1013,
            recent1008VolumeSats: "858751562877",
            recent4320TradeCount: 3210,
            recent4320VolumeSats: "1599261652671",
            lastTradeBlockHeight: 944789,
            lastTradeBlockTimestamp: 1776194157,
            lastSyncedAt: 1776194900068,
          },
        },
      },
      { decimals: 2 },
    )

    expect(mapped).toEqual({
      tokenId: "c67bf5c2b6d91cfb46a5c1772582eff80d88686887be10aa63b0945479cf4ed4",
      tokenDecimals: 2,
      recent24hTradeCount: 92,
      recent7dTradeCount: 1013,
      recent30dTradeCount: 3210,
      last24HoursXECAmount: 530008069.69,
      last7DaysXECAmount: 8587515628.77,
      last30DaysVolumeXECAmount: 15992616526.71,
      latestPriceXec: 1,
      priceChange24h: 1.25,
      hasLatestPriceXec: true,
      hasPriceChange24h: true,
      has30DayVolume: true,
      lastTradeBlockHeight: 944789,
      lastTradeBlockTimestamp: 1776194157,
      lastSyncedAt: 1776194900068,
    })
  })

  it("maps upstream candle payloads into normalized chart candles", () => {
    const mapped = mapEtokenDbTokenCandles(
      {
        ok: true,
        data: {
          tokenId: "c67bf5c2b6d91cfb46a5c1772582eff80d88686887be10aa63b0945479cf4ed4",
          interval: "hour",
          timezone: "UTC",
          items: [
            {
              bucketStart: 1_710_000_000,
              bucketEnd: 1_710_003_600,
              openPriceNanosatsPerAtom: "1000000000",
              highPriceNanosatsPerAtom: "1200000000",
              lowPriceNanosatsPerAtom: "900000000",
              closePriceNanosatsPerAtom: "1100000000",
              tradeCount: 7,
              volumeSats: "12345",
              soldAtoms: "2500",
            },
          ],
        },
      },
      { decimals: 2 },
    )

    expect(mapped).toEqual({
      tokenId: "c67bf5c2b6d91cfb46a5c1772582eff80d88686887be10aa63b0945479cf4ed4",
      interval: "hour",
      timezone: "UTC",
      tokenDecimals: 2,
      items: [
        {
          bucketStart: 1_710_000_000_000,
          bucketEnd: 1_710_003_600_000,
          openPriceXec: 1,
          highPriceXec: 1.2,
          lowPriceXec: 0.9,
          closePriceXec: 1.1,
          tradeCount: 7,
          volumeXec: 123.45,
          soldTokenAmount: 25,
        },
      ],
    })
  })

  it("caches ready status checks", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          healthy: true,
          ready: true,
          phase: "ready",
        },
      }),
    })

    vi.stubGlobal("fetch", fetchMock)

    await expect(isEtokenDbAvailable()).resolves.toBe(true)
    await expect(isEtokenDbAvailable()).resolves.toBe(true)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith("/api/etokendb/status", expect.any(Object))
  })

  it("retries availability checks up to three times with force refresh", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            healthy: false,
            ready: false,
            phase: "bootstrapping",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            healthy: false,
            ready: false,
            phase: "bootstrapping",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            healthy: true,
            ready: true,
            phase: "ready",
          },
        }),
      })

    vi.stubGlobal("fetch", fetchMock)
    vi.useFakeTimers()

    const availabilityPromise = isEtokenDbAvailableWithRetry()
    await vi.advanceTimersByTimeAsync(2_000)

    await expect(availabilityPromise).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(3)

    vi.useRealTimers()
  })

  it("fetches and maps token summaries through the local proxy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            summary: {
              tokenId: "c67bf5c2b6d91cfb46a5c1772582eff80d88686887be10aa63b0945479cf4ed4",
              latestPriceNanosatsPerAtom: "1000000000",
              recent144TradeCount: 1,
              recent144VolumeSats: "100",
              recent144PriceChangeBps: "250",
              recent1008TradeCount: 2,
              recent1008VolumeSats: "450",
              recent4320TradeCount: "5",
              recent4320VolumeSats: "900",
              lastTradeBlockHeight: 10,
            },
          },
        }),
      }),
    )

    await expect(
      fetchEtokenDbTokenSummary(
        "c67bf5c2b6d91cfb46a5c1772582eff80d88686887be10aa63b0945479cf4ed4",
        { decimals: 2 },
      ),
    ).resolves.toMatchObject({
      tokenDecimals: 2,
      recent24hTradeCount: 1,
      recent7dTradeCount: 2,
      recent30dTradeCount: 5,
      last24HoursXECAmount: 1,
      last7DaysXECAmount: 4.5,
      last30DaysVolumeXECAmount: 9,
      latestPriceXec: 1,
      priceChange24h: 2.5,
      hasLatestPriceXec: true,
      hasPriceChange24h: true,
      has30DayVolume: true,
      lastTradeBlockHeight: 10,
    })
  })

  it("fetches token candles through the local proxy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            tokenId: "c67bf5c2b6d91cfb46a5c1772582eff80d88686887be10aa63b0945479cf4ed4",
            interval: "hour",
            timezone: "UTC",
            items: [
              {
                bucketStart: 1_710_000_000,
                bucketEnd: 1_710_003_600,
                openPriceNanosatsPerAtom: "1000000000",
                highPriceNanosatsPerAtom: "1100000000",
                lowPriceNanosatsPerAtom: "950000000",
                closePriceNanosatsPerAtom: "1050000000",
                tradeCount: 3,
                volumeSats: "1000",
                soldAtoms: "500",
              },
            ],
          },
        }),
      }),
    )

    await expect(
      fetchEtokenDbTokenCandles(
        "c67bf5c2b6d91cfb46a5c1772582eff80d88686887be10aa63b0945479cf4ed4",
        {
          interval: "hour",
          limit: 24,
          decimals: 2,
        },
      ),
    ).resolves.toMatchObject({
      interval: "hour",
      items: [
        {
          openPriceXec: 1,
          closePriceXec: 1.05,
          volumeXec: 10,
          tradeCount: 3,
        },
      ],
    })

    expect(fetch).toHaveBeenCalledWith(
      "/api/etokendb/tokens/c67bf5c2b6d91cfb46a5c1772582eff80d88686887be10aa63b0945479cf4ed4/candles?interval=hour&limit=24",
      expect.any(Object),
    )
  })

  it("fetches top-volume token ids through the local proxy and deduplicates them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            items: [
              {
                tokenId: "c67bf5c2b6d91cfb46a5c1772582eff80d88686887be10aa63b0945479cf4ed4",
              },
              {
                tokenId: "0387947fd575db4fb19a3e322f635dec37fd192b5941625b66bc4b2c3008cbf0",
              },
              {
                tokenId: "c67bf5c2b6d91cfb46a5c1772582eff80d88686887be10aa63b0945479cf4ed4",
              },
              {
                tokenId: "invalid",
              },
            ],
          },
        }),
      }),
    )

    await expect(fetchEtokenDbTopVolumeTokenIds()).resolves.toEqual([
      "c67bf5c2b6d91cfb46a5c1772582eff80d88686887be10aa63b0945479cf4ed4",
      "0387947fd575db4fb19a3e322f635dec37fd192b5941625b66bc4b2c3008cbf0",
    ])

    expect(fetch).toHaveBeenCalledWith(
      "/api/etokendb/tokens?sort=recent1008VolumeSats&order=desc&pageSize=100&readyOnly=true",
      expect.any(Object),
    )
  })

  it("fetches top-volume token summaries with 30d volume from the local proxy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            items: [
              {
                tokenId: "c67bf5c2b6d91cfb46a5c1772582eff80d88686887be10aa63b0945479cf4ed4",
                latestPriceNanosatsPerAtom: "1000000000",
                recent144TradeCount: 95,
                recent144VolumeSats: "77972521579",
                recent144PriceChangePct: "0.00",
                recent1008TradeCount: 930,
                recent1008VolumeSats: "903967987245",
                recent4320TradeCount: 3169,
                recent4320VolumeSats: "1638942806186",
                lastTradeBlockHeight: 944859,
                lastTradeBlockTimestamp: 1776231035,
                lastSyncedAt: 1776231053158,
              },
            ],
          },
        }),
      }),
    )

    await expect(fetchEtokenDbTopVolumeTokens()).resolves.toEqual([
      {
        tokenId: "c67bf5c2b6d91cfb46a5c1772582eff80d88686887be10aa63b0945479cf4ed4",
        recent24hTradeCount: 95,
        recent7dTradeCount: 930,
        recent30dTradeCount: 3169,
        last24HoursXECAmount: 779725215.79,
        last7DaysXECAmount: 9039679872.45,
        last30DaysVolumeXECAmount: 16389428061.86,
        latestPriceNanosatsPerAtom: 1000000000,
        priceChange24h: 0,
        hasLatestPrice: true,
        hasPriceChange24h: true,
        has30DayVolume: true,
        lastTradeBlockHeight: 944859,
        lastTradeBlockTimestamp: 1776231035,
        lastSyncedAt: 1776231053158,
      },
    ])
  })
})
