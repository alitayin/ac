import { AGORA_SWAP_FEE_ADDRESS, satsToXec } from "@/lib/agora-swap-fee";

export const STAR_SHARD_TOKEN_ID =
  "d1131675cb62b65909fb45ba53b022da0bd0f34aaa71fc61770115472b186ffb";
export const STAR_CRYSTAL_TOKEN_ID =
  "ac31bb0bccf33de1683efce4da64f1cb6d8e8d6e098bc01c51d5864deb0e783f";

export const SERVICE_TOKEN_REDEMPTION_ADDRESS = AGORA_SWAP_FEE_ADDRESS;

export type ServiceCreditTokenSymbol = "SS" | "SC";

export interface ServiceCreditTokenConfig {
  symbol: ServiceCreditTokenSymbol;
  name: string;
  tokenId: string;
  creditSats: bigint;
  icon: string;
}

export interface ServiceCreditRedemption {
  symbol: ServiceCreditTokenSymbol;
  tokenId: string;
  amountAtoms: string;
  creditSats: string;
}

export interface ServiceCreditQuote {
  canCover: boolean;
  requiredSats: string;
  creditSats: string;
  overpaySats: string;
  redemptions: ServiceCreditRedemption[];
}

export const SERVICE_CREDIT_TOKENS: ServiceCreditTokenConfig[] = [
  {
    symbol: "SS",
    name: "Star Shard",
    tokenId: STAR_SHARD_TOKEN_ID,
    creditSats: 500n,
    icon: "/SS.png",
  },
  {
    symbol: "SC",
    name: "Star Crystal",
    tokenId: STAR_CRYSTAL_TOKEN_ID,
    creditSats: 30_000n,
    icon: "/SC.png",
  },
];

const normalizeSatsString = (value: string | number | bigint): bigint => {
  try {
    const sats = typeof value === "bigint" ? value : BigInt(value);
    return sats > 0n ? sats : 0n;
  } catch (_error) {
    return 0n;
  }
};

export const xecToCreditSats = (value: number): bigint => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0n;
  }

  return BigInt(Math.ceil(value * 100));
};

export const creditSatsToXec = (value: string | number | bigint): number =>
  satsToXec(normalizeSatsString(value));

export const formatServiceCreditXec = (
  value: string | number | bigint,
): string => creditSatsToXec(value).toFixed(2);

export const getServiceCreditQuote = (
  requiredSatsInput: string | number | bigint,
  userTokens: Record<string, string>,
): ServiceCreditQuote => {
  const requiredSats = normalizeSatsString(requiredSatsInput);

  if (requiredSats === 0n) {
    return {
      canCover: false,
      requiredSats: "0",
      creditSats: "0",
      overpaySats: "0",
      redemptions: [],
    };
  }

  const balances = SERVICE_CREDIT_TOKENS.map((token) => ({
    ...token,
    balanceAtoms: normalizeSatsString(userTokens[token.tokenId] || "0"),
  })).filter((token) => token.balanceAtoms > 0n);

  let best: ServiceCreditQuote | null = null;

  const ssToken = balances.find((token) => token.symbol === "SS");
  const scToken = balances.find((token) => token.symbol === "SC");
  const maxScNeeded = scToken
    ? (requiredSats + scToken.creditSats - 1n) / scToken.creditSats + 1n
    : 0n;
  const maxScCount = scToken
    ? scToken.balanceAtoms < maxScNeeded
      ? scToken.balanceAtoms
      : maxScNeeded
    : 0n;

  const consider = (ssCount: bigint, scCount: bigint) => {
    const creditSats =
      ssCount * (ssToken?.creditSats || 0n) +
      scCount * (scToken?.creditSats || 0n);
    if (creditSats < requiredSats) {
      return;
    }

    const redemptions: ServiceCreditRedemption[] = [];
    if (ssToken && ssCount > 0n) {
      redemptions.push({
        symbol: ssToken.symbol,
        tokenId: ssToken.tokenId,
        amountAtoms: ssCount.toString(),
        creditSats: (ssCount * ssToken.creditSats).toString(),
      });
    }
    if (scToken && scCount > 0n) {
      redemptions.push({
        symbol: scToken.symbol,
        tokenId: scToken.tokenId,
        amountAtoms: scCount.toString(),
        creditSats: (scCount * scToken.creditSats).toString(),
      });
    }

    const overpaySats = creditSats - requiredSats;
    const candidate: ServiceCreditQuote = {
      canCover: true,
      requiredSats: requiredSats.toString(),
      creditSats: creditSats.toString(),
      overpaySats: overpaySats.toString(),
      redemptions,
    };

    if (
      !best ||
      overpaySats < BigInt(best.overpaySats) ||
      (overpaySats === BigInt(best.overpaySats) &&
        redemptions.reduce((sum, item) => sum + BigInt(item.amountAtoms), 0n) <
          best.redemptions.reduce(
            (sum, item) => sum + BigInt(item.amountAtoms),
            0n,
          ))
    ) {
      best = candidate;
    }
  };

  for (let scCount = 0n; scCount <= maxScCount; scCount += 1n) {
    const scCreditSats = scCount * (scToken?.creditSats || 0n);
    const remainingSats = requiredSats > scCreditSats ? requiredSats - scCreditSats : 0n;
    const ssNeeded =
      ssToken && remainingSats > 0n
        ? (remainingSats + ssToken.creditSats - 1n) / ssToken.creditSats
        : 0n;

    if (ssNeeded <= (ssToken?.balanceAtoms || 0n)) {
      consider(ssNeeded, scCount);
    }
  }

  return (
    best || {
      canCover: false,
      requiredSats: requiredSats.toString(),
      creditSats: "0",
      overpaySats: "0",
      redemptions: [],
    }
  );
};
