export type PromoteMode = "token-airdrop" | "platform-message";

export type AudienceSourceMode =
  | "none"
  | "holders-only"
  | "manual-only"
  | "combined";

export type TokenDistributionMode = "proportional" | "fixed";

export type RecipientSource = "holders" | "manual";

export type TokenProtocol = "SLP" | "ALP" | "UNKNOWN";

export interface HolderRow {
  address: string;
  atoms: bigint;
}

export interface RecipientRecord {
  address: string;
  sources: RecipientSource[];
  holdingAtoms: bigint;
}

export interface DistributionRecipient extends RecipientRecord {
  amountAtoms: bigint;
}

export interface ManualAddressParseResult {
  addresses: string[];
  invalidEntries: string[];
  duplicateCount: number;
}

export interface XecBatchEstimate {
  inputCount: number;
  feeSats: bigint;
  requiredSats: bigint;
  txSizeBytes: number;
  feasible: boolean;
  reason?: "insufficient_balance" | "tx_too_large";
}

export interface BatchPlan<T> {
  index: number;
  recipients: T[];
}

export interface PromoteFeeConfig {
  enabled: boolean;
  address: string;
  tokenAirdropSats: bigint;
  messageBroadcastSats: bigint;
  tokenAirdropLabel: string;
  messageBroadcastLabel: string;
}
