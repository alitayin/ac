import React from "react";
import { act, render } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { AutoExecutionProvider } from "@/lib/context/AutoExecutionContext";
import { ORDERS_UPDATED_EVENT } from "@/lib/swap-order-utils";

const processOrdersMock = vi.fn();
const watchOrderTokensMock = vi.fn();
const useWalletMock = vi.fn();

vi.mock("@/lib/Auto.js", () => ({
  processOrders: (...args: unknown[]) => processOrdersMock(...args),
}));

vi.mock("@/lib/swap-ws", () => ({
  watchOrderTokens: (...args: unknown[]) => watchOrderTokensMock(...args),
}));

vi.mock("@/lib/context/WalletContext", () => ({
  useWallet: () => useWalletMock(),
}));

describe("AutoExecutionProvider", () => {
  const flushEffects = async () => {
    await act(async () => {
      await Promise.resolve();
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();

    processOrdersMock.mockResolvedValue(undefined);
    watchOrderTokensMock.mockReturnValue(vi.fn());
    useWalletMock.mockReturnValue({
      isWalletConnected: true,
      ecashAddress: "ecash:addr",
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("runs immediately and starts polling when mounted with active online orders", async () => {
    localStorage.setItem(
      "swap_orders",
      JSON.stringify({
        "token-1|ecash:addr|100|abc12345": {
          remainingAmount: 10,
          maxPrice: 100,
          status: "pending",
          orderType: "online",
          transactions: [],
        },
      }),
    );

    render(
      <AutoExecutionProvider>
        <div>child</div>
      </AutoExecutionProvider>,
    );

    await flushEffects();

    expect(processOrdersMock).toHaveBeenCalledTimes(1);
    expect(watchOrderTokensMock).toHaveBeenCalledWith(
      ["token-1"],
      expect.any(Function),
    );

    await act(async () => {
      vi.advanceTimersByTime(60000);
      await Promise.resolve();
    });

    expect(processOrdersMock).toHaveBeenCalledTimes(2);
  });

  it("contains failures from the lazy auto-execution module", async () => {
    localStorage.setItem(
      "swap_orders",
      JSON.stringify({
        "token-1|ecash:addr|100|chunk-failure": {
          remainingAmount: 10,
          maxPrice: 100,
          status: "pending",
          orderType: "online",
          transactions: [],
        },
      }),
    );
    processOrdersMock.mockRejectedValueOnce(new Error("chunk load failed"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(
      <AutoExecutionProvider>
        <div>child</div>
      </AutoExecutionProvider>,
    );

    await flushEffects();

    expect(processOrdersMock).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to process orders:",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  it("ignores offline-only orders for auto execution", async () => {
    localStorage.setItem(
      "swap_orders",
      JSON.stringify({
        "token-1|ecash:addr|100|abc12345": {
          remainingAmount: 10,
          maxPrice: 100,
          status: "pending",
          orderType: "offline",
          transactions: [],
        },
      }),
    );

    render(
      <AutoExecutionProvider>
        <div>child</div>
      </AutoExecutionProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(processOrdersMock).not.toHaveBeenCalled();
    expect(watchOrderTokensMock).not.toHaveBeenCalled();
  });

  it("runs immediately after a created order event on the current page", async () => {
    render(
      <AutoExecutionProvider>
        <div>child</div>
      </AutoExecutionProvider>,
    );

    expect(processOrdersMock).not.toHaveBeenCalled();

    localStorage.setItem(
      "swap_orders",
      JSON.stringify({
        "token-2|ecash:addr|150|abc12346": {
          remainingAmount: 5,
          maxPrice: 150,
          status: "pending",
          orderType: "online",
          transactions: [],
        },
      }),
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent(ORDERS_UPDATED_EVENT, {
          detail: { reason: "created" },
        }),
      );
    });

    await flushEffects();

    expect(processOrdersMock).toHaveBeenCalledTimes(1);
    expect(watchOrderTokensMock).toHaveBeenCalledWith(
      ["token-2"],
      expect.any(Function),
    );
  });
});
