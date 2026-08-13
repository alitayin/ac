import { describe, expect, it } from "vitest";

import {
  calculateFirmaXecQuote,
  formatFirmaPriceInput,
  formatFirmaUsd,
  formatUsdPerXec,
  getFirmaBidImpliedXecUsd,
} from "@/lib/firma";

describe("Firma/XEC quotes", () => {
  const firmaBidXec = 146_205.44;
  const agoraLowestAskXecPerFirma = 156_534.955134;
  const marketXecUsd = 0.00000681;

  it("uses the requested limit when it is below both Firma limits", () => {
    const quote = calculateFirmaXecQuote({
      firmaAmount: 10,
      requestedXecUsd: 0.0000061,
      marketXecUsd,
      firmaBidXec,
      agoraLowestAskXecPerFirma,
    });

    expect(quote).not.toBeNull();
    expect(quote?.effectiveXecUsd).toBe(0.0000061);
    expect(quote?.isLimitCapped).toBe(false);
    expect(quote?.firmaBuybackUsd).toBeCloseTo(0.995659, 6);
    expect(quote?.agoraLowestAskUsd).toBeCloseTo(1.066003, 6);
    expect(quote?.xecPerFirma).toBeCloseTo(163_934.43, 2);
  });

  it("caps an above-market limit at the lowest Agora ask", () => {
    const quote = calculateFirmaXecQuote({
      firmaAmount: 10,
      requestedXecUsd: 0.0000075,
      marketXecUsd,
      firmaBidXec,
      agoraLowestAskXecPerFirma,
    });

    expect(quote?.effectiveXecUsd).toBeCloseTo(1 / agoraLowestAskXecPerFirma, 14);
    expect(quote?.isLimitCapped).toBe(true);
    expect(quote?.limitSource).toBe("agora");
    expect(quote?.xecPerFirma).toBeCloseTo(agoraLowestAskXecPerFirma, 6);
    expect(quote?.xecReceive).toBeCloseTo(1_565_349.55134, 6);
  });

  it("uses the Firma bid when it is the tighter limit", () => {
    const tighterBidXec = 160_000;
    const quote = calculateFirmaXecQuote({
      firmaAmount: 1,
      requestedXecUsd: 0.0000075,
      marketXecUsd,
      firmaBidXec: tighterBidXec,
      agoraLowestAskXecPerFirma: 150_000,
    });

    expect(quote?.effectiveXecUsd).toBeCloseTo(1 / tighterBidXec, 14);
    expect(quote?.limitSource).toBe("bid");
    expect(quote?.xecPerFirma).toBe(tighterBidXec);
  });

  it("converts the Firma bid into the face-value USD price for one XEC", () => {
    expect(getFirmaBidImpliedXecUsd(firmaBidXec)).toBeCloseTo(
      1 / firmaBidXec,
      12,
    );
    expect(formatUsdPerXec(1 / firmaBidXec)).toBe("0.00000684");
    expect(formatFirmaUsd(firmaBidXec * marketXecUsd)).toBe("0.996");
    expect(formatFirmaPriceInput(1 / agoraLowestAskXecPerFirma)).toBe("0.000006388349");
  });

  it("rejects incomplete or non-positive quotes", () => {
    expect(calculateFirmaXecQuote({
      firmaAmount: 0,
      requestedXecUsd: 0.0000061,
      marketXecUsd,
      firmaBidXec,
      agoraLowestAskXecPerFirma,
    })).toBeNull();
    expect(getFirmaBidImpliedXecUsd(0)).toBeNull();
    expect(formatUsdPerXec(Number.NaN)).toBe("--");
  });
});
