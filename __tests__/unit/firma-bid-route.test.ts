import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/firma-bid/route";

describe("Firma bid proxy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a validated bid with short-lived cache headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ bid: 146205.44 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ bid: 146205.44 });
    expect(response.headers.get("cache-control")).toContain("s-maxage=30");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://stakedxec.com/api/bid",
      expect.objectContaining({
        headers: { Accept: "application/json" },
      }),
    );
  });

  it("rejects invalid upstream bids", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ bid: 0 }),
    }));

    const response = await GET();

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Firma bid endpoint returned an invalid price",
    });
  });
});
