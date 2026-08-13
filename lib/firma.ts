export const FIRMA_FACE_VALUE_USD = 1;

export type FirmaXecQuote = {
  requestedXecUsd: number;
  effectiveXecUsd: number;
  firmaBuybackUsd: number;
  agoraLowestAskUsd: number;
  bidLimitXecUsd: number;
  agoraLimitXecUsd: number;
  xecPerFirma: number;
  xecReceive: number;
  isLimitCapped: boolean;
  limitSource: "bid" | "agora" | null;
};

type FirmaXecQuoteInput = {
  firmaAmount: number;
  requestedXecUsd: number;
  marketXecUsd: number;
  firmaBidXec: number;
  agoraLowestAskXecPerFirma: number;
};

const isPositiveFinite = (value: number) =>
  Number.isFinite(value) && value > 0;

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
    !isPositiveFinite(firmaBidXec) ||
    !isPositiveFinite(agoraLowestAskXecPerFirma)
  ) {
    return null;
  }

  const bidLimitXecUsd = FIRMA_FACE_VALUE_USD / firmaBidXec;
  const agoraLimitXecUsd = FIRMA_FACE_VALUE_USD / agoraLowestAskXecPerFirma;
  const maximumXecUsd = Math.min(bidLimitXecUsd, agoraLimitXecUsd);
  const effectiveXecUsd = Math.min(requestedXecUsd, maximumXecUsd);
  const firmaBuybackUsd = firmaBidXec * marketXecUsd;
  const agoraLowestAskUsd = agoraLowestAskXecPerFirma * marketXecUsd;
  const xecPerFirma = FIRMA_FACE_VALUE_USD / effectiveXecUsd;
  const isLimitCapped = requestedXecUsd > maximumXecUsd;
  const limitSource = isLimitCapped
    ? agoraLimitXecUsd <= bidLimitXecUsd ? "agora" : "bid"
    : null;

  return {
    requestedXecUsd,
    effectiveXecUsd,
    firmaBuybackUsd,
    agoraLowestAskUsd,
    bidLimitXecUsd,
    agoraLimitXecUsd,
    xecPerFirma,
    xecReceive: firmaAmount * xecPerFirma,
    isLimitCapped,
    limitSource,
  };
};

export const getFirmaBidImpliedXecUsd = (firmaBidXec: number): number | null => {
  if (!isPositiveFinite(firmaBidXec)) {
    return null;
  }

  return FIRMA_FACE_VALUE_USD / firmaBidXec;
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
