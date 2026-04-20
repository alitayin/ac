import {
  ALP_STANDARD,
  Address,
  DEFAULT_DUST_SATS,
  DEFAULT_FEE_SATS_PER_KB,
  MAX_TX_SERSIZE,
  OP_RESERVED,
  OP_RETURN,
  SLP_FUNGIBLE,
  Script,
  alpSend,
  calcTxFee,
  pushBytesOp,
  slpSend,
} from "ecash-lib";
import {
  CASHTAB_PREFIX_HEX,
  validateAppMessage,
  validateAppPrefixHex,
} from "ecash-quicksend";

import { getTokenAmountFromToken } from "@/lib/chronik";
import type {
  AudienceSourceMode,
  BatchPlan,
  DistributionRecipient,
  HolderRow,
  ManualAddressParseResult,
  RecipientRecord,
  TokenDistributionMode,
  TokenProtocol,
  XecBatchEstimate,
} from "@/lib/promote/types";

const P2PKH_INPUT_BYTES = 148;
const P2PKH_OUTPUT_BYTES = 34;
const TX_OVERHEAD_BYTES = 10;

export const SATS_PER_XEC = 100n;
export const DUST_SATS = DEFAULT_DUST_SATS;
export const SLP_MAX_BATCH_SIZE = 19;
export const ALP_MAX_BATCH_SIZE = 29;

const formatBigIntWithCommas = (value: bigint): string => {
  const sign = value < 0n ? "-" : "";
  const digits = (value < 0n ? -value : value).toString();
  return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
};

const getVarIntSize = (value: number): number => {
  if (value < 0xfd) {
    return 1;
  }
  if (value <= 0xffff) {
    return 3;
  }
  if (value <= 0xffffffff) {
    return 5;
  }
  return 9;
};

const sumBigInts = (values: bigint[]): bigint =>
  values.reduce((total, value) => total + value, 0n);

export const getUtf8ByteLength = (value: string): number =>
  new TextEncoder().encode(value).length;

export const formatAtoms = (value: bigint, decimals: number): string => {
  const divisor = decimals > 0 ? BigInt(`1${"0".repeat(decimals)}`) : 1n;
  const integer = value / divisor;
  const fraction = value % divisor;

  if (fraction === 0n) {
    return formatBigIntWithCommas(integer);
  }

  const fractionText = fraction
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");

  return `${formatBigIntWithCommas(integer)}.${fractionText}`;
};

export const formatSatsAsXec = (value: bigint): string => {
  const integer = value / SATS_PER_XEC;
  const fraction = value % SATS_PER_XEC;

  if (fraction === 0n) {
    return formatBigIntWithCommas(integer);
  }

  return `${formatBigIntWithCommas(integer)}.${fraction
    .toString()
    .padStart(2, "0")
    .replace(/0+$/, "")}`;
};

export const parseDecimalToAtoms = (
  value: string,
  decimals: number,
): bigint | null => {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }

  const [integerPart, fractionPart = ""] = trimmed.split(".");

  if (fractionPart.length > decimals) {
    return null;
  }

  const normalizedFraction = `${fractionPart}${"0".repeat(decimals)}`.slice(
    0,
    decimals,
  );

  try {
    return BigInt(`${integerPart}${normalizedFraction}`);
  } catch {
    return null;
  }
};

export const normalizeAddress = (value: string): string =>
  Address.parse(value.trim()).cash().withPrefix("ecash").toString();

export const parseManualAddresses = (value: string): ManualAddressParseResult => {
  const parts = value
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  const addresses: string[] = [];
  const invalidEntries: string[] = [];
  const seen = new Set<string>();
  const invalidSeen = new Set<string>();
  let duplicateCount = 0;

  for (const part of parts) {
    try {
      const normalized = normalizeAddress(part);

      if (seen.has(normalized)) {
        duplicateCount += 1;
        continue;
      }

      seen.add(normalized);
      addresses.push(normalized);
    } catch {
      if (!invalidSeen.has(part)) {
        invalidSeen.add(part);
        invalidEntries.push(part);
      }
    }
  }

  return {
    addresses,
    invalidEntries,
    duplicateCount,
  };
};

export const getAudienceSourceMode = (
  includeHolders: boolean,
  includeManual: boolean,
): AudienceSourceMode => {
  if (includeHolders && includeManual) {
    return "combined";
  }

  if (includeHolders) {
    return "holders-only";
  }

  if (includeManual) {
    return "manual-only";
  }

  return "none";
};

export const aggregateHolderRows = (utxos: Array<{ script: string; token?: unknown }>): HolderRow[] => {
  const totals = new Map<string, bigint>();

  for (const utxo of utxos) {
    if (!utxo.token || typeof utxo.script !== "string") {
      continue;
    }

    const amount = getTokenAmountFromToken(utxo.token);
    if (amount <= 0n) {
      continue;
    }

    let address: string;
    try {
      address = Address.fromScriptHex(utxo.script).withPrefix("ecash").toString();
    } catch {
      continue;
    }

    totals.set(address, (totals.get(address) ?? 0n) + amount);
  }

  return Array.from(totals.entries())
    .map(([address, atoms]) => ({ address, atoms }))
    .sort((left, right) => {
      if (left.atoms === right.atoms) {
        return left.address.localeCompare(right.address);
      }

      return left.atoms < right.atoms ? 1 : -1;
    });
};

export const mergeRecipients = (
  holderRows: HolderRow[],
  manualAddresses: string[],
): RecipientRecord[] => {
  const merged = new Map<string, RecipientRecord>();

  for (const row of holderRows) {
    merged.set(row.address, {
      address: row.address,
      sources: ["holders"],
      holdingAtoms: row.atoms,
    });
  }

  for (const address of manualAddresses) {
    const existing = merged.get(address);

    if (existing) {
      if (!existing.sources.includes("manual")) {
        existing.sources = [...existing.sources, "manual"];
      }
      continue;
    }

    merged.set(address, {
      address,
      sources: ["manual"],
      holdingAtoms: 0n,
    });
  }

  return Array.from(merged.values());
};

export const sumHoldingAtoms = (recipients: RecipientRecord[]): bigint =>
  recipients.reduce((total, recipient) => total + recipient.holdingAtoms, 0n);

export const buildTokenDistributionPlan = (
  recipients: RecipientRecord[],
  distributionMode: TokenDistributionMode,
  totalAtoms: bigint,
  fixedAtoms: bigint,
): DistributionRecipient[] => {
  if (distributionMode === "fixed") {
    if (fixedAtoms <= 0n) {
      return [];
    }

    return recipients.map((recipient) => ({
      ...recipient,
      amountAtoms: fixedAtoms,
    }));
  }

  if (totalAtoms <= 0n) {
    return [];
  }

  const holders = recipients.filter((recipient) => recipient.holdingAtoms > 0n);
  const totalHolding = sumHoldingAtoms(holders);

  if (holders.length === 0 || totalHolding === 0n) {
    return [];
  }

  const basePlan = holders.map((recipient, index) => {
    const scaled = totalAtoms * recipient.holdingAtoms;
    return {
      recipient,
      index,
      amountAtoms: scaled / totalHolding,
      remainder: scaled % totalHolding,
    };
  });

  let assignedAtoms = basePlan.reduce(
    (total, item) => total + item.amountAtoms,
    0n,
  );
  let remainingAtoms = totalAtoms - assignedAtoms;

  if (remainingAtoms > 0n) {
    const rankedRemainders = [...basePlan].sort((left, right) => {
      if (left.remainder === right.remainder) {
        return left.index - right.index;
      }

      return left.remainder < right.remainder ? 1 : -1;
    });

    let remainderIndex = 0;
    while (remainingAtoms > 0n && rankedRemainders.length > 0) {
      rankedRemainders[remainderIndex].amountAtoms += 1n;
      remainingAtoms -= 1n;
      remainderIndex = (remainderIndex + 1) % rankedRemainders.length;
    }

    assignedAtoms = basePlan.reduce((total, item) => total + item.amountAtoms, 0n);
    if (assignedAtoms < totalAtoms) {
      basePlan[0].amountAtoms += totalAtoms - assignedAtoms;
    }
  }

  return basePlan
    .filter((item) => item.amountAtoms > 0n)
    .map((item) => ({
      ...item.recipient,
      amountAtoms: item.amountAtoms,
    }));
};

export const splitIntoBatches = <T,>(
  values: T[],
  batchSize: number,
): BatchPlan<T>[] => {
  if (batchSize <= 0) {
    return [];
  }

  const batches: BatchPlan<T>[] = [];

  for (let index = 0; index < values.length; index += batchSize) {
    batches.push({
      index: batches.length,
      recipients: values.slice(index, index + batchSize),
    });
  }

  return batches;
};

export const getMaxTokenBatchSize = (protocol: TokenProtocol): number => {
  if (protocol === "ALP") {
    return ALP_MAX_BATCH_SIZE;
  }

  return SLP_MAX_BATCH_SIZE;
};

export const getXecAppOutputBytes = (
  message: string,
  appPrefixHex: string = CASHTAB_PREFIX_HEX,
): number => {
  validateAppPrefixHex(appPrefixHex);
  const messageBytes = validateAppMessage(message);
  const scriptLength = 1 + 1 + 4 + 1 + messageBytes.length;
  return 8 + getVarIntSize(scriptLength) + scriptLength;
};

export const estimateFanoutBatch = (
  availableUtxoValues: bigint[],
  recipientCount: number,
  options?: {
    dustPerRecipient?: bigint;
    message?: string;
    appPrefixHex?: string;
    additionalOutputBytes?: number;
    additionalOutputSats?: bigint;
    extraFixedInputs?: number;
  },
): XecBatchEstimate => {
  const utxos = [...availableUtxoValues]
    .filter((value) => value > 0n)
    .sort((left, right) => (left < right ? 1 : -1));

  if (recipientCount <= 0 || utxos.length === 0) {
    return {
      inputCount: 0,
      feeSats: 0n,
      requiredSats: 0n,
      txSizeBytes: 0,
      feasible: false,
      reason: "insufficient_balance",
    };
  }

  const dustPerRecipient = options?.dustPerRecipient ?? DUST_SATS;
  const additionalOutputBytes = options?.additionalOutputBytes ?? 0;
  const additionalOutputSats = options?.additionalOutputSats ?? 0n;
  const extraFixedInputs = options?.extraFixedInputs ?? 0;
  const messageOutputBytes =
    options?.message && recipientCount > 0
      ? getXecAppOutputBytes(
          options.message,
          options.appPrefixHex ?? CASHTAB_PREFIX_HEX,
        )
      : 0;

  let selectedTotal = 0n;
  let lastSizeBytes = 0;

  for (let index = 0; index < utxos.length; index += 1) {
    selectedTotal += utxos[index];

    const inputCount = index + 1 + extraFixedInputs;
    const txSizeBytes =
      TX_OVERHEAD_BYTES +
      inputCount * P2PKH_INPUT_BYTES +
      recipientCount * P2PKH_OUTPUT_BYTES +
      P2PKH_OUTPUT_BYTES +
      messageOutputBytes +
      additionalOutputBytes;

    lastSizeBytes = txSizeBytes;

    if (txSizeBytes > MAX_TX_SERSIZE) {
      return {
        inputCount,
        feeSats: calcTxFee(txSizeBytes, DEFAULT_FEE_SATS_PER_KB),
        requiredSats: 0n,
        txSizeBytes,
        feasible: false,
        reason: "tx_too_large",
      };
    }

    const feeSats = calcTxFee(txSizeBytes, DEFAULT_FEE_SATS_PER_KB);
    const requiredSats =
      BigInt(recipientCount) * dustPerRecipient + feeSats + additionalOutputSats;

    if (selectedTotal >= requiredSats) {
      return {
        inputCount,
        feeSats,
        requiredSats,
        txSizeBytes,
        feasible: true,
      };
    }
  }

  return {
    inputCount: utxos.length + extraFixedInputs,
    feeSats: calcTxFee(lastSizeBytes || TX_OVERHEAD_BYTES, DEFAULT_FEE_SATS_PER_KB),
    requiredSats: 0n,
    txSizeBytes: lastSizeBytes,
    feasible: false,
    reason: "insufficient_balance",
  };
};

export const findMaxMessageRecipientsPerBatch = (
  availableUtxoValues: bigint[],
  totalRecipients: number,
  message: string,
  appPrefixHex: string = CASHTAB_PREFIX_HEX,
): number => {
  if (totalRecipients <= 0) {
    return 0;
  }

  let low = 1;
  let high = totalRecipients;
  let best = 0;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const estimate = estimateFanoutBatch(availableUtxoValues, middle, {
      message,
      appPrefixHex,
    });

    if (estimate.feasible) {
      best = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return best;
};

export const buildMessageBatchPlan = (
  recipients: RecipientRecord[],
  availableUtxoValues: bigint[],
  message: string,
  appPrefixHex: string = CASHTAB_PREFIX_HEX,
): {
  batches: BatchPlan<RecipientRecord>[];
  estimates: XecBatchEstimate[];
  blockedReason: string | null;
} => {
  if (recipients.length === 0 || !message.trim()) {
    return {
      batches: [],
      estimates: [],
      blockedReason: null,
    };
  }

  const batchSize = findMaxMessageRecipientsPerBatch(
    availableUtxoValues,
    recipients.length,
    message,
    appPrefixHex,
  );

  if (batchSize === 0) {
    const singleRecipientEstimate = estimateFanoutBatch(availableUtxoValues, 1, {
      message,
      appPrefixHex,
    });

    return {
      batches: [],
      estimates: [],
      blockedReason:
        singleRecipientEstimate.reason === "tx_too_large"
          ? "Message transaction exceeds the standard size limit."
          : "Wallet balance or spendable XEC UTXOs are not sufficient.",
    };
  }

  const batches = splitIntoBatches(recipients, batchSize);
  const estimates = batches.map((batch) =>
    estimateFanoutBatch(availableUtxoValues, batch.recipients.length, {
      message,
      appPrefixHex,
    }),
  );

  return {
    batches,
    estimates,
    blockedReason: null,
  };
};

export const estimateTokenBatch = (
  availableXecUtxoValues: bigint[],
  tokenInputCount: number,
  tokenId: string,
  protocol: Exclude<TokenProtocol, "UNKNOWN">,
  sendAmounts: bigint[],
  includeTokenChange: boolean,
): XecBatchEstimate => {
  const finalSendAmounts = includeTokenChange ? [...sendAmounts, 1n] : sendAmounts;

  const opReturnScript =
    protocol === "ALP"
      ? Script.fromOps([
          OP_RETURN,
          OP_RESERVED,
          pushBytesOp(alpSend(tokenId, ALP_STANDARD, finalSendAmounts)),
        ])
      : slpSend(tokenId, SLP_FUNGIBLE, finalSendAmounts);

  const opReturnBytes =
    8 + getVarIntSize(opReturnScript.bytecode.length) + opReturnScript.bytecode.length;
  const recipientCount = sendAmounts.length;
  const additionalOutputBytes = opReturnBytes + (includeTokenChange ? P2PKH_OUTPUT_BYTES : 0);
  const additionalOutputSats = includeTokenChange ? DUST_SATS : 0n;

  return estimateFanoutBatch(availableXecUtxoValues, recipientCount, {
    dustPerRecipient: DUST_SATS,
    additionalOutputBytes,
    additionalOutputSats,
    extraFixedInputs: Math.max(tokenInputCount, 1),
  });
};

export const validateMessageInput = (message: string): string | null => {
  if (!message.trim()) {
    return "Message is required.";
  }

  try {
    validateAppMessage(message);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid message.";
  }
};
