import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"

const {
  mockExecuteOrders,
  mockFetchAgoraOrderBook,
  mockGetTokenSupply,
  mockIsEtokenDbAvailable,
  mockLoadTokenPageStats,
  mockPushOrdersToServer,
  mockToast,
  mockUseParams,
  mockUseWallet,
  mockWatchAgoraTokens,
  mockEstimateNetworkFeeXecFromAddress,
} = vi.hoisted(() => ({
  mockExecuteOrders: vi.fn(),
  mockFetchAgoraOrderBook: vi.fn(),
  mockGetTokenSupply: vi.fn(),
  mockIsEtokenDbAvailable: vi.fn(),
  mockLoadTokenPageStats: vi.fn(),
  mockPushOrdersToServer: vi.fn(),
  mockToast: vi.fn(),
  mockUseParams: vi.fn(),
  mockUseWallet: vi.fn(),
  mockWatchAgoraTokens: vi.fn(),
  mockEstimateNetworkFeeXecFromAddress: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useParams: mockUseParams,
}))

vi.mock("@/components/ui/header", () => ({
  default: () => <div data-testid="header" />,
}))

vi.mock("@/components/ui/realtimeprice", () => ({
  default: ({ tokenId }: { tokenId: string }) => (
    <div data-testid="realtime-price">{tokenId}</div>
  ),
}))

vi.mock("@/components/ui/VolumeChart", () => ({
  default: () => <div data-testid="volume-chart" />,
}))

vi.mock("@/components/ui/PriceChart", () => ({
  default: () => <div data-testid="price-chart" />,
}))

vi.mock("@/components/ui/Piechart", () => ({
  default: () => <div data-testid="pie-chart" />,
}))

vi.mock("@/components/ui/TokenTx", () => ({
  default: () => <div data-testid="token-tx" />,
}))

vi.mock("@/components/ui/OrderBook", () => ({
  default: () => <div data-testid="order-book" />,
}))

vi.mock("@/components/ui/AddressDistribution", () => ({
  default: () => <div data-testid="address-distribution" />,
}))

vi.mock("@/components/ui/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/ui/token-selector", () => ({
  TokenSelector: ({ selectedToken }: { selectedToken: { name: string } }) => (
    <button type="button">{selectedToken.name}</button>
  ),
}))

vi.mock("@/lib/context/WalletContext", () => ({
  useWallet: mockUseWallet,
}))

vi.mock("@/lib/context/AutoExecutionContext", () => ({
  useAutoExecution: () => ({
    executeOrders: mockExecuteOrders,
  }),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

vi.mock("@/lib/chronik", () => ({
  fetchTokenDetails: vi.fn(),
  getTokenDecimalsFromDetails: vi.fn(() => 0),
}))

vi.mock("@/lib/tokenSupply", () => ({
  getTokenSupply: mockGetTokenSupply,
}))

vi.mock("@/lib/agora-orders", () => ({
  fetchAgoraOrderBook: mockFetchAgoraOrderBook,
}))

vi.mock("@/lib/etokendb", () => ({
  isEtokenDbAvailable: mockIsEtokenDbAvailable,
}))

vi.mock("@/lib/token-page-stats", () => ({
  loadTokenPageStats: mockLoadTokenPageStats,
}))

vi.mock("@/lib/agora-ws", () => ({
  watchAgoraTokens: mockWatchAgoraTokens,
}))

vi.mock("@/lib/Auto.js", () => ({
  pushOrdersToServer: mockPushOrdersToServer,
}))

vi.mock("@/lib/networkFee", () => ({
  DEFAULT_BASE_NETWORK_FEE_XEC: 4.76,
  estimateNetworkFeeXecFromAddress: mockEstimateNetworkFeeXecFromAddress,
}))

import TokenPage from "@/app/[name]/page"

const TOKEN_ID =
  "ac31bb0bccf33de1683efce4da64f1cb6d8e8d6e098bc01c51d5864deb0e783f"

const ORDER_BOOK = {
  orders: [
    { price: 1, amount: 100 },
    { price: 2, amount: 100 },
  ],
  stats: {
    total_value: 300,
  },
}

const renderTokenPage = () => render(<TokenPage />)

const getSpendInputs = () =>
  screen
    .getAllByPlaceholderText("0")
    .filter((input): input is HTMLInputElement => {
      return input instanceof HTMLInputElement && !input.readOnly
    })

const waitForOrderBook = async () => {
  await waitFor(() => {
    expect(mockFetchAgoraOrderBook).toHaveBeenCalledWith(TOKEN_ID)
  })
}

describe("TokenPage buy panel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    mockUseParams.mockReturnValue({ name: "starcrystal" })
    mockUseWallet.mockReturnValue({
      isWalletConnected: true,
      ecashAddress: "ecash:test-address",
      isGuestMode: false,
      balance: "1000",
      userTokens: {},
    })
    mockEstimateNetworkFeeXecFromAddress.mockResolvedValue({
      fee: 4.76,
      utxoCount: 1,
      selectedInputCount: 1,
    })
    mockFetchAgoraOrderBook.mockResolvedValue({
      success: true,
      data: ORDER_BOOK,
    })
    mockGetTokenSupply.mockResolvedValue("5120000")
    mockIsEtokenDbAvailable.mockResolvedValue(false)
    mockLoadTokenPageStats.mockResolvedValue({
      source: "chronik",
      nextChainTipHeight: 900000,
      stats: {
        latestPrice: 1,
        priceChange24h: 0,
        last24HoursXECAmount: 0,
        last30DaysXECAmount: 0,
        totalTransactions: 0,
        totalXECAmount: 0,
        tokenId: TOKEN_ID,
        tokenName: "StarCrystal",
      },
    })
    mockWatchAgoraTokens.mockReturnValue(() => {})
    mockPushOrdersToServer.mockResolvedValue({})
    mockExecuteOrders.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
  })

  it("shows the shared estimated fee total without the old UTXO-count fee display", async () => {
    renderTokenPage()

    await waitFor(() => {
      expect(mockEstimateNetworkFeeXecFromAddress).toHaveBeenCalledWith(
        "ecash:test-address",
      )
    })

    expect(screen.getAllByText("Estimated fees")).toHaveLength(2)
    expect(screen.getAllByText("4.76 XEC")).toHaveLength(2)
    expect(screen.queryByText("Network fee")).not.toBeInTheDocument()
    expect(screen.queryByText("Total fees")).not.toBeInTheDocument()
    expect(screen.queryByText("22.00 XEC")).not.toBeInTheDocument()
  })

  it("calculates sweep receive amount, average price, slippage, and fee summary from the order book", async () => {
    renderTokenPage()
    await waitForOrderBook()

    fireEvent.change(getSpendInputs()[0], { target: { value: "200" } })

    await waitFor(() => {
      expect(screen.getAllByDisplayValue("144.890000").length).toBeGreaterThan(0)
    })
    expect(screen.getAllByText("Average Price: 1.3098 XEC").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Market + 30.98%").length).toBeGreaterThan(0)
    expect(screen.getAllByText("10.22 XEC").length).toBeGreaterThan(0)
  })

  it("shows the minimum fee error when the spend amount cannot cover buy fees", async () => {
    renderTokenPage()
    await waitForOrderBook()

    fireEvent.change(getSpendInputs()[0], { target: { value: "5" } })

    await waitFor(() => {
      expect(
        screen.getAllByText(
          "Amount must be greater than 10.22 XEC to cover the estimated swap and network fees",
        ).length,
      ).toBeGreaterThan(0)
    })
  })

  it("uses the same minimum fee threshold for the Max balance prompt", async () => {
    mockUseWallet.mockReturnValue({
      isWalletConnected: true,
      ecashAddress: "ecash:test-address",
      isGuestMode: false,
      balance: "5",
      userTokens: {},
    })

    renderTokenPage()

    fireEvent.click(screen.getAllByRole("button", { name: "Max" })[0])

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Insufficient balance",
        description:
          "You need at least 10.22 XEC to cover the estimated swap and network fees",
        variant: "destructive",
      }),
    )
  })

  it("shows the updated chart selector label for the price chart", async () => {
    renderTokenPage()

    const selectors = screen.getAllByRole("combobox")
    expect(selectors.some((node) => node.textContent?.includes("Price"))).toBe(true)
    expect(screen.queryByText("Real-time Price")).not.toBeInTheDocument()
  })

  it("saves a buy order after a valid sweep quote is created", async () => {
    renderTokenPage()
    await waitForOrderBook()

    fireEvent.change(getSpendInputs()[0], { target: { value: "200" } })
    await waitFor(() => {
      expect(screen.getAllByDisplayValue("144.890000").length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getAllByRole("button", { name: "Swap🔥" })[0])

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "✅ Order created successfully",
        }),
      )
    })

    const storedOrders = JSON.parse(localStorage.getItem("swap_orders") || "{}")
    const [orderKey] = Object.keys(storedOrders)

    expect(orderKey).toMatch(new RegExp(`^${TOKEN_ID}\\|ecash:test-address\\|2\\|`))
    expect(storedOrders[orderKey]).toMatchObject({
      maxPrice: 2,
      orderType: "online",
      status: "pending",
      transactions: [],
    })
    expect(storedOrders[orderKey].remainingAmount).toBeCloseTo(144.89, 6)
    expect(mockExecuteOrders).toHaveBeenCalledTimes(1)
    expect(mockPushOrdersToServer).toHaveBeenCalledWith(
      storedOrders,
      "ecash:test-address",
    )
  })
})
