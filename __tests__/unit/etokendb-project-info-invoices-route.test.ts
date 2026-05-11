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

const createRequest = (body: unknown): Request =>
  new Request(
    `http://localhost/api/etokendb/tokens/${VALID_TOKEN_ID}/project-info/invoices`,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
      },
    },
  )

describe("etokendb project info invoice route", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it("normalizes project info URLs before proxying upstream", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        ok: true,
        data: {
          invoiceId: "550e8400-e29b-41d4-a716-446655440001",
        },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { POST } = await import(
      "@/app/api/etokendb/tokens/[tokenId]/project-info/invoices/route"
    )
    const response = await POST(
      createRequest({
        editorAddress: "ecash:qpr8h2m24zk0xv2h7x7w4jv3n7q3y3tu4s7v5u8n2s",
        description: "Project description",
        websiteUrl: " example.com/project ",
        xUrl: "https://x.com/project ",
        telegramUrl: "",
      }),
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
      `https://etokendb.alitayin.com/api/tokens/${VALID_TOKEN_ID}/project-info/invoices`,
      expect.objectContaining({
        method: "POST",
      }),
    )

    const forwardedOptions = fetchMock.mock.calls[0]?.[1]
    expect(JSON.parse(String(forwardedOptions.body))).toMatchObject({
      websiteUrl: "https://example.com/project",
      xUrl: "https://x.com/project",
      telegramUrl: null,
    })
  })

  it("rejects unsafe project info URLs before fetching upstream", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const { POST } = await import(
      "@/app/api/etokendb/tokens/[tokenId]/project-info/invoices/route"
    )
    const response = await POST(
      createRequest({
        editorAddress: "ecash:qpr8h2m24zk0xv2h7x7w4jv3n7q3y3tu4s7v5u8n2s",
        description: "Project description",
        websiteUrl: "javascript:alert(1)",
      }),
      {
        params: {
          tokenId: VALID_TOKEN_ID,
        },
      },
    )
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({
      ok: false,
      error: "Invalid websiteUrl",
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects protocol-relative project info URLs before fetching upstream", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const { POST } = await import(
      "@/app/api/etokendb/tokens/[tokenId]/project-info/invoices/route"
    )
    const response = await POST(
      createRequest({
        editorAddress: "ecash:qpr8h2m24zk0xv2h7x7w4jv3n7q3y3tu4s7v5u8n2s",
        description: "Project description",
        telegramUrl: "//example.com/project",
      }),
      {
        params: {
          tokenId: VALID_TOKEN_ID,
        },
      },
    )
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({
      ok: false,
      error: "Invalid telegramUrl",
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
