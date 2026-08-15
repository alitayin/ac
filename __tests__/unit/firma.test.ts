import { describe, expect, it } from "vitest";

import {
  calculateFirmaXecQuote,
  formatFirmaPriceInput,
  formatFirmaUsd,
  formatUsdPerXec,
  getFirmaBuybackFirmaPerXec,
  getFirmaBuybackXecUsd,
  getFirmaAgoraXecUsd,
  getFirmaBuybackUsd,
} from "@/lib/firma";

describe("Firma/XEC quotes", () => {
  const firmaBidXec = 146_205.44;
  const agoraLowestAskXecPerFirma = 156_534.955134;
  const marketXecUsd = 0.00000681;

  it("uses the requested limit when it is within the Firma buyback range", () => {
    const quote = calculateFirmaXecQuote({
      firmaAmount: 10,
      requestedXecUsd: 0.0000061,
      marketXecUsd,
      firmaBidXec,
      agoraLowestAskXecPerFirma,
    });

    expect(quote).not.toBeNull();
    expect(quote?.effectiveXecUsd).toBe(0.0000061);
    expect(quote?.isWithinBuybackRange).toBe(true);
    expect(quote?.isLimitCapped).toBe(false);
    expect(quote?.firmaBuybackUsd).toBeCloseTo(0.995659, 6);
    expect(quote?.agoraLowestAskUsd).toBeCloseTo(1.066003, 6);
    expect(quote?.xecPerFirma).toBeCloseTo(163_934.43, 2);
  });

  it("caps an above-market limit at the Firma buyback bid", () => {
    const quote = calculateFirmaXecQuote({
      firmaAmount: 10,
      requestedXecUsd: 0.0000075,
      marketXecUsd,
      firmaBidXec,
      agoraLowestAskXecPerFirma,
    });

    expect(quote?.effectiveXecUsd).toBeCloseTo(1 / firmaBidXec, 14);
    expect(quote?.isWithinBuybackRange).toBe(false);
    expect(quote?.isLimitCapped).toBe(true);
    expect(quote?.limitSource).toBe("bid");
    expect(quote?.xecPerFirma).toBeCloseTo(firmaBidXec, 6);
    expect(quote?.xecReceive).toBeCloseTo(1_462_054.4, 6);
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
    expect(quote?.isWithinBuybackRange).toBe(false);
    expect(quote?.limitSource).toBe("bid");
    expect(quote?.xecPerFirma).toBe(tighterBidXec);
  });

  it("converts live Firma bid and Agora ask into USD prices", () => {
    const firmaBuybackUsd = getFirmaBuybackUsd(firmaBidXec, marketXecUsd);

    expect(firmaBuybackUsd).toBeCloseTo(0.995659, 6);
    expect(getFirmaBuybackXecUsd(firmaBidXec, marketXecUsd)).toBeCloseTo(1 / firmaBidXec, 14);
    expect(getFirmaBuybackFirmaPerXec(firmaBidXec)).toBeCloseTo(1 / firmaBidXec, 14);
    expect(formatUsdPerXec(firmaBuybackUsd! / firmaBidXec)).toBe("0.00000681");
    expect(formatFirmaUsd(firmaBidXec * marketXecUsd)).toBe("0.996");
    expect(formatFirmaPriceInput(firmaBuybackUsd! / agoraLowestAskXecPerFirma)).toBe("0.000006360617");
    expect(getFirmaAgoraXecUsd(firmaBuybackUsd!, agoraLowestAskXecPerFirma)).toBeCloseTo(
      0.000006360617,
      11,
    );
  });

  it("does not require an Agora ask to evaluate the buyback range", () => {
    const quote = calculateFirmaXecQuote({
      firmaAmount: 1,
      requestedXecUsd: 0.0000061,
      marketXecUsd,
      firmaBidXec,
    });

    expect(quote?.isWithinBuybackRange).toBe(true);
    expect(quote?.agoraLowestAskUsd).toBe(0);
  });

  it("rejects incomplete or non-positive quotes", () => {
    expect(calculateFirmaXecQuote({
      firmaAmount: 0,
      requestedXecUsd: 0.0000061,
      marketXecUsd,
      firmaBidXec,
      agoraLowestAskXecPerFirma,
    })).toBeNull();
    expect(getFirmaBuybackUsd(0, marketXecUsd)).toBeNull();
    expect(formatUsdPerXec(Number.NaN)).toBe("--");
  });
});
