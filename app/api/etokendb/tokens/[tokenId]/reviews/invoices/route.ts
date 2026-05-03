import { NextResponse } from "next/server"

import { ETOKENDB_UPSTREAM_BASE_URL, isValidEtokenDbTokenId } from "@/lib/etokendb"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const runtime = "nodejs"

const REQUEST_TIMEOUT_MS = 8_000
const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
}

export async function POST(
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
        headers: RESPONSE_HEADERS,
      },
    )
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid JSON body",
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
      `${ETOKENDB_UPSTREAM_BASE_URL}/tokens/${encodeURIComponent(tokenId)}/reviews/invoices`,
      {
        method: "POST",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    )

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            payload && typeof payload === "object" && typeof (payload as any).error === "string"
              ? (payload as any).error
              : `etokendb review invoice returned ${response.status}`,
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
    console.error(`Failed to proxy etokendb review invoice create ${tokenId}:`, error)

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to create etokendb review invoice",
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
