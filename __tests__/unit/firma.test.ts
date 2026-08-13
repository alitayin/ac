import { describe, expect, it } from "vitest";

import {
  calculateFirmaXecQuote,
  formatUsdPerXec,
  getFirmaBidImpliedXecUsd,
} from "@/lib/firma";

describe("Firma/XEC quotes", () => {
  const firmaBidXec = 146_205.44;
  const marketXecUsd = 0.00000681;

  it("uses the requested limit when it is below the XEC market", () => {
    const quote = calculateFirmaXecQuote({
      firmaAmount: 10,
      requestedXecUsd: 0.0000061,
      marketXecUsd,
      firmaBidXec,
    });

    expect(quote).not.toBeNull();
    expect(quote?.effectiveXecUsd).toBe(0.0000061);
    expect(quote?.isMarketPriceApplied).toBe(false);
    expect(quote?.firmaBuybackUsd).toBeCloseTo(0.995659, 6);
    expect(quote?.xecPerFirma).toBeCloseTo(163_222.79, 2);
  });

  it("caps an above-market limit at the current market price", () => {
    const quote = calculateFirmaXecQuote({
      firmaAmount: 10,
      requestedXecUsd: 0.0000075,
      marketXecUsd,
      firmaBidXec,
    });

    expect(quote?.effectiveXecUsd).toBe(marketXecUsd);
    expect(quote?.isMarketPriceApplied).toBe(true);
    expect(quote?.xecPerFirma).toBeCloseTo(firmaBidXec, 8);
    expect(quote?.xecReceive).toBeCloseTo(1_462_054.4, 6);
  });

  it("converts the Firma bid into the face-value USD price for one XEC", () => {
    expect(getFirmaBidImpliedXecUsd(firmaBidXec)).toBeCloseTo(
      1 / firmaBidXec,
      12,
    );
    expect(formatUsdPerXec(1 / firmaBidXec)).toBe("0.00000684");
  });

  it("rejects incomplete or non-positive quotes", () => {
    expect(calculateFirmaXecQuote({
      firmaAmount: 0,
      requestedXecUsd: 0.0000061,
      marketXecUsd,
      firmaBidXec,
    })).toBeNull();
    expect(getFirmaBidImpliedXecUsd(0)).toBeNull();
    expect(formatUsdPerXec(Number.NaN)).toBe("--");
  });
});
