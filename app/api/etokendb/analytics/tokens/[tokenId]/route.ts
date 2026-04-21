import { NextResponse } from "next/server"

import { ETOKENDB_UPSTREAM_BASE_URL, isValidEtokenDbTokenId } from "@/lib/etokendb"
import {
  getAnalyticsHours,
  normalizeAnalyticsTokenDetailPayload,
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

export async function GET(
  request: Request,
  context: { params: { tokenId: string } },
) {
  const tokenId = decodeURIComponent(context.params.tokenId ?? "")

  if (!isValidEtokenDbTokenId(tokenId)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid tokenId",
      },
      {
        status: 400,
        headers: RESPONSE_HEADERS,
      },
    )
  }

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

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(
      `${ETOKENDB_UPSTREAM_BASE_URL}/analytics/tokens/${encodeURIComponent(tokenId)}?hours=${hours}`,
      {
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      },
    )
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: getErrorMessage(payload, `Token analytics returned ${response.status}`),
        },
        {
          status: response.status === 404 ? 404 : response.status === 400 ? 400 : 502,
          headers: RESPONSE_HEADERS,
        },
      )
    }

    return NextResponse.json(
      {
        ok: true,
        data: normalizeAnalyticsTokenDetailPayload(payload, tokenId, hours),
      },
      {
        headers: RESPONSE_HEADERS,
      },
    )
  } catch (error) {
    console.error(`Failed to fetch analytics token detail ${tokenId}:`, error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to fetch analytics token detail",
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
