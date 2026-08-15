import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  fetchAgoraTransactionsMock,
  fetchBlockchainInfoMock,
  watchAgoraTokensMock,
} = vi.hoisted(() => ({
  fetchAgoraTransactionsMock: vi.fn(),
  fetchBlockchainInfoMock: vi.fn(),
  watchAgoraTokensMock: vi.fn(),
}))

vi.mock("@/lib/chronik-transactions", () => ({
  fetchAgoraTransactionsFromChronik: fetchAgoraTransactionsMock,
}))

vi.mock("@/lib/chronik", () => ({
  fetchBlockchainInfo: fetchBlockchainInfoMock,
}))

vi.mock("@/lib/agora-ws", () => ({
  watchAgoraTokens: watchAgoraTokensMock,
}))

import MyFirmaHistory, {
  FIRMA_HISTORY_MAX_BLOCKS,
} from "@/components/swap/MyFirmaHistory"

describe("MyFirmaHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchBlockchainInfoMock.mockResolvedValue({ tipHeight: 1_000 })
    fetchAgoraTransactionsMock.mockResolvedValue([])
    watchAgoraTokensMock.mockReturnValue(() => {})
  })

  it("limits address history to the latest 72 hours", async () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval")
    const { unmount } = render(
      <MyFirmaHistory
        tokenId="firma-token"
        address="ecash:qp-test-wallet"
      />,
    )

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(fetchAgoraTransactionsMock).toHaveBeenCalled()

    expect(FIRMA_HISTORY_MAX_BLOCKS).toBe(6 * 24 * 3)
    expect(fetchAgoraTransactionsMock).toHaveBeenCalledWith(
      "firma-token",
      expect.any(Function),
      expect.objectContaining({
        address: "ecash:qp-test-wallet",
        addressRole: "either",
        pageSize: 100,
        targetCount: 50,
        maxBlocksBack: FIRMA_HISTORY_MAX_BLOCKS,
        stopBelowHeight: 568,
        failOnError: true,
      }),
    )
    expect(setIntervalSpy).not.toHaveBeenCalled()

    const invalidate = watchAgoraTokensMock.mock.calls[0]?.[1]
    expect(invalidate).toEqual(expect.any(Function))
    invalidate()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(fetchAgoraTransactionsMock).toHaveBeenCalledTimes(2)

    unmount()
    setIntervalSpy.mockRestore()
  })

  it("renders both wallet buys and sells with explicit direction labels", async () => {
    fetchAgoraTransactionsMock.mockResolvedValue([
      {
        txid: "wallet-buy",
        price: 0.1,
        amount: 100,
        time: new Date(1_700_000_000 * 1000).toISOString(),
        timestamp: 1_700_000_000,
        status: "sold",
        buyerAddress: "ecash:qp-test-wallet",
        sellerAddress: "ecash:qp-seller",
      },
      {
        txid: "wallet-sell",
        price: 0.2,
        amount: 50,
        time: new Date(1_700_000_100 * 1000).toISOString(),
        timestamp: 1_700_000_100,
        status: "sold",
        buyerAddress: "ecash:qp-buyer",
        sellerAddress: "ecash:qp-test-wallet",
      },
    ])

    render(
      <MyFirmaHistory
        tokenId="firma-token"
        address="ecash:qp-test-wallet"
      />,
    )

    await waitFor(() => {
      expect(screen.getByText("Buy")).toBeInTheDocument()
      expect(screen.getByText("Sell")).toBeInTheDocument()
    })

    expect(screen.getByRole("row", { name: /Buy/ })).toBeInTheDocument()
    expect(screen.getByRole("row", { name: /Sell/ })).toBeInTheDocument()
  })
})
