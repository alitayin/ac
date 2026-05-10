import { beforeEach, describe, expect, it, vi } from "vitest"

const wsMock = vi.hoisted(() => ({
  subscribeToTxs: vi.fn(),
  subscribeToTokenId: vi.fn(),
  unsubscribeFromTokenId: vi.fn(),
  waitForOpen: vi.fn().mockResolvedValue(undefined),
}))

const chronikMock = vi.hoisted(() => ({
  ws: vi.fn(() => wsMock),
  tx: vi.fn(),
}))

vi.mock("@/lib/chronik", () => ({
  chronik: chronikMock,
}))

vi.mock("@/lib/chronik-transactions", () => ({
  detectAgoraTokenId: vi.fn(),
}))

vi.mock("@/lib/token-stats", () => ({
  deleteSummaryCache: vi.fn(),
  refreshSummaryCacheTimestamps: vi.fn(),
}))

describe("agora-ws", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    Object.values(wsMock).forEach((mock) => mock.mockClear())
  })

  it("keeps token subscriptions deduped and unsubscribes after the last watcher leaves", async () => {
    const { getWatchedAgoraTokens, watchAgoraTokens } = await import("@/lib/agora-ws")
    const handlerA = vi.fn()
    const handlerB = vi.fn()

    const unsubscribeA = watchAgoraTokens(["token-a", "token-b", "token-a"], handlerA)
    const unsubscribeB = watchAgoraTokens(["token-a"], handlerB)

    expect(getWatchedAgoraTokens().sort()).toEqual(["token-a", "token-b"])
    expect(wsMock.subscribeToTokenId).toHaveBeenCalledTimes(2)
    expect(wsMock.subscribeToTokenId).toHaveBeenCalledWith("token-a")
    expect(wsMock.subscribeToTokenId).toHaveBeenCalledWith("token-b")

    unsubscribeA()

    expect(getWatchedAgoraTokens()).toEqual(["token-a"])
    expect(wsMock.unsubscribeFromTokenId).toHaveBeenCalledTimes(1)
    expect(wsMock.unsubscribeFromTokenId).toHaveBeenCalledWith("token-b")

    unsubscribeB()

    expect(getWatchedAgoraTokens()).toEqual([])
    expect(wsMock.unsubscribeFromTokenId).toHaveBeenCalledTimes(2)
    expect(wsMock.unsubscribeFromTokenId).toHaveBeenCalledWith("token-a")
  })
})
