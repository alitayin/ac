import type { PromoteFeeConfig, PromoteMode } from "@/lib/promote/types";

type SendRecipient = {
  address: string;
  amount: bigint;
};

export const PROMOTE_FEE_CONFIG: PromoteFeeConfig = {
  enabled: true,
  address: "ecash:qpaw7v7sfvlsm4px33saggr63jgsalsx4q49m7n6v4",
  tokenAirdropSats: 10_000n,
  messageBroadcastSats: 10_000n,
  tokenAirdropLabel: "100 XEC per token send",
  messageBroadcastLabel: "100 XEC per message send",
};

export const calculatePromoteFeeSats = (
  mode: PromoteMode,
  config: PromoteFeeConfig = PROMOTE_FEE_CONFIG,
): bigint => {
  if (!config.enabled) {
    return 0n;
  }

  return mode === "token-airdrop"
    ? config.tokenAirdropSats
    : config.messageBroadcastSats;
};

export const getPromoteFeeLabel = (
  mode: PromoteMode,
  config: PromoteFeeConfig = PROMOTE_FEE_CONFIG,
): string => {
  return mode === "token-airdrop"
    ? config.tokenAirdropLabel
    : config.messageBroadcastLabel;
};

export const getPromoteFeeRecipients = (
  mode: PromoteMode,
  config: PromoteFeeConfig = PROMOTE_FEE_CONFIG,
): SendRecipient[] => {
  const feeSats = calculatePromoteFeeSats(mode, config);

  if (feeSats === 0n) {
    return [];
  }

  return [
    {
      address: config.address,
      amount: feeSats,
    },
  ];
};
