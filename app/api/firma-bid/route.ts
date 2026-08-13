import { NextResponse } from "next/server";

const FIRMA_BID_URL = "https://stakedxec.com/api/bid";
const REQUEST_TIMEOUT_MS = 5_000;
const RESPONSE_HEADERS = {
  "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(FIRMA_BID_URL, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    const bid = Number(payload?.bid);

    if (!response.ok || !Number.isFinite(bid) || bid <= 0) {
      return NextResponse.json(
        { error: "Firma bid endpoint returned an invalid price" },
        { status: 502 },
      );
    }

    return NextResponse.json({ bid }, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error("Failed to fetch Firma bid:", error);

    return NextResponse.json(
      { error: "Failed to fetch Firma buyback price" },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
