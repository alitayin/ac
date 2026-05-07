import { NextResponse } from "next/server"

import { ETOKENDB_UPSTREAM_BASE_URL, isValidEtokenDbTokenId } from "@/lib/etokendb"
import { ETOKENDB_PROXY_HEADERS, proxyEtokenDbError } from "../../../proxy-utils"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const runtime = "nodejs"

const REQUEST_TIMEOUT_MS = 8_000
export async function GET(
  _request: Request,
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
    const response = await fetch(
      `${ETOKENDB_UPSTREAM_BASE_URL}/tokens/${encodeURIComponent(tokenId)}/project-info`,
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
      return proxyEtokenDbError(
        payload,
        response.status,
        `etokendb token project info returned ${response.status}`,
      )
    }

    return NextResponse.json(payload, {
      headers: ETOKENDB_PROXY_HEADERS,
    })
  } catch (error) {
    console.error(`Failed to proxy etokendb token project info ${tokenId}:`, error)

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch etokendb token project info",
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
