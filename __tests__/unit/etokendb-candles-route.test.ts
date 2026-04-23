import { beforeEach, describe, expect, it, vi } from "vitest"

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  })
}

const VALID_TOKEN_ID =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

describe("etokendb token candles route", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it("proxies token candle queries to the etokendb upstream", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        ok: true,
        data: {
          tokenId: VALID_TOKEN_ID,
          interval: "hour",
          timezone: "UTC",
          items: [],
        },
      }),
    )

    vi.stubGlobal("fetch", fetchMock)

    const { GET } = await import("@/app/api/etokendb/tokens/[tokenId]/candles/route")
    const response = await GET(
      new Request(
        `http://localhost/api/etokendb/tokens/${VALID_TOKEN_ID}/candles?interval=hour&limit=24`,
      ),
      {
        params: {
          tokenId: VALID_TOKEN_ID,
        },
      },
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://etokendb.alitayin.com/api/tokens/${VALID_TOKEN_ID}/candles?interval=hour&limit=24`,
      expect.any(Object),
    )
  })

  it("rejects invalid token ids before fetching upstream", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const { GET } = await import("@/app/api/etokendb/tokens/[tokenId]/candles/route")
    const response = await GET(
      new Request("http://localhost/api/etokendb/tokens/not-a-token/candles?interval=day"),
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

  it("returns upstream failures as 502 envelopes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            ok: false,
            error: "upstream bad gateway",
          },
          503,
        ),
      ),
    )

    const { GET } = await import("@/app/api/etokendb/tokens/[tokenId]/candles/route")
    const response = await GET(
      new Request(`http://localhost/api/etokendb/tokens/${VALID_TOKEN_ID}/candles?interval=day`),
      {
        params: {
          tokenId: VALID_TOKEN_ID,
        },
      },
    )
    const payload = await response.json()

    expect(response.status).toBe(502)
    expect(payload.ok).toBe(false)
    expect(payload.error).toBe("upstream bad gateway")
  })
})
