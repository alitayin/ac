import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("XEC price requests", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("deduplicates concurrent upstream requests", async () => {
    let resolveFetch: ((value: unknown) => void) | undefined
    const fetchMock = vi.fn(() =>
      new Promise((resolve) => {
        resolveFetch = resolve
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { getXECPrice } = await import("@/lib/price")
    const firstRequest = getXECPrice()
    const secondRequest = getXECPrice()

    expect(secondRequest).toBe(firstRequest)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolveFetch?.({
      ok: true,
      json: async () => ({ price: "0.00001234" }),
    })

    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      0.00001234,
      0.00001234,
    ])
  })

  it("aborts a stalled Binance request and falls back to CoinGecko", async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockImplementationOnce((_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            const error = new Error("request aborted")
            error.name = "AbortError"
            reject(error)
          })
        }),
      )
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ecash: { usd: 0.00004567 } }),
      })
    vi.stubGlobal("fetch", fetchMock)

    const { getXECPrice } = await import("@/lib/price")
    const request = getXECPrice()

    await vi.advanceTimersByTimeAsync(5_000)

    await expect(request).resolves.toBe(0.00004567)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
    expect(fetchMock.mock.calls[1][0]).toContain("coingecko.com")
  })
})
