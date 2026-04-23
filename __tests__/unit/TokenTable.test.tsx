import * as React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void

  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

const {
  fetchBlockchainInfoMock,
  fetchTokenDetailsMock,
  getCachedTokenDetailsMock,
  getTokenDecimalsFromDetailsMock,
  fetchEtokenDbTopVolumeTokensMock,
  fetchEtokenDbTokenSummaryMock,
  isEtokenDbAvailableMock,
  useChronikMock,
  useWalletMock,
  useXECPriceMock,
  watchAgoraTokensMock,
  pushMock,
  toastMock,
} = vi.hoisted(() => ({
  fetchBlockchainInfoMock: vi.fn(),
  fetchTokenDetailsMock: vi.fn(),
  getCachedTokenDetailsMock: vi.fn(),
  getTokenDecimalsFromDetailsMock: vi.fn(),
  fetchEtokenDbTopVolumeTokensMock: vi.fn(),
  fetchEtokenDbTokenSummaryMock: vi.fn(),
  isEtokenDbAvailableMock: vi.fn(),
  useChronikMock: vi.fn(),
  useWalletMock: vi.fn(),
  useXECPriceMock: vi.fn(),
  watchAgoraTokensMock: vi.fn(),
  pushMock: vi.fn(),
  toastMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

vi.mock("@/config/tokens", () => ({
  tokens: {
    alpha: {
      tokenId: "alpha-token-id",
      name: "Alpha Token",
      decimals: 2,
    },
    fallback: {
      tokenId: "fallback-token-id",
      name: "Fallback Token",
      decimals: 2,
    },
  },
}))

vi.mock("@/components/ui/AllEtokensView", () => ({
  default: () => <div data-testid="all-etokens-view" />,
}))

vi.mock("@/lib/context/ChronikContext", () => ({
  useChronik: () => useChronikMock(),
}))

vi.mock("@/lib/context/WalletContext", () => ({
  useWallet: () => useWalletMock(),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}))

vi.mock("@/lib/price", () => ({
  useXECPrice: () => useXECPriceMock(),
}))

vi.mock("@/lib/agora-ws", () => ({
  watchAgoraTokens: (...args: unknown[]) => watchAgoraTokensMock(...args),
}))

vi.mock("@/lib/chronik", () => ({
  fetchBlockchainInfo: (...args: unknown[]) => fetchBlockchainInfoMock(...args),
  fetchTokenDetails: (...args: unknown[]) => fetchTokenDetailsMock(...args),
  getCachedTokenDetails: (...args: unknown[]) => getCachedTokenDetailsMock(...args),
  getTokenAmountFromToken: vi.fn(() => 0),
  getTokenDecimalsFromDetails: (...args: unknown[]) => getTokenDecimalsFromDetailsMock(...args),
}))

vi.mock("@/lib/etokendb", () => ({
  fetchEtokenDbTopVolumeTokens: (...args: unknown[]) => fetchEtokenDbTopVolumeTokensMock(...args),
  fetchEtokenDbTokenSummary: (...args: unknown[]) => fetchEtokenDbTokenSummaryMock(...args),
  isEtokenDbAvailable: (...args: unknown[]) => isEtokenDbAvailableMock(...args),
  nanosatsPerAtomToXec: vi.fn(() => 1.23),
}))

import TokenTable from "@/components/ui/TokenTable"

const TOP_VOLUME_TOKENS_CACHE_KEY = "token_table_top_volume_tokens_v1"

const makeTopVolumeToken = (overrides: Record<string, unknown> = {}) => ({
  tokenId: "alpha-token-id",
  hasLatestPrice: true,
  latestPriceNanosatsPerAtom: 123,
  hasPriceChange24h: true,
  priceChange24h: 12.5,
  last24HoursXECAmount: 456,
  last7DaysXECAmount: 789,
  last30DaysVolumeXECAmount: 101112,
  recent7dTradeCount: 42,
  has30DayVolume: true,
  ...overrides,
})

describe("TokenTable bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useChronikMock.mockReturnValue({
      chronik: { tipHeight: 900000 },
      isLoading: false,
    })
    useWalletMock.mockReturnValue({
      isWalletConnected: false,
      userTokens: {},
    })
    useXECPriceMock.mockReturnValue(0.05)
    watchAgoraTokensMock.mockReturnValue(() => {})
    fetchTokenDetailsMock.mockResolvedValue(null)
    getCachedTokenDetailsMock.mockReturnValue(null)
    getTokenDecimalsFromDetailsMock.mockImplementation((_details, fallback = 0) => fallback)
    fetchEtokenDbTokenSummaryMock.mockResolvedValue({
      hasLatestPrice: false,
      hasPriceChange24h: false,
      last24HoursXECAmount: 0,
      last7DaysXECAmount: 0,
      last30DaysVolumeXECAmount: 0,
      recent7dTradeCount: 0,
      has30DayVolume: false,
    })
    isEtokenDbAvailableMock.mockResolvedValue(false)
  })

  it("renders cached rows before the fresh top-volume request resolves", async () => {
    const topVolumeDeferred = createDeferred<Array<Record<string, unknown>>>()

    fetchBlockchainInfoMock.mockReturnValue(new Promise(() => {}))
    fetchEtokenDbTopVolumeTokensMock.mockReturnValue(topVolumeDeferred.promise)

    localStorage.setItem(
      TOP_VOLUME_TOKENS_CACHE_KEY,
      JSON.stringify({
        cachedAt: Date.now(),
        tokens: [makeTopVolumeToken()],
      }),
    )

    render(<TokenTable />)

    await waitFor(() => {
      expect(screen.getByText("Alpha Token")).toBeInTheDocument()
    })
    expect(fetchEtokenDbTopVolumeTokensMock).toHaveBeenCalledTimes(1)
    expect(fetchBlockchainInfoMock).toHaveBeenCalledTimes(1)
    expect(isEtokenDbAvailableMock).not.toHaveBeenCalled()

    topVolumeDeferred.resolve([])
  })

  it("renders the fetched token list without waiting for blockchain info", async () => {
    fetchBlockchainInfoMock.mockReturnValue(new Promise(() => {}))
    fetchEtokenDbTopVolumeTokensMock.mockResolvedValue([makeTopVolumeToken()])

    render(<TokenTable />)

    await waitFor(() => {
      expect(screen.getByText("Alpha Token")).toBeInTheDocument()
    })
    expect(fetchBlockchainInfoMock).toHaveBeenCalledTimes(1)
    expect(fetchEtokenDbTopVolumeTokensMock).toHaveBeenCalledTimes(1)
    expect(isEtokenDbAvailableMock).not.toHaveBeenCalled()

    const cachedPayload = JSON.parse(
      localStorage.getItem(TOP_VOLUME_TOKENS_CACHE_KEY) || "null",
    )
    expect(cachedPayload?.tokens).toHaveLength(1)
    expect(cachedPayload?.tokens?.[0]?.tokenId).toBe("alpha-token-id")
  })

  it("replaces cached rows with the fresh token list once the request completes", async () => {
    const topVolumeDeferred = createDeferred<Array<Record<string, unknown>>>()

    fetchBlockchainInfoMock.mockResolvedValue({ tipHeight: 900000 })
    fetchEtokenDbTopVolumeTokensMock.mockReturnValue(topVolumeDeferred.promise)

    localStorage.setItem(
      TOP_VOLUME_TOKENS_CACHE_KEY,
      JSON.stringify({
        cachedAt: Date.now(),
        tokens: [makeTopVolumeToken()],
      }),
    )

    render(<TokenTable />)

    await waitFor(() => {
      expect(screen.getByText("Alpha Token")).toBeInTheDocument()
    })

    topVolumeDeferred.resolve([
      makeTopVolumeToken({
        tokenId: "fallback-token-id",
      }),
    ])

    await waitFor(() => {
      expect(screen.getByText("Fallback Token")).toBeInTheDocument()
    })
    expect(screen.queryByText("Alpha Token")).not.toBeInTheDocument()
  })

  it("keeps cached rows when the fresh request fails instead of falling back to configured tokens", async () => {
    fetchBlockchainInfoMock.mockResolvedValue({ tipHeight: 900000 })
    fetchEtokenDbTopVolumeTokensMock.mockRejectedValue(new Error("boom"))

    localStorage.setItem(
      TOP_VOLUME_TOKENS_CACHE_KEY,
      JSON.stringify({
        cachedAt: Date.now(),
        tokens: [makeTopVolumeToken()],
      }),
    )

    render(<TokenTable />)

    await waitFor(() => {
      expect(screen.getByText("Alpha Token")).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.queryByText("Fallback Token")).not.toBeInTheDocument()
    })
  })
})
