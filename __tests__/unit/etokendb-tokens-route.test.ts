import { beforeEach, describe, expect, it, vi } from "vitest"

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  })
}

describe("etokendb tokens route", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it("forwards only normalized token-list query params upstream", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        ok: true,
        data: {
          items: [],
        },
      }),
    )

    vi.stubGlobal("fetch", fetchMock)

    const { GET } = await import("@/app/api/etokendb/tokens/route")
    const response = await GET(
      new Request(
        "http://localhost/api/etokendb/tokens?sort=bad&pageSize=999999&order=asc&readyOnly=false&debug=true",
      ),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://etokendb.alitayin.com/api/tokens?sort=recent1008VolumeSats&order=asc&pageSize=200&readyOnly=false",
      expect.any(Object),
    )
  })

  it("returns a 502 envelope when upstream succeeds with invalid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("not json", {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }),
      ),
    )

    const { GET } = await import("@/app/api/etokendb/tokens/route")
    const response = await GET(new Request("http://localhost/api/etokendb/tokens"))
    const payload = await response.json()

    expect(response.status).toBe(502)
    expect(payload).toEqual({
      ok: false,
      error: "Invalid etokendb token list JSON response",
    })
  })
})
