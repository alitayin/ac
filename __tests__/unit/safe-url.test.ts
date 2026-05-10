import { describe, expect, it } from "vitest"

import { getSafeExternalUrl, normalizeSafeExternalUrl } from "@/lib/safe-url"

describe("safe-url", () => {
  it("allows http and https URLs", () => {
    expect(getSafeExternalUrl("https://example.com/path")).toBe("https://example.com/path")
    expect(getSafeExternalUrl("http://example.com/path")).toBe("http://example.com/path")
  })

  it("rejects non-web protocols", () => {
    expect(getSafeExternalUrl("javascript:alert(1)")).toBeNull()
    expect(getSafeExternalUrl("data:text/html,hello")).toBeNull()
    expect(getSafeExternalUrl("ftp://example.com/file")).toBeNull()
  })

  it("normalizes bare domains to https URLs", () => {
    expect(normalizeSafeExternalUrl("example.com/project")).toBe(
      "https://example.com/project",
    )
  })
})
