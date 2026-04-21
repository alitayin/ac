import { NextResponse } from "next/server"

import { ETOKENDB_UPSTREAM_BASE_URL } from "@/lib/etokendb"
import {
  buildAnalyticsDashboard,
  getAnalyticsHours,
  normalizeAnalyticsEndpointListPayload,
  normalizeAnalyticsStatusPayload,
  normalizeAnalyticsSummaryPayload,
  normalizeAnalyticsTokenListPayload,
} from "@/lib/etokendb-analytics"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const runtime = "nodejs"

const REQUEST_TIMEOUT_MS = 8_000
const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
}

const getErrorMessage = (payload: unknown, fallback: string): string => {
  if (payload && typeof payload === "object") {
    if (typeof (payload as any).error === "string") {
      return (payload as any).error
    }

    const error = (payload as any).error
    if (error && typeof error === "object" && typeof error.message === "string") {
      return error.message
    }
  }

  return fallback
}

async function fetchUpstreamPayload(input: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<unknown> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(input, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      throw new Error(getErrorMessage(payload, `Request failed with status ${response.status}`))
    }

    return payload
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function GET(request: Request) {
  let hours

  try {
    const requestUrl = new URL(request.url)
    hours = getAnalyticsHours(requestUrl.searchParams.get("hours"))
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Invalid analytics query",
      },
      {
        status: 400,
        headers: RESPONSE_HEADERS,
      },
    )
  }

  const summaryUrl = `${ETOKENDB_UPSTREAM_BASE_URL}/analytics/summary?hours=${hours}`
  const endpointsUrl = `${ETOKENDB_UPSTREAM_BASE_URL}/analytics/endpoints?hours=${hours}`
  const tokensUrl =
    `${ETOKENDB_UPSTREAM_BASE_URL}/analytics/tokens?page=1&pageSize=10&sort=visits24h&order=desc`
  const statusUrl = `${ETOKENDB_UPSTREAM_BASE_URL}/status`

  try {
    const [summaryResult, endpointsResult, tokensResult, statusResult] = await Promise.allSettled([
      fetchUpstreamPayload(summaryUrl),
      fetchUpstreamPayload(endpointsUrl),
      fetchUpstreamPayload(tokensUrl),
      fetchUpstreamPayload(statusUrl, 4_000),
    ])

    if (summaryResult.status !== "fulfilled") {
      throw summaryResult.reason
    }

    const summary = normalizeAnalyticsSummaryPayload(summaryResult.value, hours)
    const warnings: string[] = []
    let endpoints: ReturnType<typeof normalizeAnalyticsEndpointListPayload> = []
    let tokens: ReturnType<typeof normalizeAnalyticsTokenListPayload> = []
    let status: ReturnType<typeof normalizeAnalyticsStatusPayload> | null = null

    if (endpointsResult.status === "fulfilled") {
      try {
        endpoints = normalizeAnalyticsEndpointListPayload(endpointsResult.value)
      } catch (error) {
        console.error("Invalid analytics endpoint list payload:", error)
        warnings.push("Endpoint analytics temporarily unavailable")
      }
    } else {
      console.error("Failed to fetch analytics endpoint list:", endpointsResult.reason)
      warnings.push("Endpoint analytics temporarily unavailable")
    }

    if (tokensResult.status === "fulfilled") {
      try {
        tokens = normalizeAnalyticsTokenListPayload(tokensResult.value)
      } catch (error) {
        console.error("Invalid analytics token list payload:", error)
        warnings.push("Token analytics temporarily unavailable")
      }
    } else {
      console.error("Failed to fetch analytics token list:", tokensResult.reason)
      warnings.push("Token analytics temporarily unavailable")
    }

    if (statusResult.status === "fulfilled") {
      try {
        status = normalizeAnalyticsStatusPayload(statusResult.value)
      } catch (error) {
        console.error("Invalid etokendb status payload:", error)
        warnings.push("Service status temporarily unavailable")
      }
    } else {
      console.error("Failed to fetch etokendb status:", statusResult.reason)
      warnings.push("Service status temporarily unavailable")
    }

    return NextResponse.json(
      {
        ok: true,
        data: buildAnalyticsDashboard({
          summary,
          endpoints,
          tokens,
          status,
          warnings,
          generatedAt: new Date().toISOString(),
        }),
      },
      {
        headers: RESPONSE_HEADERS,
      },
    )
  } catch (error) {
    console.error("Failed to build analytics dashboard:", error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load analytics dashboard",
      },
      {
        status: 502,
        headers: RESPONSE_HEADERS,
      },
    )
  }
}
