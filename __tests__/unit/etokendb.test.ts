import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  fetchEtokenDbTopVolumeTokenIds,
  fetchEtokenDbTokenSummary,
  getEtokenDbPriceChange24h,
  isEtokenDbAvailable,
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
      last24HoursXECAmount: 530008069.69,
      last7DaysXECAmount: 8587515628.77,
      latestPriceXec: 1,
      priceChange24h: 1.25,
      hasLatestPriceXec: true,
      hasPriceChange24h: true,
      lastTradeBlockHeight: 944789,
      lastTradeBlockTimestamp: 1776194157,
      lastSyncedAt: 1776194900068,
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
      last24HoursXECAmount: 1,
      last7DaysXECAmount: 4.5,
      latestPriceXec: 1,
      priceChange24h: 2.5,
      hasLatestPriceXec: true,
      hasPriceChange24h: true,
      lastTradeBlockHeight: 10,
    })
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
      "/api/etokendb/tokens?sort=recent1008VolumeSats&order=desc&pageSize=25&readyOnly=true",
      expect.any(Object),
    )
  })
})
