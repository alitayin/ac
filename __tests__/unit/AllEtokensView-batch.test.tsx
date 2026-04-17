import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import AllEtokensView from "@/components/ui/AllEtokensView"

const { mockPush, mockFetchTokenDetails, mockOfferedFungibleTokenIds, mockChronikClient } =
  vi.hoisted(() => ({
    mockPush: vi.fn(),
    mockFetchTokenDetails: vi.fn(),
    mockOfferedFungibleTokenIds: vi.fn(),
    mockChronikClient: {},
  }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

vi.mock("@/lib/chronik", () => ({
  fetchTokenDetails: mockFetchTokenDetails,
}))

vi.mock("@/lib/context/ChronikContext", () => ({
  useChronik: () => ({
    chronik: mockChronikClient,
    isLoading: false,
  }),
}))

vi.mock("ecash-agora", () => ({
  Agora: vi.fn(function MockAgora() {
    return {
      offeredFungibleTokenIds: mockOfferedFungibleTokenIds,
    }
  }),
}))

describe("AllEtokensView batch loading", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  it("starts page token detail requests in parallel and batches the UI update", async () => {
    const tokenIds = ["token-1", "token-2", "token-3"]
    const callOrder: string[] = []
    const resolvers = new Map<string, () => void>()

    mockOfferedFungibleTokenIds.mockResolvedValue(tokenIds)
    mockFetchTokenDetails.mockImplementation(
      (tokenId: string) =>
        new Promise((resolve) => {
          callOrder.push(`start-${tokenId}`)
          resolvers.set(tokenId, () => {
            callOrder.push(`end-${tokenId}`)
            resolve({
              genesisInfo: {
                tokenTicker: `${tokenId}-ticker`,
                tokenName: `${tokenId}-name`,
                decimals: 2,
                url: `https://${tokenId}.com`,
              },
            })
          })
        }),
    )

    render(<AllEtokensView />)

    await waitFor(() => {
      expect(mockFetchTokenDetails).toHaveBeenCalledTimes(3)
    })

    resolvers.get("token-1")?.()
    await Promise.resolve()

    const firstEndIndex = callOrder.findIndex((call) => call.startsWith("end-"))
    expect(firstEndIndex).toBe(3)
    expect(callOrder.slice(0, firstEndIndex)).toEqual([
      "start-token-1",
      "start-token-2",
      "start-token-3",
    ])

    // The component now applies resolved tokens in one batch, so a single
    // fulfilled request should not update the rendered list yet.
    expect(screen.queryByText("token-1-name")).not.toBeInTheDocument()

    resolvers.get("token-2")?.()
    resolvers.get("token-3")?.()

    await waitFor(() => {
      expect(screen.getByText("token-1-name")).toBeInTheDocument()
      expect(screen.getByText("token-2-name")).toBeInTheDocument()
      expect(screen.getByText("token-3-name")).toBeInTheDocument()
    })
  })

  it("keeps successful token results when one page token fails", async () => {
    mockOfferedFungibleTokenIds.mockResolvedValue(["success-token-1", "failed-token-2"])
    mockFetchTokenDetails.mockImplementation(async (tokenId: string) => {
      if (tokenId === "failed-token-2") {
        throw new Error("Network error")
      }

      return {
        genesisInfo: {
          tokenTicker: "TK1",
          tokenName: "success-token-name",
          decimals: 2,
          url: "https://success-token.com",
        },
      }
    })

    render(<AllEtokensView />)

    await waitFor(() => {
      expect(screen.getByText("success-token-name")).toBeInTheDocument()
    })

    // Failed tokens should still render a stable fallback instead of blocking
    // the rest of the page token batch.
    expect(screen.getByText("failed")).toBeInTheDocument()
  })
})
