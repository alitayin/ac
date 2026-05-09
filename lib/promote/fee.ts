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
  creatorTokenSats: 1_000n,
  tokenAirdropLabel: "100 XEC per token recipient",
  messageBroadcastLabel: "100 XEC per message recipient",
  creatorTokenLabel: "10 XEC per recipient for your own token",
};

export type PromoteFeeOptions = {
  isCreatorToken?: boolean;
};

export const calculatePromoteFeeSats = (
  mode: PromoteMode,
  recipientCount: number,
  config: PromoteFeeConfig = PROMOTE_FEE_CONFIG,
  options: PromoteFeeOptions = {},
): bigint => {
  if (!config.enabled) {
    return 0n;
  }

  if (recipientCount <= 0) {
    return 0n;
  }

  const feePerRecipient =
    options.isCreatorToken
      ? config.creatorTokenSats
      : mode === "token-airdrop"
      ? config.tokenAirdropSats
      : config.messageBroadcastSats;

  return feePerRecipient * BigInt(recipientCount);
};

export const getPromoteFeeLabel = (
  mode: PromoteMode,
  config: PromoteFeeConfig = PROMOTE_FEE_CONFIG,
  options: PromoteFeeOptions = {},
): string => {
  if (options.isCreatorToken) {
    return config.creatorTokenLabel;
  }

  return mode === "token-airdrop"
    ? config.tokenAirdropLabel
    : config.messageBroadcastLabel;
};

export const getPromoteFeeRecipients = (
  mode: PromoteMode,
  recipientCount: number,
  config: PromoteFeeConfig = PROMOTE_FEE_CONFIG,
  options: PromoteFeeOptions = {},
): SendRecipient[] => {
  const feeSats = calculatePromoteFeeSats(mode, recipientCount, config, options);

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
