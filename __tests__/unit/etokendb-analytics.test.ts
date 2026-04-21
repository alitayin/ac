import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  buildAnalyticsDashboard,
  buildSuccessRate,
  getAnalyticsHours,
  getAnalyticsRouteLabel,
  normalizeAnalyticsEndpointDetailPayload,
  normalizeAnalyticsEndpointListPayload,
  normalizeAnalyticsSummaryPayload,
  normalizeAnalyticsTokenDetailPayload,
  normalizeAnalyticsTokenListPayload,
  windowPresetToHours,
} from "@/lib/etokendb-analytics"

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  })
}

const VALID_TOKEN_ID_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
const VALID_TOKEN_ID_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

describe("etokendb analytics", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("parses allowed hours and rejects unsupported values", () => {
    expect(getAnalyticsHours(undefined)).toBe(168)
    expect(getAnalyticsHours("24")).toBe(24)
    expect(getAnalyticsHours("720")).toBe(720)
    expect(() => getAnalyticsHours("12")).toThrow("hours must be one of 24, 168, or 720")
    expect(windowPresetToHours("30d")).toBe(720)
  })

  it("normalizes summary, endpoint, and token payloads into dashboard data", () => {
    const summary = normalizeAnalyticsSummaryPayload(
      {
        ok: true,
        data: {
          hours: 168,
          windowStart: 1_700_000_000_000,
          windowEnd: 1_700_000_600_000,
          apiAccessCountTotal: 2000,
          apiAccessCountWindow: 120,
          apiAccessBuckets: [
            {
              bucketStart: 1_700_000_000_000,
              bucketEnd: 1_700_000_360_000,
              accessCount: 60,
              successCount: 54,
              clientErrorCount: 4,
              serverErrorCount: 2,
            },
            {
              bucketStart: 1_700_000_360_000,
              bucketEnd: 1_700_000_600_000,
              accessCount: 60,
              successCount: 48,
              clientErrorCount: 8,
              serverErrorCount: 4,
            },
          ],
          tokenVisitCountTotal: 500,
          tokenVisitCountWindow: 30,
          tokenVisitBuckets: [
            {
              bucketStart: 1_700_000_000_000,
              bucketEnd: 1_700_000_360_000,
              visitCount: 10,
            },
            {
              bucketStart: 1_700_000_360_000,
              bucketEnd: 1_700_000_600_000,
              visitCount: 20,
            },
          ],
        },
      },
      168,
    )

    const endpoints = normalizeAnalyticsEndpointListPayload({
      ok: true,
      data: {
        items: [
          {
            routeKey: "tokens.detail",
            accessCountTotal: 1000,
            accessCountWindow: 100,
            successCountTotal: 900,
            successCountWindow: 95,
            clientErrorCountTotal: 75,
            clientErrorCountWindow: 3,
            serverErrorCountTotal: 25,
            serverErrorCountWindow: 2,
            lastAccessedAt: 1_700_000_600_000,
          },
          {
            routeKey: "trades.list",
            accessCountTotal: 400,
            accessCountWindow: 12,
            successCountTotal: 380,
            successCountWindow: 10,
            clientErrorCountTotal: 18,
            clientErrorCountWindow: 1,
            serverErrorCountTotal: 2,
            serverErrorCountWindow: 1,
            lastAccessedAt: 1_700_000_300_000,
          },
        ],
      },
    })

    const tokens = normalizeAnalyticsTokenListPayload({
      ok: true,
      data: {
        items: [
          {
            tokenId: VALID_TOKEN_ID_A,
            visitCountTotal: 50,
            visitCount24h: 5,
            lastVisitedAt: 1_700_000_600_000,
          },
          {
            tokenId: VALID_TOKEN_ID_B,
            visitCountTotal: 100,
            visitCount24h: 15,
            lastVisitedAt: 1_700_000_500_000,
          },
        ],
      },
    })

    const dashboard = buildAnalyticsDashboard({
      summary,
      endpoints,
      tokens,
      status: {
        healthy: true,
        ready: true,
        phase: "ready",
        lastTipUpdateAt: "2026-04-21T00:00:00.000Z",
        lastDiscoveryAt: "2026-04-20T23:00:00.000Z",
        lastError: null,
      },
      warnings: ["Token analytics temporarily unavailable"],
      generatedAt: "2026-04-21T00:00:00.000Z",
    })

    expect(buildSuccessRate(90, 120)).toBe(75)
    expect(getAnalyticsRouteLabel("tokens.detail")).toBe("Token Detail Pages")
    expect(dashboard.overview.successRate).toBe(85)
    expect(dashboard.overview.activeEndpointCount).toBe(2)
    expect(dashboard.endpoints[0].routeKey).toBe("tokens.detail")
    expect(dashboard.tokens[0].tokenId).toBe(VALID_TOKEN_ID_B)
    expect(dashboard.warnings).toContain("Token analytics temporarily unavailable")
  })

  it("normalizes endpoint and token detail payloads", () => {
    const endpointDetail = normalizeAnalyticsEndpointDetailPayload(
      {
        ok: true,
        data: {
          hours: 24,
          windowStart: 1_700_000_000_000,
          windowEnd: 1_700_000_100_000,
          accessCountTotal: 100,
          accessCountWindow: 20,
          successCountTotal: 90,
          successCountWindow: 18,
          clientErrorCountTotal: 7,
          clientErrorCountWindow: 1,
          serverErrorCountTotal: 3,
          serverErrorCountWindow: 1,
          lastAccessedAt: 1_700_000_080_000,
          buckets: [
            {
              bucketStart: 1_700_000_000_000,
              bucketEnd: 1_700_000_030_000,
              accessCount: 10,
              successCount: 9,
              clientErrorCount: 1,
              serverErrorCount: 0,
            },
          ],
        },
      },
      "tokens.detail",
      24,
    )

    const tokenDetail = normalizeAnalyticsTokenDetailPayload(
      {
        ok: true,
        data: {
          tokenId: VALID_TOKEN_ID_A,
          hours: 720,
          windowStart: 1_700_000_000_000,
          windowEnd: 1_700_000_500_000,
          visitCountTotal: 70,
          visitCount24h: 9,
          lastVisitedAt: 1_700_000_450_000,
          visitCountWindow: 20,
          buckets: [
            {
              bucketStart: 1_700_000_000_000,
              bucketEnd: 1_700_000_030_000,
              visitCount: 4,
            },
          ],
        },
      },
      VALID_TOKEN_ID_A,
      720,
    )

    expect(endpointDetail.routeLabel).toBe("Token Detail Pages")
    expect(endpointDetail.successRate).toBe(90)
    expect(tokenDetail.tokenId).toBe(VALID_TOKEN_ID_A)
    expect(tokenDetail.visitCountWindow).toBe(20)
  })

  it("builds the dashboard route and tolerates optional upstream failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          data: {
            hours: 168,
            windowStart: 1_700_000_000_000,
            windowEnd: 1_700_000_100_000,
            apiAccessCountTotal: 1000,
            apiAccessCountWindow: 20,
            apiAccessBuckets: [
              {
                bucketStart: 1_700_000_000_000,
                bucketEnd: 1_700_000_030_000,
                accessCount: 20,
                successCount: 18,
                clientErrorCount: 1,
                serverErrorCount: 1,
              },
            ],
            tokenVisitCountTotal: 100,
            tokenVisitCountWindow: 5,
            tokenVisitBuckets: [
              {
                bucketStart: 1_700_000_000_000,
                bucketEnd: 1_700_000_030_000,
                visitCount: 5,
              },
            ],
          },
        }),
      )
      .mockRejectedValueOnce(new Error("endpoint list down"))
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          data: {
            items: [
              {
                tokenId: VALID_TOKEN_ID_A,
                visitCountTotal: 30,
                visitCount24h: 5,
                lastVisitedAt: 1_700_000_050_000,
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          data: {
            healthy: true,
            ready: true,
            phase: "ready",
          },
        }),
      )

    vi.stubGlobal("fetch", fetchMock)

    const { GET } = await import("@/app/api/etokendb/analytics/dashboard/route")
    const response = await GET(new Request("http://localhost/api/etokendb/analytics/dashboard?hours=168"))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.data.overview.apiAccessCountWindow).toBe(20)
    expect(payload.data.tokens).toHaveLength(1)
    expect(payload.data.endpoints).toEqual([])
    expect(payload.data.warnings).toContain("Endpoint analytics temporarily unavailable")
  })

  it("returns route validation errors for unsupported dashboard hours", async () => {
    const { GET } = await import("@/app/api/etokendb/analytics/dashboard/route")
    const response = await GET(new Request("http://localhost/api/etokendb/analytics/dashboard?hours=12"))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.ok).toBe(false)
    expect(payload.error).toContain("hours must be one of 24, 168, or 720")
  })

  it("normalizes the endpoint detail route response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          ok: true,
          data: {
            hours: 168,
            windowStart: 1_700_000_000_000,
            windowEnd: 1_700_000_060_000,
            accessCountTotal: 500,
            accessCountWindow: 25,
            successCountTotal: 470,
            successCountWindow: 20,
            clientErrorCountTotal: 20,
            clientErrorCountWindow: 3,
            serverErrorCountTotal: 10,
            serverErrorCountWindow: 2,
            lastAccessedAt: 1_700_000_050_000,
            buckets: [
              {
                bucketStart: 1_700_000_000_000,
                bucketEnd: 1_700_000_030_000,
                accessCount: 25,
                successCount: 20,
                clientErrorCount: 3,
                serverErrorCount: 2,
              },
            ],
          },
        }),
      ),
    )

    const { GET } = await import("@/app/api/etokendb/analytics/endpoints/[routeKey]/route")
    const response = await GET(
      new Request("http://localhost/api/etokendb/analytics/endpoints/tokens.detail?hours=168"),
      {
        params: {
          routeKey: "tokens.detail",
        },
      },
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.data.routeLabel).toBe("Token Detail Pages")
    expect(payload.data.buckets).toHaveLength(1)
  })

  it("validates token ids in the token detail route before fetching upstream", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const { GET } = await import("@/app/api/etokendb/analytics/tokens/[tokenId]/route")
    const response = await GET(
      new Request("http://localhost/api/etokendb/analytics/tokens/not-a-token?hours=168"),
      {
        params: {
          tokenId: "not-a-token",
        },
      },
    )
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.ok).toBe(false)
    expect(payload.error).toBe("Invalid tokenId")
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
