import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SwapPanel } from "@/app/swap/SwapPanel";

const {
  walletState,
  toastMock,
  executeOrdersMock,
  fetchAgoraOrderBookMock,
  fetchAgoraTransactionsMock,
  estimateNetworkFeeMock,
  getCachedTokenDetailsMock,
  fetchTokenDetailsMock,
  createAgoraOfferMock,
} = vi.hoisted(() => ({
  walletState: {
    isWalletConnected: true,
    ecashAddress: "ecash:qp-test-wallet",
    balance: "1000",
    userTokens: {
      "token-1": "1234500",
    } as Record<string, string>,
    connectWallet: vi.fn(),
    connectWithCashtab: vi.fn(),
    disconnectWallet: vi.fn(),
    isGuestMode: false,
    mnemonic: "test mnemonic",
  },
  toastMock: vi.fn(),
  executeOrdersMock: vi.fn(),
  fetchAgoraOrderBookMock: vi.fn(),
  fetchAgoraTransactionsMock: vi.fn(),
  estimateNetworkFeeMock: vi.fn(),
  getCachedTokenDetailsMock: vi.fn(),
  fetchTokenDetailsMock: vi.fn(),
  createAgoraOfferMock: vi.fn(),
}));

vi.mock("ecash-quicksend", () => ({
  createAgoraOffer: createAgoraOfferMock,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

vi.mock("@/lib/context/WalletContext", () => ({
  useWallet: () => walletState,
}));

vi.mock("@/lib/context/AutoExecutionContext", () => ({
  useAutoExecution: () => ({
    executeOrders: executeOrdersMock,
  }),
}));

vi.mock("@/lib/price", () => ({
  useXECPrice: () => 0.00003,
}));

vi.mock("@/hooks/use-firma-bid", () => ({
  useFirmaBid: () => ({
    bid: 146205.44,
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/lib/agora-orders", () => ({
  fetchAgoraOrderBook: fetchAgoraOrderBookMock,
}));

vi.mock("@/lib/chronik-transactions", () => ({
  fetchAgoraTransactionsFromChronik: fetchAgoraTransactionsMock,
}));

vi.mock("@/lib/networkFee", () => ({
  DEFAULT_BASE_NETWORK_FEE_XEC: 12,
  estimateNetworkFeeXecFromAddress: estimateNetworkFeeMock,
}));

vi.mock("@/lib/chronik", () => ({
  getCachedTokenDetails: getCachedTokenDetailsMock,
  fetchTokenDetails: fetchTokenDetailsMock,
}));

vi.mock("@/components/ui/OrderBook", () => ({
  default: () => <div data-testid="order-book" />,
}));

vi.mock("@/components/ui/orderlist", () => ({
  OrderList: () => <div data-testid="order-list" />,
}));

vi.mock("@/components/ui/listinglist", () => ({
  ListingList: () => <div data-testid="listing-list" />,
}));

vi.mock("@/components/swap/WalletConnectDrawerInner", () => ({
  default: () => <div data-testid="wallet-connect-drawer" />,
}));

vi.mock("@/components/swap/ConfirmOrderDialog", () => ({
  default: () => null,
}));

vi.mock("@/components/swap/PriceCard", () => {
  const PriceCard = (props: any) => (
    <div data-testid="price-card" data-title={props.title}>
      <div data-testid="selected-token">{props.selectedToken.name}</div>
      <div data-testid="price-input">{props.tokenPriceInput}</div>
      <input
        aria-label={props.title || "Token price"}
        value={props.tokenPriceInput}
        onChange={(event) => props.onTokenPriceInputChange(event.target.value)}
      />
      {props.referencePrices?.map((reference: any) => (
        <div key={reference.label}>{reference.label} {reference.value}</div>
      ))}
      {props.onSweepModeToggle ? (
        <button type="button" onClick={props.onSweepModeToggle}>
          {props.sweepModeEnabled ? "Market Buy" : "Limit Buy"}
        </button>
      ) : null}
      <button
        type="button"
        aria-label={props.title ? `${props.title} Market` : "Market"}
        onClick={props.onMarketClick}
      >
        Market
      </button>
    </div>
  );

  return {
    default: PriceCard,
    PriceCard,
  };
});

vi.mock("@/components/swap/SpendCard", () => {
  const SpendCard = (props: any) => (
    <div data-testid="spend-card">
      <input
        aria-label="Spend amount"
        value={props.spendAmount}
        onChange={(event) => {
          props.setSpendAmount(event.target.value);
          props.calculateReceiveAmount(event.target.value);
        }}
      />
      <div data-testid="estimated-fees">{props.totalFees.toFixed(2)}</div>
    </div>
  );

  return {
    default: SpendCard,
    SpendCard,
  };
});

vi.mock("@/components/swap/BuyCard", () => {
  const BuyCard = (props: any) => (
    <div data-testid="buy-card">
      <input
        aria-label={`${props.label} amount`}
        value={props.receiveAmount}
        readOnly={props.readOnly}
        onChange={(event) => props.setReceiveAmount(event.target.value)}
      />
      <span>{props.staticTokenLabel}</span>
    </div>
  );

  return {
    default: BuyCard,
    BuyCard,
  };
});

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({ children }: any) => <>{children}</>,
  DrawerTrigger: ({ children }: any) => <>{children}</>,
  DrawerContent: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: any) => <>{children}</>,
  DropdownMenuContent: ({ children }: any) => <>{children}</>,
  DropdownMenuItem: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: any) => <>{children}</>,
  Tooltip: ({ children }: any) => <>{children}</>,
  TooltipTrigger: ({ children }: any) => <>{children}</>,
  TooltipContent: ({ children }: any) => <>{children}</>,
}));

const orderBookResponse = {
  success: true,
  data: {
    orders: [
      { price: 0.25, amount: 100 },
      { price: 0.3, amount: 100 },
    ],
    stats: {
      min_price: 0.25,
      total_value: 55,
    },
  },
};

const flushAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("SwapPanel current behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    walletState.isWalletConnected = true;
    walletState.ecashAddress = "ecash:qp-test-wallet";
    walletState.balance = "1000";
    walletState.userTokens = {
      "token-1": "1234500",
    };
    walletState.isGuestMode = false;
    walletState.mnemonic = "test mnemonic";

    fetchAgoraOrderBookMock.mockResolvedValue(orderBookResponse);
    fetchAgoraTransactionsMock.mockResolvedValue([{ price: 0.18 }]);
    estimateNetworkFeeMock.mockResolvedValue({
      fee: 19,
      utxoCount: 1,
      selectedInputCount: 1,
    });
    getCachedTokenDetailsMock.mockReturnValue({
      genesisInfo: {
        tokenName: "Cached Token",
      },
    });
    fetchTokenDetailsMock.mockResolvedValue({
      genesisInfo: {
        tokenName: "Fetched Token",
      },
    });
    executeOrdersMock.mockResolvedValue(undefined);
    createAgoraOfferMock.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("auto-selects the first wallet token and hydrates the live price", async () => {
    render(<SwapPanel />);

    await act(async () => {
      await flushAsyncWork();
    });

    expect(screen.getByTestId("selected-token")).toHaveTextContent("Cached Token");
    expect(screen.getByTestId("price-input")).toHaveTextContent("0.25");
    expect(fetchAgoraOrderBookMock).toHaveBeenCalledTimes(1);
    expect(fetchAgoraOrderBookMock).toHaveBeenCalledWith("token-1");
  });

  it("uses the initial query token instead of the first wallet token", async () => {
    const queryTokenId =
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    render(
      <SwapPanel initialTokenId={queryTokenId} initialTokenName="Query Token" />,
    );

    await act(async () => {
      await flushAsyncWork();
    });

    expect(screen.getByTestId("selected-token")).toHaveTextContent("Query Token");
    expect(fetchAgoraOrderBookMock).toHaveBeenCalledWith(queryTokenId);
    expect(fetchAgoraOrderBookMock).not.toHaveBeenCalledWith("token-1");
  });

  it("reuses the cached order book inside the TTL and refetches after it expires", async () => {
    render(<SwapPanel />);

    await act(async () => {
      await flushAsyncWork();
    });

    expect(fetchAgoraOrderBookMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Market" }));
    expect(fetchAgoraOrderBookMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(10001);
      fireEvent.click(screen.getByRole("button", { name: "Market" }));
      await flushAsyncWork();
    });

    expect(fetchAgoraOrderBookMock).toHaveBeenCalledTimes(2);
  });

  it("starts polling only when the order book panel is visible and stops when hidden", async () => {
    render(<SwapPanel />);

    await act(async () => {
      await flushAsyncWork();
    });

    expect(fetchAgoraOrderBookMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(30000);
      await flushAsyncWork();
    });
    expect(fetchAgoraOrderBookMock).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", { name: "Toggle order book panel" }),
    );

    await act(async () => {
      vi.advanceTimersByTime(30000);
      await flushAsyncWork();
    });

    expect(fetchAgoraOrderBookMock).toHaveBeenCalledTimes(2);

    fireEvent.click(
      screen.getByRole("button", { name: "Toggle order book panel" }),
    );

    await act(async () => {
      vi.advanceTimersByTime(30000);
      await flushAsyncWork();
    });
    expect(fetchAgoraOrderBookMock).toHaveBeenCalledTimes(2);
  });

  it("shows the current minimum-fee validation in sweep mode", async () => {
    render(<SwapPanel />);

    await act(async () => {
      await flushAsyncWork();
    });

    fireEvent.click(screen.getByRole("button", { name: "Limit Buy" }));

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Spend amount"), {
        target: { value: "10" },
      });
      await flushAsyncWork();
    });

    expect(
      screen.getByText(
        "Amount must be greater than 24.46 XEC to cover the estimated swap and network fees",
      ),
    ).toBeInTheDocument();
  });

  it("uses the Firma bid for Market and caps above-market limits", async () => {
    const firmaTokenId =
      "0387947fd575db4fb19a3e322f635dec37fd192b5941625b66bc4b2c3008cbf0";
    walletState.userTokens = {
      "token-1": "1234500",
      [firmaTokenId]: "1000000",
    };

    render(<SwapPanel />);

    await act(async () => {
      fireEvent.mouseDown(screen.getByRole("tab", { name: "Firma/XEC" }), {
        button: 0,
        ctrlKey: false,
      });
      await flushAsyncWork();
    });

    fireEvent.click(screen.getByRole("button", { name: "Set max price for 1 XEC Market" }));

    expect(screen.getByLabelText("Set max price for 1 XEC")).toHaveValue("0.00003000");
    expect(screen.getByText(/Firma buyback: \$0.00000684\/XEC/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Set max price for 1 XEC"), {
      target: { value: "0.00004" },
    });
    fireEvent.change(screen.getByLabelText("Spend amount"), {
      target: { value: "10" },
    });

    expect(screen.getByText(/cannot fill at a worse price/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create Firma/XEC Order" }));

    await act(async () => {
      await flushAsyncWork();
    });

    expect(createAgoraOfferMock).toHaveBeenCalledWith(expect.objectContaining({
      tokenId: firmaTokenId,
      tokenAmount: 100000n,
      pricePerToken: 14.620544,
    }));
  });
});
