export const FIRMA_FACE_VALUE_USD = 1;

export type FirmaXecQuote = {
  requestedXecUsd: number;
  effectiveXecUsd: number;
  firmaBuybackUsd: number;
  xecPerFirma: number;
  xecReceive: number;
  isMarketPriceApplied: boolean;
};

type FirmaXecQuoteInput = {
  firmaAmount: number;
  requestedXecUsd: number;
  marketXecUsd: number;
  firmaBidXec: number;
};

const isPositiveFinite = (value: number) =>
  Number.isFinite(value) && value > 0;

export const calculateFirmaXecQuote = ({
  firmaAmount,
  requestedXecUsd,
  marketXecUsd,
  firmaBidXec,
}: FirmaXecQuoteInput): FirmaXecQuote | null => {
  if (
    !isPositiveFinite(firmaAmount) ||
    !isPositiveFinite(requestedXecUsd) ||
    !isPositiveFinite(marketXecUsd) ||
    !isPositiveFinite(firmaBidXec)
  ) {
    return null;
  }

  const effectiveXecUsd = Math.min(requestedXecUsd, marketXecUsd);
  const firmaBuybackUsd = firmaBidXec * marketXecUsd;
  const xecPerFirma = firmaBuybackUsd / effectiveXecUsd;

  return {
    requestedXecUsd,
    effectiveXecUsd,
    firmaBuybackUsd,
    xecPerFirma,
    xecReceive: firmaAmount * xecPerFirma,
    isMarketPriceApplied: requestedXecUsd > marketXecUsd,
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
