import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { EMPTY_AGORA_STATS, buildAgoraStatsViewModel } from "@/lib/agora-stats"

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  })
}

describe("agora-stats", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe("buildAgoraStatsViewModel", () => {
    it("returns empty stats when no payload is available", () => {
      expect(buildAgoraStatsViewModel()).toEqual(EMPTY_AGORA_STATS)
    })

    it("uses the latest dated entry from each series even if the payload is unsorted", () => {
      const stats = buildAgoraStatsViewModel({
        dailyVolume: [
          {
            date: "2026-04-10T00:00:00.000Z",
            xecx: 0,
            firma: 0,
            other: 0,
            total: 1000,
          },
          {
            date: "2026-04-09T00:00:00.000Z",
            xecx: 0,
            firma: 0,
            other: 0,
            total: 400,
          },
        ],
        cumulativeVolume: [
          {
            date: "2026-04-10T00:00:00.000Z",
            xecx: 0,
            firma: 0,
            other: 0,
            total: 5000,
          },
          {
            date: "2026-04-09T00:00:00.000Z",
            xecx: 0,
            firma: 0,
            other: 0,
            total: 4000,
          },
        ],
        genesisData: [
          {
            date: "2026-04-10T00:00:00.000Z",
            genesis_alp_standard: 1,
            genesis_slp_fungible: 1,
            genesis_slp_mint_vault: 0,
            genesis_slp_nft1_group: 0,
            genesis_slp_nft1_child: 0,
          },
          {
            date: "2026-04-09T00:00:00.000Z",
            genesis_alp_standard: 1,
            genesis_slp_fungible: 0,
            genesis_slp_mint_vault: 0,
            genesis_slp_nft1_group: 0,
            genesis_slp_nft1_child: 0,
          },
        ],
        volumeUSD: [
          {
            date: "2026-04-10T00:00:00.000Z",
            usd: 250,
            xecx_usd: 0,
            firma_usd: 0,
            other_usd: 0,
          },
          {
            date: "2026-04-09T00:00:00.000Z",
            usd: 100,
            xecx_usd: 0,
            firma_usd: 0,
            other_usd: 0,
          },
        ],
      })

      expect(stats).toEqual({
        dailyVolume: "10.00",
        dailyVolumeChange: 150,
        totalVolume: "50.00",
        totalVolumeChange: 25,
        newTokens: "2",
        newTokensChange: 100,
        volumeUSD: "$250.00",
        volumeUSDChange: 150,
      })
    })
  })

  describe("route handler", () => {
    it("forces runtime fetching instead of build-time static output", async () => {
      const route = await import("@/app/api/agora-stats/route")

      expect(route.dynamic).toBe("force-dynamic")
      expect(route.revalidate).toBe(0)
    })

    it("returns partial data with warnings when one upstream chart fails", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse([
            {
              date: "2026-04-10T00:00:00.000Z",
              xecx: 1,
              firma: 2,
              other: 3,
              total: 6,
            },
          ]),
        )
        .mockResolvedValueOnce(
          jsonResponse([
            {
              date: "2026-04-10T00:00:00.000Z",
              xecx: 10,
              firma: 20,
              other: 30,
              total: 60,
            },
          ]),
        )
        .mockRejectedValueOnce(new Error("genesis endpoint down"))
        .mockResolvedValueOnce(
          jsonResponse([
            {
              date: "2026-04-10T00:00:00.000Z",
              usd: 12,
              xecx_usd: 1,
              firma_usd: 2,
              other_usd: 3,
            },
          ]),
        )

      vi.stubGlobal("fetch", fetchMock)

      const { GET } = await import("@/app/api/agora-stats/route")
      const response = await GET()
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0")
      expect(payload.dailyVolume).toHaveLength(1)
      expect(payload.cumulativeVolume).toHaveLength(1)
      expect(payload.genesisData).toEqual([])
      expect(payload.volumeUSD).toHaveLength(1)
      expect(payload.warnings).toContain("daily-genesis-txs temporarily unavailable")
      expect(payload.generatedAt).toEqual(expect.any(String))
      expect(fetchMock).toHaveBeenCalledTimes(4)
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/daily-agora-volume?"),
        expect.objectContaining({
          cache: "no-store",
          signal: expect.any(AbortSignal),
        }),
      )
    })

    it("returns an error response only when every upstream chart fails", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("network down"))
      vi.stubGlobal("fetch", fetchMock)

      const { GET } = await import("@/app/api/agora-stats/route")
      const response = await GET()
      const payload = await response.json()

      expect(response.status).toBe(502)
      expect(payload.error).toBe("Failed to fetch Agora stats")
      expect(payload.dailyVolume).toEqual([])
      expect(payload.cumulativeVolume).toEqual([])
      expect(payload.genesisData).toEqual([])
      expect(payload.volumeUSD).toEqual([])
      expect(payload.warnings).toHaveLength(4)
    })
  })
})
