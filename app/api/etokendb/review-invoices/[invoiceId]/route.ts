import { NextResponse } from "next/server"

import { ETOKENDB_UPSTREAM_BASE_URL, isValidReviewInvoiceId } from "@/lib/etokendb"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const runtime = "nodejs"

const REQUEST_TIMEOUT_MS = 8_000
const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
}

export async function GET(
  _request: Request,
  context: { params: { invoiceId: string } },
) {
  const invoiceId = context.params?.invoiceId

  if (!invoiceId || !isValidReviewInvoiceId(invoiceId)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid invoiceId",
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
      `${ETOKENDB_UPSTREAM_BASE_URL}/review-invoices/${encodeURIComponent(invoiceId)}`,
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
    console.error(`Failed to proxy etokendb review invoice ${invoiceId}:`, error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to fetch etokendb review invoice",
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
