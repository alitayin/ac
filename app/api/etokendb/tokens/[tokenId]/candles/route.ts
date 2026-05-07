import { NextResponse } from "next/server"

import { ETOKENDB_UPSTREAM_BASE_URL, isValidEtokenDbTokenId } from "@/lib/etokendb"
import { ETOKENDB_PROXY_HEADERS, proxyEtokenDbError } from "../../../proxy-utils"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const runtime = "nodejs"

const REQUEST_TIMEOUT_MS = 8_000
export async function GET(
  request: Request,
  context: { params: { tokenId: string } },
) {
  const tokenId = context.params?.tokenId

  if (!tokenId || !isValidEtokenDbTokenId(tokenId)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid tokenId",
      },
      {
        status: 400,
        headers: ETOKENDB_PROXY_HEADERS,
      },
    )
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const requestUrl = new URL(request.url)
    const upstreamUrl = new URL(
      `${ETOKENDB_UPSTREAM_BASE_URL}/tokens/${encodeURIComponent(tokenId)}/candles`,
    )

    requestUrl.searchParams.forEach((value, key) => {
      upstreamUrl.searchParams.append(key, value)
    })

    const response = await fetch(upstreamUrl.toString(), {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      return proxyEtokenDbError(
        payload,
        response.status,
        `etokendb token candles returned ${response.status}`,
      )
    }

    return NextResponse.json(payload, {
      headers: ETOKENDB_PROXY_HEADERS,
    })
  } catch (error) {
    console.error(`Failed to proxy etokendb token candles ${tokenId}:`, error)

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch etokendb token candles",
      },
      {
        status: 502,
        headers: ETOKENDB_PROXY_HEADERS,
      },
    )
  } finally {
    clearTimeout(timeoutId)
  }
}
