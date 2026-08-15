export type FirmaXecQuote = {
  requestedXecUsd: number;
  effectiveXecUsd: number;
  firmaBuybackUsd: number;
  agoraLowestAskUsd: number;
  bidLimitXecUsd: number;
  agoraLimitXecUsd: number;
  requestedFirmaPerXec: number;
  buybackFirmaPerXec: number;
  xecPerFirma: number;
  xecReceive: number;
  isWithinBuybackRange: boolean;
  isLimitCapped: boolean;
  limitSource: "bid" | null;
};

type FirmaXecQuoteInput = {
  firmaAmount: number;
  requestedXecUsd: number;
  marketXecUsd: number;
  firmaBidXec: number;
  agoraLowestAskXecPerFirma?: number;
};

const isPositiveFinite = (value: number) =>
  Number.isFinite(value) && value > 0;

export const getFirmaBuybackUsd = (
  firmaBidXec: number,
  marketXecUsd: number,
): number | null => {
  if (!isPositiveFinite(firmaBidXec) || !isPositiveFinite(marketXecUsd)) {
    return null;
  }

  return firmaBidXec * marketXecUsd;
};

/**
 * Return the XEC price at the live Firma buyback bid.
 *
 * The service bid is quoted as XEC per Firma.  The Firma trading card uses
 * the reciprocal as its USDT/XEC quote (one Firma is the quote unit), so the
 * buyback reference is derived directly from the bid.  The live Firma/USDT
 * value remains available separately through getFirmaBuybackUsd.
 *
 * Keep the optional market argument for callers that still pass the external
 * XEC market price; it is intentionally not part of this reciprocal.
 */
export const getFirmaBuybackXecUsd = (
  firmaBidXec: number,
  _marketXecUsd?: number,
): number | null => {
  if (!isPositiveFinite(firmaBidXec)) {
    return null;
  }

  return 1 / firmaBidXec;
};

/** The live service-provider bid expressed as Firma/XEC. */
export const getFirmaBuybackFirmaPerXec = (
  firmaBidXec: number,
): number | null => {
  if (!isPositiveFinite(firmaBidXec)) {
    return null;
  }

  return 1 / firmaBidXec;
};

/**
 * Convert an Agora Firma ask (XEC per Firma) into the USD price per XEC
 * implied by the live Firma buyback value. This is deliberately different
 * from the ask's Binance-marked USD value per Firma: the latter describes
 * the Firma premium, while this value is the input price that reproduces the
 * exact XEC/Firma ask when an order is created.
 */
export const getFirmaAgoraXecUsd = (
  firmaBuybackUsd: number,
  agoraLowestAskXecPerFirma: number,
): number | null => {
  if (!isPositiveFinite(firmaBuybackUsd) || !isPositiveFinite(agoraLowestAskXecPerFirma)) {
    return null;
  }

  return firmaBuybackUsd / agoraLowestAskXecPerFirma;
};

export const calculateFirmaXecQuote = ({
  firmaAmount,
  requestedXecUsd,
  marketXecUsd,
  firmaBidXec,
  agoraLowestAskXecPerFirma,
}: FirmaXecQuoteInput): FirmaXecQuote | null => {
  if (
    !isPositiveFinite(firmaAmount) ||
    !isPositiveFinite(requestedXecUsd) ||
    !isPositiveFinite(marketXecUsd) ||
    !isPositiveFinite(firmaBidXec)
  ) {
    return null;
  }

  const firmaBuybackUsd = getFirmaBuybackUsd(firmaBidXec, marketXecUsd);
  if (firmaBuybackUsd === null) {
    return null;
  }

  const bidLimitXecUsd = getFirmaBuybackXecUsd(firmaBidXec, marketXecUsd);
  if (bidLimitXecUsd === null) {
    return null;
  }

  const agoraLimitXecUsd = getFirmaAgoraXecUsd(
    firmaBuybackUsd,
    agoraLowestAskXecPerFirma ?? 0,
  ) ?? 0;
  // Selling Firma for XEC must never offer fewer XEC than the live service-provider bid.
  // The Agora ask is market context only; using it as a cap could force a below-bid sale.
  const maximumXecUsd = bidLimitXecUsd;
  const effectiveXecUsd = Math.min(requestedXecUsd, maximumXecUsd);
  const agoraLowestAskUsd = (agoraLowestAskXecPerFirma ?? 0) * marketXecUsd;
  const requestedFirmaPerXec = requestedXecUsd / firmaBuybackUsd;
  const buybackFirmaPerXec = getFirmaBuybackFirmaPerXec(firmaBidXec);
  if (buybackFirmaPerXec === null) {
    return null;
  }
  const requestedXecPerFirma = 1 / requestedXecUsd;
  const xecPerFirma = 1 / effectiveXecUsd;
  const isWithinBuybackRange = requestedXecPerFirma >= firmaBidXec;
  const isLimitCapped = !isWithinBuybackRange;
  const limitSource = isLimitCapped ? "bid" : null;

  return {
    requestedXecUsd,
    effectiveXecUsd,
    firmaBuybackUsd,
    agoraLowestAskUsd,
    bidLimitXecUsd,
    agoraLimitXecUsd,
    requestedFirmaPerXec,
    buybackFirmaPerXec,
    xecPerFirma,
    xecReceive: firmaAmount * xecPerFirma,
    isWithinBuybackRange,
    isLimitCapped,
    limitSource,
  };
};

export const formatUsdPerXec = (value: number): string =>
  isPositiveFinite(value) ? value.toFixed(8) : "--";

export const formatFirmaUsd = (value: number): string =>
  isPositiveFinite(value) ? value.toFixed(3) : "--";

export const formatFirmaPriceInput = (value: number): string => {
  if (!isPositiveFinite(value)) {
    return "";
  }

  const truncated = Math.floor(value * 1_000_000_000_000) / 1_000_000_000_000;
  return truncated.toFixed(12);
};
