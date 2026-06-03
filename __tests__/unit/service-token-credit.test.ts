import { describe, expect, it } from "vitest";
import {
  STAR_CRYSTAL_TOKEN_ID,
  STAR_SHARD_TOKEN_ID,
  creditSatsToXec,
  getServiceCreditQuote,
} from "@/lib/service-token-credit";

describe("service-token-credit", () => {
  it("converts credit sats to XEC", () => {
    expect(creditSatsToXec("546")).toBe(5.46);
  });

  it("uses SS when it can cover the fee with the smallest overpay", () => {
    const quote = getServiceCreditQuote(546n, {
      [STAR_SHARD_TOKEN_ID]: "2",
      [STAR_CRYSTAL_TOKEN_ID]: "1",
    });

    expect(quote.canCover).toBe(true);
    expect(quote.creditSats).toBe("1000");
    expect(quote.overpaySats).toBe("454");
    expect(quote.redemptions).toEqual([
      expect.objectContaining({
        symbol: "SS",
        amountAtoms: "2",
      }),
    ]);
  });

  it("uses SC when SS cannot cover the fee", () => {
    const quote = getServiceCreditQuote(546n, {
      [STAR_SHARD_TOKEN_ID]: "1",
      [STAR_CRYSTAL_TOKEN_ID]: "1",
    });

    expect(quote.canCover).toBe(true);
    expect(quote.creditSats).toBe("30000");
    expect(quote.overpaySats).toBe("29454");
    expect(quote.redemptions).toEqual([
      expect.objectContaining({
        symbol: "SC",
        amountAtoms: "1",
      }),
    ]);
  });

  it("returns unavailable when balances cannot cover the required fee", () => {
    const quote = getServiceCreditQuote(546n, {
      [STAR_SHARD_TOKEN_ID]: "1",
    });

    expect(quote.canCover).toBe(false);
    expect(quote.creditSats).toBe("0");
    expect(quote.redemptions).toEqual([]);
  });
});

