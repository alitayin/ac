import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"

const {
  mockFetchAgoraOrderBook,
  mockGetTokenSupply,
  mockIsEtokenDbAvailable,
  mockLoadTokenPageStats,
  mockQueueOrdersSync,
  mockToast,
  mockUseParams,
  mockUseWallet,
  mockWatchAgoraTokens,
  mockEstimateNetworkFeeXecFromAddress,
} = vi.hoisted(() => ({
  mockFetchAgoraOrderBook: vi.fn(),
  mockGetTokenSupply: vi.fn(),
  mockIsEtokenDbAvailable: vi.fn(),
  mockLoadTokenPageStats: vi.fn(),
  mockQueueOrdersSync: vi.fn(),
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

vi.mock("@/components/ui/TokenCommentsPanel", () => ({
  default: ({ variant = "main" }: { variant?: "main" | "sidebar" }) => (
    <div data-testid={`token-comments-panel-${variant}`} />
  ),
}))

vi.mock("@/components/ui/TokenProjectInfoCard", () => ({
  default: ({
    tokenId,
    tokenName,
    authPubkey,
    buyHref,
  }: {
    tokenId: string
    tokenName: string
    authPubkey?: string | null
    buyHref?: string | null
  }) => (
    <div data-testid="token-project-info-card">
      {tokenName}:{tokenId}:{authPubkey ?? ""}
      {buyHref ? <a href={buyHref}>Buy</a> : null}
    </div>
  ),
}))

vi.mock("@/components/ui/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/lib/context/WalletContext", () => ({
  useWallet: mockUseWallet,
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
  queueOrdersSync: mockQueueOrdersSync,
}))

vi.mock("@/lib/networkFee", () => ({
  DEFAULT_BASE_NETWORK_FEE_XEC: 12,
  estimateNetworkFeeXecFromAddress: mockEstimateNetworkFeeXecFromAddress,
}))

import TokenPage from "@/app/[name]/page"
import { fetchTokenDetails } from "@/lib/chronik"

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

const AUTH_PUBKEY =
  "0334b744e6338ad438c92900c0ed1869c3fd2c0f35a4a9b97a88447b6e2b145f10"

const mockFetchTokenDetails = vi.mocked(fetchTokenDetails)

const renderTokenPage = () => render(<TokenPage />)

const waitForOrderBook = async () => {
  await waitFor(() => {
    expect(mockFetchAgoraOrderBook).toHaveBeenCalledWith(TOKEN_ID)
  })
}

describe("TokenPage", () => {
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
      publicKeyHex: "",
    })
    mockFetchTokenDetails.mockResolvedValue({
      genesisInfo: {
        tokenName: "StarCrystal",
        tokenTicker: "SC",
        decimals: 0,
        authPubkey: AUTH_PUBKEY,
      },
    } as any)
    mockEstimateNetworkFeeXecFromAddress.mockResolvedValue({
      fee: 19,
      utxoCount: 1,
      selectedInputCount: 1,
    })
    mockQueueOrdersSync.mockResolvedValue(true)
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
        latestPrice: 2,
        priceChange24h: 12.34,
        last24HoursXECAmount: 1234,
        last30DaysXECAmount: 5678,
        totalTransactions: 42,
        totalXECAmount: 0,
        tokenId: TOKEN_ID,
        tokenName: "StarCrystal",
      },
    })
    mockWatchAgoraTokens.mockReturnValue(() => {})
    mockQueueOrdersSync.mockResolvedValue(true)
  })

  afterEach(() => {
    cleanup()
  })

  it("renders project info cards instead of token-page swap panels", async () => {
    renderTokenPage()

    await waitFor(() => {
      expect(screen.getAllByTestId("token-project-info-card")).toHaveLength(2)
    })

    await waitFor(() => {
      expect(mockFetchTokenDetails).toHaveBeenCalledWith(TOKEN_ID)
    })
    expect(screen.getAllByTestId("token-project-info-card")[0]).toHaveTextContent(AUTH_PUBKEY)
    const buyLinks = screen.getAllByRole("link", { name: "Buy" })
    expect(buyLinks).toHaveLength(2)
    buyLinks.forEach((link) => {
      expect(link).toHaveAttribute(
        "href",
        `/swap?tokenId=${TOKEN_ID}&tokenName=StarCrystal`,
      )
    })
    expect(screen.getAllByText("Stats")).toHaveLength(2)
    expect(screen.getAllByText("10.24M XEC")).toHaveLength(2)
    expect(screen.getAllByText("2.0000")).toHaveLength(2)
    expect(screen.getAllByText("+12.34%")).toHaveLength(2)
    expect(screen.getAllByText("42")).toHaveLength(2)
    expect(screen.queryByText("Swap🔥")).not.toBeInTheDocument()
    expect(screen.queryByText("Estimated fees")).not.toBeInTheDocument()
  })

  it("shows the updated chart selector label for the price chart", async () => {
    renderTokenPage()

    const selectors = screen.getAllByRole("combobox")
    expect(selectors.some((node) => node.textContent?.includes("Price"))).toBe(true)
    expect(screen.queryByText("Real-time Price")).not.toBeInTheDocument()
  })

  it("shows the Comments tab and sidebar comments panel on the default trading view", () => {
    renderTokenPage()

    expect(screen.getByText("Comments")).toBeInTheDocument()
    expect(screen.getByTestId("token-comments-panel-sidebar")).toBeInTheDocument()
    expect(screen.queryByTestId("token-comments-panel-main")).not.toBeInTheDocument()
  })

  it("renders the desktop right rail in project info, comments, order book order", () => {
    renderTokenPage()

    const projectInfo = screen.getAllByTestId("token-project-info-card")[1]
    const sidebarComments = screen.getByTestId("token-comments-panel-sidebar")
    const orderBook = screen.getByTestId("order-book")

    expect(
      projectInfo.compareDocumentPosition(sidebarComments) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      sidebarComments.compareDocumentPosition(orderBook) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it("moves comments into the main area when the Comments tab is selected", () => {
    renderTokenPage()

    fireEvent.click(screen.getByText("Comments"))

    expect(screen.getByTestId("token-comments-panel-main")).toBeInTheDocument()
    expect(screen.queryByTestId("token-comments-panel-sidebar")).not.toBeInTheDocument()
    expect(screen.getByTestId("order-book")).toBeInTheDocument()
  })

  it("keeps comments in the sidebar when the Order Book tab is selected", () => {
    renderTokenPage()

    fireEvent.click(screen.getByText("Order Book"))

    expect(screen.getByTestId("token-comments-panel-sidebar")).toBeInTheDocument()
    expect(screen.queryByTestId("token-comments-panel-main")).not.toBeInTheDocument()
  })

  it("still fetches the token order book for trading views", async () => {
    renderTokenPage()
    await waitForOrderBook()

    expect(screen.getByTestId("order-book")).toBeInTheDocument()
  })

  it("keeps the page available when the lazy order-book module fails", async () => {
    mockFetchAgoraOrderBook.mockRejectedValueOnce(new Error("chunk load failed"))

    renderTokenPage()
    await waitForOrderBook()

    expect(screen.getAllByTestId("token-project-info-card")).toHaveLength(2)
    expect(screen.getByTestId("order-book")).toBeInTheDocument()
  })
})
