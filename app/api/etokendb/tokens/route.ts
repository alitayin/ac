import { NextResponse } from "next/server"

import {
  createEtokenDbTokenListSearchParams,
  ETOKENDB_UPSTREAM_BASE_URL,
  normalizeEtokenDbTokenListQuery,
} from "@/lib/etokendb"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const runtime = "nodejs"

const REQUEST_TIMEOUT_MS = 8_000
const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
}

export async function GET(request: Request) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const requestUrl = new URL(request.url)
    const upstreamUrl = new URL(`${ETOKENDB_UPSTREAM_BASE_URL}/tokens`)
    upstreamUrl.search = createEtokenDbTokenListSearchParams(
      normalizeEtokenDbTokenListQuery(requestUrl.searchParams),
    ).toString()

    const response = await fetch(upstreamUrl.toString(), {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            payload && typeof payload === "object" && typeof (payload as any).error === "string"
              ? (payload as any).error
              : `etokendb token list returned ${response.status}`,
        },
        {
          status: 502,
          headers: RESPONSE_HEADERS,
        },
      )
    }

    if (!payload || typeof payload !== "object") {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid etokendb token list JSON response",
        },
        {
          status: 502,
          headers: RESPONSE_HEADERS,
        },
      )
    }

    return NextResponse.json(payload, {
      headers: RESPONSE_HEADERS,
    })
  } catch (error) {
    console.error("Failed to proxy etokendb token list:", error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to fetch etokendb token list",
      },
      {
        status: 502,
        headers: RESPONSE_HEADERS,
      },
    )
  } finally {
    clearTimeout(timeoutId)
  }
}
