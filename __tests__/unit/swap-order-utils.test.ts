import { describe, expect, it, beforeEach, vi } from "vitest";

import {
  createSwapOrderKey,
  getActiveOnlineOrderTokenIdsForAddress,
  hasActiveOnlineOrdersForAddress,
  saveSwapOrder,
} from "@/lib/swap-order-utils";

describe("swap-order-utils", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("creates unique order keys for repeated orders at the same price", () => {
    const firstKey = createSwapOrderKey("token-1", "ecash:addr", 100);
    const secondKey = createSwapOrderKey("token-1", "ecash:addr", 100);

    expect(firstKey).not.toBe(secondKey);
    expect(firstKey).toMatch(/^token-1\|ecash:addr\|100\|[A-Za-z]{8}$/);
    expect(secondKey).toMatch(/^token-1\|ecash:addr\|100\|[A-Za-z]{8}$/);
  });

  it("only treats online orders with remaining amount as active auto-execution orders", () => {
    saveSwapOrder("online-1|ecash:addr|100|abc12345", {
      remainingAmount: 10,
      maxPrice: 100,
      status: "pending",
      orderType: "online",
      transactions: [],
    });
    saveSwapOrder("offline-1|ecash:addr|200|abc12346", {
      remainingAmount: 10,
      maxPrice: 200,
      status: "pending",
      orderType: "offline",
      transactions: [],
    });
    saveSwapOrder("done-1|ecash:addr|300|abc12347", {
      remainingAmount: 0,
      maxPrice: 300,
      status: "completed",
      orderType: "online",
      transactions: [],
    });

    expect(hasActiveOnlineOrdersForAddress("ecash:addr")).toBe(true);
    expect(getActiveOnlineOrderTokenIdsForAddress("ecash:addr")).toEqual([
      "online-1",
    ]);
  });
});
