export const AGORA_SWAP_FEE_ADDRESS =
  "ecash:qpaw7v7sfvlsm4px33saggr63jgsalsx4q49m7n6v4";
export const AGORA_SWAP_FEE_BPS = 50;
export const AGORA_SWAP_FEE_RATE = AGORA_SWAP_FEE_BPS / 10000;
export const AGORA_SWAP_FEE_MIN_SATS = 546n;
export const AGORA_SWAP_FEE_MIN_XEC = Number(AGORA_SWAP_FEE_MIN_SATS) / 100;
export const AGORA_SWAP_FEE_LABEL = "0.5%";
export const AGORA_SWAP_FEE_DESCRIPTION = `${AGORA_SWAP_FEE_LABEL} swap fee (min ${AGORA_SWAP_FEE_MIN_XEC.toFixed(2)} XEC)`;

const SATS_PER_XEC = 100;

const normalizeXec = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return value;
};

export const xecToSats = (value: number): bigint => {
  const normalized = normalizeXec(value);
  if (normalized === 0) {
    return 0n;
  }

  return BigInt(Math.ceil(normalized * SATS_PER_XEC));
};

export const satsToXec = (value: bigint): number => Number(value) / SATS_PER_XEC;

export const calculateAgoraSwapFeeSats = (
  askedSats: bigint,
  minSats: bigint = AGORA_SWAP_FEE_MIN_SATS,
): bigint => {
  if (askedSats <= 0n) {
    return 0n;
  }

  const feeSats =
    (askedSats * BigInt(AGORA_SWAP_FEE_BPS) + 9999n) / 10000n;

  if (feeSats === 0n) {
    return 0n;
  }

  return feeSats < minSats ? minSats : feeSats;
};

export const calculateAgoraSwapFeeXec = (
  askedXec: number,
  minSats: bigint = AGORA_SWAP_FEE_MIN_SATS,
): number => {
  return satsToXec(calculateAgoraSwapFeeSats(xecToSats(askedXec), minSats));
};

export const calculateAgoraFeeSummary = (
  tokenCostXec: number,
  networkFeeXec: number,
) => {
  const normalizedTokenCostXec = normalizeXec(tokenCostXec);
  const normalizedNetworkFeeXec = normalizeXec(networkFeeXec);
  const swapFeeXec = calculateAgoraSwapFeeXec(normalizedTokenCostXec);
  const totalFeesXec = normalizedNetworkFeeXec + swapFeeXec;
  const totalCostXec = normalizedTokenCostXec + totalFeesXec;

  return {
    tokenCostXec: normalizedTokenCostXec,
    networkFeeXec: normalizedNetworkFeeXec,
    swapFeeXec,
    totalFeesXec,
    totalCostXec,
  };
};

export const estimateAgoraTokenCostFromBudget = (
  totalBudgetXec: number,
  networkFeeXec: number,
): number => {
  const normalizedBudgetXec = normalizeXec(totalBudgetXec);
  const normalizedNetworkFeeXec = normalizeXec(networkFeeXec);

  let tokenCostXec = Math.max(0, normalizedBudgetXec - normalizedNetworkFeeXec);

  for (let i = 0; i < 6; i += 1) {
    const swapFeeXec = calculateAgoraSwapFeeXec(tokenCostXec);
    const nextTokenCostXec = Math.max(
      0,
      normalizedBudgetXec - normalizedNetworkFeeXec - swapFeeXec,
    );

    if (Math.abs(nextTokenCostXec - tokenCostXec) < 0.000001) {
      return nextTokenCostXec;
    }

    tokenCostXec = nextTokenCostXec;
  }

  return tokenCostXec;
};

export const getMinimumAgoraBuyFeesXec = (networkFeeXec: number): number => {
  return normalizeXec(networkFeeXec) + AGORA_SWAP_FEE_MIN_XEC;
};

export const getAgoraSwapFeeOutput = () => ({
  address: AGORA_SWAP_FEE_ADDRESS,
  feeBps: AGORA_SWAP_FEE_BPS,
  minSats: AGORA_SWAP_FEE_MIN_SATS,
});
