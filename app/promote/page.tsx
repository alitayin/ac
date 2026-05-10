"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import quick, {
  CASHTAB_PREFIX_HEX,
  XEC_APP_MESSAGE_BYTE_LIMIT,
} from "ecash-quicksend";
import {
  AlertCircle,
  CheckCircle2,
  Coins,
  History,
  Loader2,
  Megaphone,
  RotateCcw,
  Search,
  Send,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";

import Header from "@/components/ui/header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  fetchTokenDetails,
  getCachedTokenDetails,
  getTokenDecimalsFromDetails,
} from "@/lib/chronik";
import { useChronik } from "@/lib/context/ChronikContext";
import { useWallet } from "@/lib/context/WalletContext";
import {
  PROMOTE_FEE_CONFIG,
  calculatePromoteFeeSats,
  getPromoteFeeLabel,
  getPromoteFeeRecipients,
} from "@/lib/promote/fee";
import type {
  BatchPlan,
  DistributionRecipient,
  HolderRow,
  PromoteMode,
  RecipientRecord,
  RecipientSource,
  TokenDistributionMode,
  TokenProtocol,
  XecBatchEstimate,
} from "@/lib/promote/types";
import {
  buildMessageBatchPlan,
  buildTokenDistributionPlan,
  formatAtoms,
  formatSatsAsXec,
  getMaxTokenBatchSize,
  getUtf8ByteLength,
  mergeRecipients,
  partitionP2pkhRecipients,
  parseDecimalToAtoms,
  parseManualAddresses,
  splitIntoBatches,
  sumHoldingAtoms,
  validateMessageInput,
  aggregateHolderRows,
  estimateTokenBatch,
} from "@/lib/promote/utils";
import { tokens as TOKEN_CONFIGS } from "@/config/tokens";
import { cn } from "@/lib/utils";

const TOKEN_ID_PATTERN = /^[0-9a-f]{64}$/;
const PROMOTE_HISTORY_STORAGE_KEY = "promote_send_history_v1";
const PROMOTE_HISTORY_MAX_ENTRIES = 20;

type TokenMeta = {
  label: string;
  decimals: number;
  protocol: TokenProtocol;
  authPubkey: string | null;
};

type ConfiguredToken = {
  tokenId: string;
  name: string;
  symbol: string;
  decimals: number;
};

type SendRecipient = {
  address: string;
  amount: bigint;
};

type PromoteHistoryEntry = {
  id: string;
  createdAt: string;
  mode: PromoteMode;
  recipientMode: RecipientSource;
  recipientCount: number;
  batchCount: number;
  tokenId?: string;
  tokenLabel?: string;
  tokenAmount?: string;
  messageBytes?: number;
  messagePreview?: string;
  txids: string[];
  feeTxId?: string;
};

const getFallbackTokenLabel = (tokenId: string): string =>
  tokenId.length <= 12 ? tokenId : `${tokenId.slice(0, 6)}...${tokenId.slice(-4)}`;

const getHistoryAudienceLabel = (recipientMode: RecipientSource): string =>
  recipientMode === "holders" ? "Token holders" : "Manual";

const trimHistoryMessage = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length <= 120) {
    return trimmed;
  }

  return `${trimmed.slice(0, 117)}...`;
};

const readPromoteHistory = (): PromoteHistoryEntry[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = localStorage.getItem(PROMOTE_HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is PromoteHistoryEntry => {
      if (!entry || typeof entry !== "object") {
        return false;
      }

      return (
        typeof entry.id === "string" &&
        typeof entry.createdAt === "string" &&
        (entry.mode === "token-airdrop" || entry.mode === "platform-message") &&
        (entry.recipientMode === "holders" || entry.recipientMode === "manual") &&
        typeof entry.recipientCount === "number" &&
        typeof entry.batchCount === "number" &&
        Array.isArray(entry.txids)
      );
    });
  } catch {
    return [];
  }
};

const writePromoteHistory = (entries: PromoteHistoryEntry[]) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(PROMOTE_HISTORY_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    return;
  }
};

const getTokenDisplayLabel = (
  tokenId: string,
  tokenDetails: unknown,
  configuredToken?: { name?: string } | null,
): string => {
  const chainTokenName =
    tokenDetails &&
    typeof tokenDetails === "object" &&
    "genesisInfo" in tokenDetails &&
    tokenDetails.genesisInfo &&
    typeof tokenDetails.genesisInfo === "object" &&
    "tokenName" in tokenDetails.genesisInfo
      ? tokenDetails.genesisInfo.tokenName
      : null;

  if (typeof chainTokenName === "string" && chainTokenName.trim().length > 0) {
    return chainTokenName.trim();
  }

  if (
    configuredToken &&
    typeof configuredToken.name === "string" &&
    configuredToken.name.trim().length > 0
  ) {
    return configuredToken.name.trim();
  }

  return getFallbackTokenLabel(tokenId);
};

const normalizeHex = (value?: string | null): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const getTokenAuthPubkey = (tokenDetails: unknown): string | null => {
  const authPubkey =
    tokenDetails &&
    typeof tokenDetails === "object" &&
    "genesisInfo" in tokenDetails &&
    tokenDetails.genesisInfo &&
    typeof tokenDetails.genesisInfo === "object" &&
    "authPubkey" in tokenDetails.genesisInfo
      ? tokenDetails.genesisInfo.authPubkey
      : null;

  return typeof authPubkey === "string" && authPubkey.trim().length > 0
    ? normalizeHex(authPubkey)
    : null;
};

export default function PromotePage() {
  const { chronik: chronikClient, isLoading: isChronikLoading } = useChronik();
  const {
    isWalletConnected,
    ecashAddress,
    balance,
    userTokens,
    mnemonic,
    isGuestMode,
    publicKeyHex,
    refreshBalance,
  } = useWallet();
  const { toast } = useToast();

  const configuredTokens = useMemo<ConfiguredToken[]>(
    () =>
      Object.values(TOKEN_CONFIGS).map((token) => ({
        tokenId: token.tokenId,
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals ?? 0,
      })),
    [],
  );
  const configuredTokenMap = useMemo(
    () =>
      new Map(
        configuredTokens.map((token) => [
          token.tokenId,
          token,
        ]),
      ),
    [configuredTokens],
  );

  const [mode, setMode] = useState<PromoteMode>("token-airdrop");
  const [recipientMode, setRecipientMode] = useState<RecipientSource>("holders");

  const [targetTokenInput, setTargetTokenInput] = useState("");
  const [loadedTargetTokenId, setLoadedTargetTokenId] = useState("");
  const [targetTokenMeta, setTargetTokenMeta] = useState<TokenMeta | null>(null);
  const [holderRows, setHolderRows] = useState<HolderRow[]>([]);
  const [isLoadingHolders, setIsLoadingHolders] = useState(false);
  const [holderLoadError, setHolderLoadError] = useState("");

  const [manualAddressesInput, setManualAddressesInput] = useState("");

  const [airdropTokenId, setAirdropTokenId] = useState("");
  const [airdropTokenMeta, setAirdropTokenMeta] = useState<TokenMeta | null>(null);
  const [distributionMode, setDistributionMode] =
    useState<TokenDistributionMode>("proportional");
  const [totalInput, setTotalInput] = useState("");
  const [fixedInput, setFixedInput] = useState("");

  const [messageInput, setMessageInput] = useState("");

  const [walletXecUtxoValues, setWalletXecUtxoValues] = useState<bigint[]>([]);
  const [walletTokenUtxoCounts, setWalletTokenUtxoCounts] = useState<Record<string, number>>({});
  const [walletTokenDetails, setWalletTokenDetails] = useState<Record<string, any>>({});
  const [walletSpendDataError, setWalletSpendDataError] = useState("");

  const [isSending, setIsSending] = useState(false);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [sendError, setSendError] = useState("");
  const [sendTxIds, setSendTxIds] = useState<string[]>([]);
  const [feeTxId, setFeeTxId] = useState("");
  const [historyEntries, setHistoryEntries] = useState<PromoteHistoryEntry[]>([]);

  const manualParse = useMemo(
    () => parseManualAddresses(manualAddressesInput),
    [manualAddressesInput],
  );
  const isHolderAudience = recipientMode === "holders";
  const isManualAudience = recipientMode === "manual";

  useEffect(() => {
    setHistoryEntries(readPromoteHistory());
  }, []);

  const appendHistoryEntry = useCallback((entry: PromoteHistoryEntry) => {
    setHistoryEntries((current) => {
      const next = [entry, ...current].slice(0, PROMOTE_HISTORY_MAX_ENTRIES);
      writePromoteHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistoryEntries([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem(PROMOTE_HISTORY_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!isWalletConnected) {
      setWalletTokenDetails({});
      return;
    }

    const cachedDetails = Object.fromEntries(
      Object.keys(userTokens)
        .map((tokenId) => [tokenId, getCachedTokenDetails(tokenId)] as const)
        .filter((entry): entry is [string, any] => Boolean(entry[1])),
    );

    setWalletTokenDetails(cachedDetails);
  }, [isWalletConnected, userTokens]);

  useEffect(() => {
    if (!isWalletConnected || !chronikClient) {
      return;
    }

    let cancelled = false;
    const missingTokenIds = Object.keys(userTokens).filter(
      (tokenId) => !walletTokenDetails[tokenId],
    );

    if (missingTokenIds.length === 0) {
      return;
    }

    const loadWalletTokenDetails = async () => {
      for (const tokenId of missingTokenIds) {
        try {
          const tokenDetails = await fetchTokenDetails(tokenId, chronikClient);
          if (cancelled || !tokenDetails) {
            continue;
          }

          setWalletTokenDetails((current) => {
            if (current[tokenId]) {
              return current;
            }

            return {
              ...current,
              [tokenId]: tokenDetails,
            };
          });
        } catch {
          continue;
        }
      }
    };

    void loadWalletTokenDetails();

    return () => {
      cancelled = true;
    };
  }, [chronikClient, isWalletConnected, userTokens, walletTokenDetails]);

  const loadTargetHolders = useCallback(
    async (rawTokenId: string) => {
      const normalized = rawTokenId.trim().toLowerCase();

      setTargetTokenInput(normalized);
      setSendError("");

      if (!TOKEN_ID_PATTERN.test(normalized)) {
        setLoadedTargetTokenId("");
        setTargetTokenMeta(null);
        setHolderRows([]);
        setHolderLoadError("Token ID must be a 64-character hex string.");
        return;
      }

      if (!chronikClient) {
        setHolderLoadError("Chronik is still connecting.");
        return;
      }

      setIsLoadingHolders(true);
      setHolderLoadError("");

      try {
        const [utxosResponse, tokenDetails] = await Promise.all([
          chronikClient.tokenId(normalized).utxos(),
          fetchTokenDetails(normalized, chronikClient).catch(() => null),
        ]);

        const nextRows = aggregateHolderRows(utxosResponse?.utxos ?? []);
        const tokenConfig = configuredTokenMap.get(normalized);
        const decimals = getTokenDecimalsFromDetails(
          tokenDetails,
          tokenConfig?.decimals ?? 0,
        );
        const label = getTokenDisplayLabel(normalized, tokenDetails, tokenConfig);

        setLoadedTargetTokenId(normalized);
        setTargetTokenMeta({
          label,
          decimals,
          authPubkey: getTokenAuthPubkey(tokenDetails),
          protocol:
            tokenDetails?.tokenType?.protocol === "SLP"
              ? "SLP"
              : tokenDetails?.tokenType?.protocol === "ALP"
                ? "ALP"
                : "UNKNOWN",
        });
        setHolderRows(nextRows);
      } catch (error) {
        setLoadedTargetTokenId("");
        setTargetTokenMeta(null);
        setHolderRows([]);
        setHolderLoadError(
          error instanceof Error ? error.message : "Failed to load token holders.",
        );
      } finally {
        setIsLoadingHolders(false);
      }
    },
    [chronikClient, configuredTokenMap],
  );

  useEffect(() => {
    if (!airdropTokenId || !chronikClient) {
      setAirdropTokenMeta(null);
      return;
    }

    let cancelled = false;

    const loadTokenMeta = async () => {
      try {
        const details = await fetchTokenDetails(airdropTokenId, chronikClient);
        if (cancelled) {
          return;
        }

        const tokenConfig = configuredTokenMap.get(airdropTokenId);
        const decimals = getTokenDecimalsFromDetails(
          details,
          tokenConfig?.decimals ?? 0,
        );
        const label = getTokenDisplayLabel(airdropTokenId, details, tokenConfig);
        const protocol =
          details?.tokenType?.protocol === "SLP"
            ? "SLP"
            : details?.tokenType?.protocol === "ALP"
              ? "ALP"
              : "UNKNOWN";

        setAirdropTokenMeta({
          label,
          decimals,
          authPubkey: getTokenAuthPubkey(details),
          protocol,
        });
      } catch {
        if (!cancelled) {
          setAirdropTokenMeta({
            label: getTokenDisplayLabel(
              airdropTokenId,
              null,
              configuredTokenMap.get(airdropTokenId),
            ),
            decimals: configuredTokenMap.get(airdropTokenId)?.decimals ?? 0,
            authPubkey: null,
            protocol: "UNKNOWN",
          });
        }
      }
    };

    void loadTokenMeta();

    return () => {
      cancelled = true;
    };
  }, [airdropTokenId, chronikClient, configuredTokenMap]);

  useEffect(() => {
    if (!isWalletConnected || !ecashAddress || !chronikClient) {
      setWalletXecUtxoValues([]);
      setWalletTokenUtxoCounts({});
      setWalletSpendDataError("");
      return;
    }

    let cancelled = false;

    const loadWalletSpendData = async () => {
      try {
        const response = await chronikClient.address(ecashAddress).utxos();
        if (cancelled) {
          return;
        }

        const xecUtxoValues: bigint[] = [];
        const tokenCounts: Record<string, number> = {};

        for (const utxo of response?.utxos ?? []) {
          if (utxo.token?.tokenId) {
            tokenCounts[utxo.token.tokenId] = (tokenCounts[utxo.token.tokenId] ?? 0) + 1;
            continue;
          }

          const rawSatsValue =
            typeof utxo.sats !== "undefined"
              ? utxo.sats
              : typeof (utxo as { value?: bigint | number }).value !== "undefined"
                ? ((utxo as { value?: bigint | number }).value ?? 0)
                : 0;

          try {
            xecUtxoValues.push(
              typeof rawSatsValue === "bigint"
                ? rawSatsValue
                : BigInt(rawSatsValue),
            );
          } catch {
            continue;
          }
        }

        setWalletXecUtxoValues(xecUtxoValues);
        setWalletTokenUtxoCounts(tokenCounts);
        setWalletSpendDataError("");
      } catch (error) {
        if (!cancelled) {
          setWalletSpendDataError(
            error instanceof Error
              ? error.message
              : "Failed to inspect wallet UTXOs.",
          );
        }
      }
    };

    void loadWalletSpendData();

    return () => {
      cancelled = true;
    };
  }, [chronikClient, ecashAddress, isWalletConnected]);

  const activeHolderRows = useMemo(
    () => (isHolderAudience ? holderRows : []),
    [holderRows, isHolderAudience],
  );
  const activeManualAddresses = useMemo(
    () => (isManualAudience ? manualParse.addresses : []),
    [isManualAudience, manualParse.addresses],
  );

  const allRecipients = useMemo(
    () => mergeRecipients(activeHolderRows, activeManualAddresses),
    [activeHolderRows, activeManualAddresses],
  );
  const recipientSupport = useMemo(
    () => partitionP2pkhRecipients(allRecipients),
    [allRecipients],
  );
  const recipients = recipientSupport.supported;
  const unsupportedRecipients = recipientSupport.unsupported;
  const unsupportedRecipientPreview = useMemo(
    () => unsupportedRecipients.slice(0, 2),
    [unsupportedRecipients],
  );

  const totalHoldingAtoms = useMemo(() => sumHoldingAtoms(recipients), [recipients]);
  const selectedWalletTokenBalance = useMemo(() => {
    try {
      return BigInt(userTokens[airdropTokenId] ?? "0");
    } catch {
      return 0n;
    }
  }, [airdropTokenId, userTokens]);
  const xecBalanceSats = useMemo(() => parseDecimalToAtoms(balance, 2) ?? 0n, [balance]);

  const walletTokenOptions = useMemo(
    () =>
      Object.entries(userTokens)
        .map(([tokenId, atoms]) => {
          const tokenDetails = walletTokenDetails[tokenId];
          const tokenConfig = configuredTokenMap.get(tokenId);
          let balanceAtoms = 0n;
          try {
            balanceAtoms = BigInt(atoms);
          } catch {
            balanceAtoms = 0n;
          }

          return {
            tokenId,
            label: getTokenDisplayLabel(tokenId, tokenDetails, tokenConfig),
            balanceAtoms,
          };
        })
        .sort((left, right) => {
          if (left.balanceAtoms === right.balanceAtoms) {
            return left.label.localeCompare(right.label);
          }

          return left.balanceAtoms < right.balanceAtoms ? 1 : -1;
        }),
    [configuredTokenMap, userTokens, walletTokenDetails],
  );

  const targetQuickPicks = useMemo(() => {
    const entries = new Map<string, { tokenId: string; label: string }>();

    for (const option of walletTokenOptions) {
      entries.set(option.tokenId, {
        tokenId: option.tokenId,
        label: option.label,
      });
    }

    for (const token of configuredTokens) {
      if (!entries.has(token.tokenId)) {
        entries.set(token.tokenId, {
          tokenId: token.tokenId,
          label: getTokenDisplayLabel(token.tokenId, null, token),
        });
      }
    }

    return Array.from(entries.values()).slice(0, 8);
  }, [configuredTokens, walletTokenOptions]);

  const canUseProportional =
    recipientMode === "holders" &&
    loadedTargetTokenId.length > 0 &&
    recipients.length > 0;

  useEffect(() => {
    if (distributionMode === "proportional" && !canUseProportional) {
      setDistributionMode("fixed");
    }
  }, [canUseProportional, distributionMode]);

  const totalAtomsError = useMemo(() => {
    if (!totalInput.trim()) {
      return null;
    }

    return parseDecimalToAtoms(totalInput, airdropTokenMeta?.decimals ?? 0) === null
      ? `Enter a valid amount with up to ${airdropTokenMeta?.decimals ?? 0} decimals.`
      : null;
  }, [airdropTokenMeta?.decimals, totalInput]);

  const fixedAtomsError = useMemo(() => {
    if (!fixedInput.trim()) {
      return null;
    }

    return parseDecimalToAtoms(fixedInput, airdropTokenMeta?.decimals ?? 0) === null
      ? `Enter a valid amount with up to ${airdropTokenMeta?.decimals ?? 0} decimals.`
      : null;
  }, [airdropTokenMeta?.decimals, fixedInput]);

  const parsedTotalAtoms = useMemo(
    () => parseDecimalToAtoms(totalInput, airdropTokenMeta?.decimals ?? 0) ?? 0n,
    [airdropTokenMeta?.decimals, totalInput],
  );
  const parsedFixedAtoms = useMemo(
    () => parseDecimalToAtoms(fixedInput, airdropTokenMeta?.decimals ?? 0) ?? 0n,
    [airdropTokenMeta?.decimals, fixedInput],
  );

  const distributionPlan = useMemo(
    () =>
      buildTokenDistributionPlan(
        recipients,
        distributionMode,
        parsedTotalAtoms,
        parsedFixedAtoms,
      ),
    [distributionMode, parsedFixedAtoms, parsedTotalAtoms, recipients],
  );
  const totalAirdropAtoms = useMemo(
    () =>
      distributionPlan.reduce(
        (total, recipient) => total + recipient.amountAtoms,
        0n,
      ),
    [distributionPlan],
  );
  const tokenBatchSize = getMaxTokenBatchSize(airdropTokenMeta?.protocol ?? "UNKNOWN");
  const tokenBatches = useMemo(
    () => splitIntoBatches(distributionPlan, tokenBatchSize),
    [distributionPlan, tokenBatchSize],
  );
  const tokenBatchEstimates = useMemo(() => {
    if (!airdropTokenId) {
      return [] as XecBatchEstimate[];
    }

    const protocolForEstimate =
      airdropTokenMeta?.protocol === "ALP" ? "ALP" : "SLP";

    return tokenBatches.map((batch) =>
      estimateTokenBatch(
        walletXecUtxoValues,
        walletTokenUtxoCounts[airdropTokenId] ?? 1,
        airdropTokenId,
        protocolForEstimate,
        batch.recipients.map((recipient) => recipient.amountAtoms),
        selectedWalletTokenBalance > batch.recipients.reduce(
          (total, recipient) => total + recipient.amountAtoms,
          0n,
        ),
      ),
    );
  }, [
    airdropTokenId,
    airdropTokenMeta,
    tokenBatches,
    walletTokenUtxoCounts,
    walletXecUtxoValues,
    selectedWalletTokenBalance,
  ]);
  const tokenEstimatedRequiredSats = useMemo(
    () =>
      tokenBatchEstimates.reduce(
        (total, estimate) => total + (estimate.feasible ? estimate.requiredSats : 0n),
        0n,
      ),
    [tokenBatchEstimates],
  );

  const effectivePrefixHex = CASHTAB_PREFIX_HEX;
  const messageValidationError = useMemo(
    () => (messageInput.trim() ? validateMessageInput(messageInput) : null),
    [messageInput],
  );
  const messageByteLength = useMemo(
    () => getUtf8ByteLength(messageInput),
    [messageInput],
  );
  const messagePlan = useMemo(() => {
    if (
      recipients.length === 0 ||
      !messageInput.trim() ||
      messageValidationError
    ) {
      return {
        batches: [] as BatchPlan<RecipientRecord>[],
        estimates: [] as XecBatchEstimate[],
        blockedReason: null,
      };
    }

    return buildMessageBatchPlan(recipients, walletXecUtxoValues, messageInput, effectivePrefixHex);
  }, [
    effectivePrefixHex,
    messageInput,
    messageValidationError,
    recipients,
    walletXecUtxoValues,
  ]);
  const messageEstimatedRequiredSats = useMemo(
    () =>
      messagePlan.estimates.reduce(
        (total, estimate) => total + (estimate.feasible ? estimate.requiredSats : 0n),
        0n,
      ),
    [messagePlan.estimates],
  );
  const tokenPromoteFeeRecipientCount = distributionPlan.length;
  const messagePromoteFeeRecipientCount = recipients.length;
  const isCreatorTokenPromotion = useMemo(() => {
    const walletPubkey = normalizeHex(publicKeyHex);
    const targetAuthPubkey = normalizeHex(targetTokenMeta?.authPubkey);

    return Boolean(walletPubkey && targetAuthPubkey && walletPubkey === targetAuthPubkey);
  }, [publicKeyHex, targetTokenMeta?.authPubkey]);
  const promoteFeeOptions = useMemo(
    () => ({ isCreatorToken: isCreatorTokenPromotion }),
    [isCreatorTokenPromotion],
  );

  const tokenPromoteFeeSats = useMemo(
    () =>
      calculatePromoteFeeSats(
        "token-airdrop",
        tokenPromoteFeeRecipientCount,
        PROMOTE_FEE_CONFIG,
        promoteFeeOptions,
      ),
    [promoteFeeOptions, tokenPromoteFeeRecipientCount],
  );
  const messagePromoteFeeSats = useMemo(
    () =>
      calculatePromoteFeeSats(
        "platform-message",
        messagePromoteFeeRecipientCount,
        PROMOTE_FEE_CONFIG,
        promoteFeeOptions,
      ),
    [messagePromoteFeeRecipientCount, promoteFeeOptions],
  );
  const totalMessageSpendSats = messageEstimatedRequiredSats + messagePromoteFeeSats;
  const totalTokenSpendSats = tokenEstimatedRequiredSats + tokenPromoteFeeSats;

  const previewRecipients = useMemo(() => {
    if (mode === "token-airdrop") {
      return distributionPlan.slice(0, 8);
    }

    return recipients.slice(0, 8);
  }, [distributionPlan, mode, recipients]);

  const tokenSendDisabledReason = useMemo(() => {
    if (!isWalletConnected) {
      return "Connect a wallet to send.";
    }
    if (isGuestMode || !mnemonic) {
      return "Sending requires a mnemonic-backed wallet.";
    }
    if (isHolderAudience && !loadedTargetTokenId) {
      return "Load a target token to unlock holder recipients.";
    }
    if (isHolderAudience && holderLoadError) {
      return holderLoadError;
    }
    if (recipients.length === 0 && unsupportedRecipients.length > 0) {
      return "All selected recipients use unsupported P2SH scripts. Promote currently sends only to P2PKH addresses.";
    }
    if (recipients.length === 0) {
      return "Add at least one recipient.";
    }
    if (!airdropTokenId) {
      return "Choose the token you want to send.";
    }
    if (distributionMode === "proportional" && !canUseProportional) {
      return "Proportional mode only works with token holders only.";
    }
    if (distributionMode === "proportional" && totalAtomsError) {
      return totalAtomsError;
    }
    if (distributionMode === "fixed" && fixedAtomsError) {
      return fixedAtomsError;
    }
    if (distributionPlan.length === 0 || totalAirdropAtoms === 0n) {
      return distributionMode === "proportional"
        ? "Enter a valid total amount."
        : "Enter a valid fixed amount.";
    }
    if (selectedWalletTokenBalance < totalAirdropAtoms) {
      return "Insufficient token balance.";
    }
    if (tokenBatchEstimates.some((estimate) => !estimate.feasible)) {
      return "Wallet XEC UTXOs cannot safely cover the planned token batches.";
    }
    if (xecBalanceSats < totalTokenSpendSats) {
      return "Insufficient XEC balance for dust and network fee requirements.";
    }

    return null;
  }, [
    airdropTokenId,
    canUseProportional,
    distributionMode,
    distributionPlan.length,
    fixedAtomsError,
    holderLoadError,
    isHolderAudience,
    isGuestMode,
    isWalletConnected,
    loadedTargetTokenId,
    mnemonic,
    recipients.length,
    selectedWalletTokenBalance,
    tokenBatchEstimates,
    totalAirdropAtoms,
    totalAtomsError,
    totalTokenSpendSats,
    unsupportedRecipients.length,
    xecBalanceSats,
  ]);

  const messageSendDisabledReason = useMemo(() => {
    if (!isWalletConnected) {
      return "Connect a wallet to send.";
    }
    if (isGuestMode || !mnemonic) {
      return "Sending requires a mnemonic-backed wallet.";
    }
    if (isHolderAudience && !loadedTargetTokenId) {
      return "Load a target token to unlock holder recipients.";
    }
    if (isHolderAudience && holderLoadError) {
      return holderLoadError;
    }
    if (recipients.length === 0 && unsupportedRecipients.length > 0) {
      return "All selected recipients use unsupported P2SH scripts. Promote currently sends only to P2PKH addresses.";
    }
    if (recipients.length === 0) {
      return "Add at least one recipient.";
    }
    if (!messageInput.trim()) {
      return "Enter the on-chain message you want to broadcast.";
    }
    if (messageValidationError) {
      return messageValidationError;
    }
    if (messagePlan.blockedReason) {
      return messagePlan.blockedReason;
    }
    if (messagePlan.batches.length === 0) {
      return "No sendable message batches were generated.";
    }
    if (xecBalanceSats < totalMessageSpendSats) {
      return "Insufficient XEC balance for dust and network fee requirements.";
    }

    return null;
  }, [
    holderLoadError,
    isHolderAudience,
    isGuestMode,
    isWalletConnected,
    loadedTargetTokenId,
    messageInput,
    messagePlan.batches.length,
    messagePlan.blockedReason,
    messageValidationError,
    mnemonic,
    recipients.length,
    totalMessageSpendSats,
    unsupportedRecipients.length,
    xecBalanceSats,
  ]);

  const activeBatchCount =
    mode === "token-airdrop" ? tokenBatches.length : messagePlan.batches.length;
  const activeSendDisabledReason =
    mode === "token-airdrop"
      ? tokenSendDisabledReason
      : messageSendDisabledReason;

  const resetWorkspace = useCallback(() => {
    setMode("token-airdrop");
    setRecipientMode("holders");
    setTargetTokenInput("");
    setLoadedTargetTokenId("");
    setTargetTokenMeta(null);
    setHolderRows([]);
    setHolderLoadError("");
    setManualAddressesInput("");
    setAirdropTokenId("");
    setAirdropTokenMeta(null);
    setDistributionMode("proportional");
    setTotalInput("");
    setFixedInput("");
    setMessageInput("");
    setIsSending(false);
    setCurrentBatchIndex(0);
    setSendError("");
    setSendTxIds([]);
    setFeeTxId("");
  }, []);

  const resetExecutionState = useCallback(() => {
    setCurrentBatchIndex(0);
    setSendError("");
    setSendTxIds([]);
    setFeeTxId("");
  }, []);

  const sendPromoteFee = useCallback(
    async (mode: PromoteMode, recipientCount: number) => {
      const feeRecipients = getPromoteFeeRecipients(
        mode,
        recipientCount,
        PROMOTE_FEE_CONFIG,
        promoteFeeOptions,
      );

      if (!mnemonic || feeRecipients.length === 0) {
        return "";
      }

      const feeResult = await quick.sendXec(feeRecipients, {
        mnemonic,
        utxoStrategy: "minimal",
      });

      return feeResult.txid;
    },
    [mnemonic, promoteFeeOptions],
  );

  const handleSendTokenAirdrop = useCallback(async () => {
    if (!mnemonic || tokenSendDisabledReason) {
      return;
    }

    resetExecutionState();
    setIsSending(true);

    try {
      let promoteFeeTxid = "";
      if (PROMOTE_FEE_CONFIG.enabled) {
        promoteFeeTxid = await sendPromoteFee(
          "token-airdrop",
          distributionPlan.length,
        );
        if (promoteFeeTxid) {
          setFeeTxId(promoteFeeTxid);
        }
      }

      const txids: string[] = [];

      for (let index = 0; index < tokenBatches.length; index += 1) {
        const batch = tokenBatches[index];
        const recipientsPayload: SendRecipient[] = batch.recipients.map((recipient) => ({
          address: recipient.address,
          amount: recipient.amountAtoms,
        }));

        setCurrentBatchIndex(index + 1);

        const result = await quick.sendToken(recipientsPayload, {
          tokenId: airdropTokenId,
          mnemonic,
          feeStrategy: "minimal",
          tokenStrategy: "all",
        });

        txids.push(result.txid);
      }

      setSendTxIds(txids);
      appendHistoryEntry({
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        mode: "token-airdrop",
        recipientMode,
        recipientCount: recipients.length,
        batchCount: txids.length,
        tokenId: airdropTokenId,
        tokenLabel: airdropTokenMeta?.label || getFallbackTokenLabel(airdropTokenId),
        tokenAmount: airdropTokenMeta
          ? formatAtoms(totalAirdropAtoms, airdropTokenMeta.decimals)
          : totalAirdropAtoms.toString(),
        txids,
        feeTxId: promoteFeeTxid || undefined,
      });
      await refreshBalance();

      toast({
        title: "Airdrop sent",
        description: `${txids.length} batch${txids.length === 1 ? "" : "es"} broadcast successfully.`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send token airdrop.";
      setSendError(message);
      toast({
        title: "Airdrop failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
      setCurrentBatchIndex(0);
    }
  }, [
    airdropTokenId,
    mnemonic,
    appendHistoryEntry,
    airdropTokenMeta,
    refreshBalance,
    recipientMode,
    recipients.length,
    resetExecutionState,
    sendPromoteFee,
    toast,
    distributionPlan.length,
    tokenBatches,
    tokenSendDisabledReason,
    totalAirdropAtoms,
  ]);

  const handleSendMessage = useCallback(async () => {
    if (!mnemonic || messageSendDisabledReason) {
      return;
    }

    resetExecutionState();
    setIsSending(true);

    try {
      let promoteFeeTxid = "";
      if (PROMOTE_FEE_CONFIG.enabled) {
        promoteFeeTxid = await sendPromoteFee(
          "platform-message",
          recipients.length,
        );
        if (promoteFeeTxid) {
          setFeeTxId(promoteFeeTxid);
        }
      }

      const txids: string[] = [];

      for (let index = 0; index < messagePlan.batches.length; index += 1) {
        const batch = messagePlan.batches[index];
        const recipientsPayload: SendRecipient[] = batch.recipients.map((recipient) => ({
          address: recipient.address,
          amount: 546n,
        }));

        setCurrentBatchIndex(index + 1);

        const result = await quick.sendXec(recipientsPayload, {
          mnemonic,
          message: messageInput,
          appPrefixHex: effectivePrefixHex,
          utxoStrategy: "minimal",
        });

        txids.push(result.txid);
      }

      setSendTxIds(txids);
      appendHistoryEntry({
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        mode: "platform-message",
        recipientMode,
        recipientCount: recipients.length,
        batchCount: txids.length,
        messageBytes: messageByteLength,
        messagePreview: trimHistoryMessage(messageInput),
        txids,
        feeTxId: promoteFeeTxid || undefined,
      });
      await refreshBalance();

      toast({
        title: "Message broadcast complete",
        description: `${txids.length} batch${txids.length === 1 ? "" : "es"} broadcast successfully.`,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to send platform message.";
      setSendError(message);
      toast({
        title: "Message broadcast failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
      setCurrentBatchIndex(0);
    }
  }, [
    appendHistoryEntry,
    effectivePrefixHex,
    messageInput,
    messageByteLength,
    messagePlan.batches,
    messageSendDisabledReason,
    mnemonic,
    recipientMode,
    recipients.length,
    refreshBalance,
    resetExecutionState,
    sendPromoteFee,
    toast,
  ]);

  const sendButtonLabel = isSending
    ? `Sending batch ${currentBatchIndex}/${Math.max(activeBatchCount, 1)}`
    : mode === "token-airdrop"
      ? "Send token batches"
      : "Broadcast platform message";

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="px-4 pb-14 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Promote
              </h1>
              <p className="text-sm text-muted-foreground">
                Load recipients, then send tokens or one Cashtab message.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="rounded-xl">
                    <History className="mr-2 h-4 w-4" />
                    History
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Send History</DialogTitle>
                    <DialogDescription>
                      Local promote history on this device.
                    </DialogDescription>
                  </DialogHeader>

                  {historyEntries.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
                      No send history yet.
                    </div>
                  ) : (
                    <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
                      {historyEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-2xl border border-border/70 bg-background/80 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-medium text-foreground">
                              {entry.mode === "token-airdrop"
                                ? entry.tokenLabel || getFallbackTokenLabel(entry.tokenId ?? "")
                                : "Cashtab message"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(entry.createdAt).toLocaleString()}
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>{entry.recipientCount.toLocaleString()} recipients</span>
                            <span>{entry.batchCount.toLocaleString()} batches</span>
                            <span>{getHistoryAudienceLabel(entry.recipientMode)}</span>
                            {entry.mode === "token-airdrop" && entry.tokenAmount ? (
                              <span>{entry.tokenAmount} total</span>
                            ) : null}
                            {entry.mode === "platform-message" && typeof entry.messageBytes === "number" ? (
                              <span>{entry.messageBytes} bytes</span>
                            ) : null}
                          </div>

                          {entry.tokenId ? (
                            <div className="mt-2 break-all font-mono text-xs text-muted-foreground">
                              {entry.tokenId}
                            </div>
                          ) : null}

                          {entry.messagePreview ? (
                            <div className="mt-2 text-sm text-muted-foreground">
                              {entry.messagePreview}
                            </div>
                          ) : null}

                          <div className="mt-3 space-y-2">
                            {entry.txids.slice(0, 2).map((txid) => (
                              <a
                                key={txid}
                                href={`https://explorer.e.cash/tx/${txid}`}
                                target="_blank"
                                rel="noreferrer"
                                className="block break-all font-mono text-xs text-emerald-300 underline"
                              >
                                {txid}
                              </a>
                            ))}
                            {entry.txids.length > 2 ? (
                              <div className="text-xs text-muted-foreground">
                                +{entry.txids.length - 2} more txids
                              </div>
                            ) : null}
                            {entry.feeTxId ? (
                              <a
                                href={`https://explorer.e.cash/tx/${entry.feeTxId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="block break-all font-mono text-xs text-muted-foreground underline"
                              >
                                Fee: {entry.feeTxId}
                              </a>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      disabled={historyEntries.length === 0}
                      onClick={clearHistory}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Clear history
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Button variant="outline" className="rounded-xl" onClick={resetWorkspace}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
            <div className="space-y-6">
              <Card className="border-border/70">
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-xl tracking-tight">Recipients</CardTitle>
                  <Tabs
                    value={recipientMode}
                    onValueChange={(value) => setRecipientMode(value as RecipientSource)}
                    className="w-full sm:w-auto"
                  >
                    <TabsList className="h-10 rounded-xl bg-muted/60 p-1">
                      <TabsTrigger value="holders" className="rounded-lg px-3">
                        Token holders
                      </TabsTrigger>
                      <TabsTrigger value="manual" className="rounded-lg px-3">
                        Manual
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </CardHeader>

                <CardContent>
                  <Tabs value={recipientMode} className="w-full">
                    <TabsContent value="holders" className="mt-0 space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Load holder addresses for one token.
                      </p>

                      <div className="space-y-3">
                        <Label htmlFor="target-token">Target token ID</Label>
                        <div className="flex gap-2">
                          <Input
                            id="target-token"
                            placeholder="Paste a token ID"
                            value={targetTokenInput}
                            onChange={(event) => setTargetTokenInput(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void loadTargetHolders(targetTokenInput);
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isLoadingHolders || isChronikLoading}
                            onClick={() => void loadTargetHolders(targetTokenInput)}
                          >
                            {isLoadingHolders ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Search className="h-4 w-4" />
                            )}
                          </Button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {targetQuickPicks.map((token) => (
                            <Button
                              key={token.tokenId}
                              type="button"
                              variant="outline"
                              className="h-auto rounded-full px-3 py-1.5 text-xs"
                              onClick={() => void loadTargetHolders(token.tokenId)}
                            >
                              {token.label}
                            </Button>
                          ))}
                        </div>

                        {loadedTargetTokenId && targetTokenMeta ? (
                          <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-3 text-sm">
                            <div className="font-medium text-foreground">
                              {targetTokenMeta.label}
                            </div>
                            <div className="mt-1 break-all font-mono text-xs text-muted-foreground">
                              {loadedTargetTokenId}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span>{holderRows.length.toLocaleString()} holders</span>
                              <span>
                                Total tracked:{" "}
                                {formatAtoms(totalHoldingAtoms, targetTokenMeta.decimals)}
                              </span>
                            </div>
                          </div>
                        ) : null}

                        {holderLoadError ? (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Holder load failed</AlertTitle>
                            <AlertDescription>{holderLoadError}</AlertDescription>
                          </Alert>
                        ) : null}
                      </div>
                    </TabsContent>

                    <TabsContent value="manual" className="mt-0 space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Paste addresses separated by spaces, commas, or newlines.
                      </p>

                      <div className="space-y-3">
                        <Label htmlFor="manual-addresses">Manual address list</Label>
                        <Textarea
                          id="manual-addresses"
                          placeholder="ecash:q..."
                          value={manualAddressesInput}
                          onChange={(event) => setManualAddressesInput(event.target.value)}
                          className="min-h-[188px] resize-y"
                        />

                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>{manualParse.addresses.length.toLocaleString()} valid</span>
                          <span>{manualParse.invalidEntries.length.toLocaleString()} ignored</span>
                          <span>{manualParse.duplicateCount.toLocaleString()} duplicates</span>
                        </div>

                        {manualParse.invalidEntries.length > 0 ? (
                          <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Invalid addresses ignored</AlertTitle>
                            <AlertDescription>
                              {manualParse.invalidEntries.slice(0, 3).join(", ")}
                              {manualParse.invalidEntries.length > 3 ? " ..." : ""}
                            </AlertDescription>
                          </Alert>
                        ) : null}
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-xl tracking-tight">
                    {mode === "token-airdrop" ? "Token" : "Message"}
                  </CardTitle>
                  <Tabs
                    value={mode}
                    onValueChange={(value) => setMode(value as PromoteMode)}
                    className="w-full sm:w-auto"
                  >
                    <TabsList className="h-10 rounded-xl bg-muted/60 p-1">
                      <TabsTrigger value="token-airdrop" className="rounded-lg px-3">
                        <Coins className="mr-2 h-4 w-4" />
                        Token
                      </TabsTrigger>
                      <TabsTrigger value="platform-message" className="rounded-lg px-3">
                        <Megaphone className="mr-2 h-4 w-4" />
                        Message
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </CardHeader>

                <CardContent className="space-y-6">
                  {mode === "token-airdrop" ? (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="airdrop-token">Token to send</Label>
                          <Select value={airdropTokenId} onValueChange={setAirdropTokenId}>
                            <SelectTrigger id="airdrop-token">
                              <SelectValue
                                placeholder={
                                  isWalletConnected
                                    ? "Choose a token from your wallet"
                                    : "Connect a wallet to load tokens"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {walletTokenOptions.map((token) => (
                                <SelectItem key={token.tokenId} value={token.tokenId}>
                                  {token.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="text-xs text-muted-foreground">
                            {airdropTokenMeta
                              ? `${airdropTokenMeta.protocol} • ${airdropTokenMeta.decimals} decimals`
                              : "Protocol and decimals load automatically after selection."}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Wallet balance</Label>
                          <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm">
                            {airdropTokenMeta
                              ? `${formatAtoms(
                                  selectedWalletTokenBalance,
                                  airdropTokenMeta.decimals,
                                )} ${airdropTokenMeta.label}`
                              : "Select a token to inspect balance"}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label>Distribution mode</Label>
                        <div className="grid gap-3 md:grid-cols-2">
                          <button
                            type="button"
                            className={cn(
                              "rounded-2xl border px-4 py-4 text-left transition-colors",
                              distributionMode === "proportional"
                                ? "border-emerald-400/40 bg-emerald-500/10"
                                : "border-border/70 bg-background/70",
                            )}
                            disabled={!canUseProportional}
                            onClick={() => setDistributionMode("proportional")}
                          >
                            <div className="text-sm font-medium text-foreground">
                              Proportional
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              Mirror current holder balance weights.
                            </div>
                            {!canUseProportional ? (
                              <div className="mt-3 text-xs text-amber-300">
                                Only available when the audience is token holders only.
                              </div>
                            ) : null}
                          </button>

                          <button
                            type="button"
                            className={cn(
                              "rounded-2xl border px-4 py-4 text-left transition-colors",
                              distributionMode === "fixed"
                                ? "border-cyan-400/40 bg-cyan-500/10"
                                : "border-border/70 bg-background/70",
                            )}
                            onClick={() => setDistributionMode("fixed")}
                          >
                            <div className="text-sm font-medium text-foreground">
                              Fixed per address
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              Send the same amount to every selected recipient.
                            </div>
                          </button>
                        </div>
                      </div>

                      {distributionMode === "proportional" ? (
                        <div className="space-y-2">
                          <Label htmlFor="total-input">Total amount to distribute</Label>
                          <Input
                            id="total-input"
                            placeholder="100000"
                            value={totalInput}
                            onChange={(event) => setTotalInput(event.target.value)}
                          />
                          {totalAtomsError ? (
                            <div className="text-xs text-destructive">{totalAtomsError}</div>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              Final plan is rounded in atoms and stays exact.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label htmlFor="fixed-input">Amount per address</Label>
                          <Input
                            id="fixed-input"
                            placeholder="100"
                            value={fixedInput}
                            onChange={(event) => setFixedInput(event.target.value)}
                          />
                          {fixedAtomsError ? (
                            <div className="text-xs text-destructive">{fixedAtomsError}</div>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              Works with either recipient mode.
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="message-input">Message payload</Label>
                        <Textarea
                          id="message-input"
                          className="min-h-[188px] resize-y"
                          placeholder="Share one clean platform message with every selected address."
                          value={messageInput}
                          onChange={(event) => setMessageInput(event.target.value)}
                        />
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            {messageByteLength}/{XEC_APP_MESSAGE_BYTE_LIMIT} bytes
                          </span>
                          {messageValidationError ? (
                            <span className="text-destructive">{messageValidationError}</span>
                          ) : (
                            <span>Cashtab format only.</span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle className="text-xl tracking-tight">Summary</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2">
                      <span className="text-muted-foreground">Recipients</span>
                      <span className="font-medium text-foreground">
                        {recipients.length.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2">
                      <span className="text-muted-foreground">Batches</span>
                      <span className="font-medium text-foreground">
                        {activeBatchCount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2">
                      <span className="text-muted-foreground">
                        {mode === "token-airdrop" ? "Token total" : "Message bytes"}
                      </span>
                      <span className="font-medium text-foreground">
                        {mode === "token-airdrop"
                          ? airdropTokenMeta
                            ? formatAtoms(totalAirdropAtoms, airdropTokenMeta.decimals)
                            : "0"
                          : messageByteLength.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2">
                      <span className="text-muted-foreground">Estimated XEC</span>
                      <span className="font-medium text-foreground">
                        {formatSatsAsXec(
                          mode === "token-airdrop"
                            ? totalTokenSpendSats
                            : totalMessageSpendSats,
                        )}
                      </span>
                    </div>
                  </div>

                  {walletSpendDataError ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Wallet inspection failed</AlertTitle>
                      <AlertDescription>{walletSpendDataError}</AlertDescription>
                    </Alert>
                  ) : null}

                  {!isWalletConnected ? (
                    <Alert>
                      <Wallet className="h-4 w-4" />
                      <AlertTitle>Wallet not connected</AlertTitle>
                      <AlertDescription>
                        Connect a wallet when you are ready to send.
                      </AlertDescription>
                    </Alert>
                  ) : isGuestMode ? (
                    <Alert>
                      <Wallet className="h-4 w-4" />
                      <AlertTitle>Guest wallet connected</AlertTitle>
                      <AlertDescription>
                        Preview works, but sending requires a mnemonic-backed wallet.
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {unsupportedRecipients.length > 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Skipping unsupported recipients</AlertTitle>
                      <AlertDescription className="space-y-1.5">
                        <p>
                          {unsupportedRecipients.length.toLocaleString()} selected address
                          {unsupportedRecipients.length === 1 ? "" : "es"} use P2SH scripts.
                        </p>
                        <p>
                          Promote currently sends only to P2PKH addresses, so these
                          will not be included.
                        </p>
                        {unsupportedRecipientPreview.length > 0 ? (
                          <div className="space-y-1">
                            <p>
                              Example{unsupportedRecipientPreview.length === 1 ? "" : "s"}:
                            </p>
                            {unsupportedRecipientPreview.map((recipient) => (
                              <div
                                key={recipient.address}
                                className="break-all font-mono text-xs text-muted-foreground"
                              >
                                {recipient.address}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {activeSendDisabledReason ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Not ready to send</AlertTitle>
                      <AlertDescription>{activeSendDisabledReason}</AlertDescription>
                    </Alert>
                  ) : (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>Ready to send</AlertTitle>
                      <AlertDescription>Ready.</AlertDescription>
                    </Alert>
                  )}

                  {sendError ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Send failed</AlertTitle>
                      <AlertDescription>{sendError}</AlertDescription>
                    </Alert>
                  ) : null}

                  <div className="rounded-2xl border border-border/70">
                    <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          Recipient preview
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Showing {previewRecipients.length} of {mode === "token-airdrop" ? distributionPlan.length : recipients.length}
                        </div>
                      </div>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </div>

                    <div className="max-h-[320px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Address</TableHead>
                            {mode === "token-airdrop" ? (
                              <>
                                {isHolderAudience ? (
                                  <TableHead className="text-right">Hold</TableHead>
                                ) : null}
                                <TableHead className="text-right">Send</TableHead>
                              </>
                            ) : null}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewRecipients.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={mode === "token-airdrop" ? (isHolderAudience ? 3 : 2) : 1}
                                className="text-center text-sm text-muted-foreground"
                              >
                                No recipients yet.
                              </TableCell>
                            </TableRow>
                          ) : mode === "token-airdrop" ? (
                            (previewRecipients as DistributionRecipient[]).map((recipient) => (
                              <TableRow key={recipient.address}>
                                <TableCell className="max-w-[180px] break-all font-mono text-xs">
                                  {recipient.address}
                                </TableCell>
                                {isHolderAudience ? (
                                  <TableCell className="text-right text-xs text-muted-foreground">
                                    {targetTokenMeta
                                      ? formatAtoms(
                                          recipient.holdingAtoms,
                                          targetTokenMeta.decimals,
                                        )
                                      : recipient.holdingAtoms.toString()}
                                  </TableCell>
                                ) : null}
                                <TableCell className="text-right text-sm">
                                  {airdropTokenMeta
                                    ? formatAtoms(
                                        recipient.amountAtoms,
                                        airdropTokenMeta.decimals,
                                      )
                                    : recipient.amountAtoms.toString()}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            previewRecipients.map((recipient) => (
                              <TableRow key={recipient.address}>
                                <TableCell className="max-w-[180px] break-all font-mono text-xs">
                                  {recipient.address}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {feeTxId ? (
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-3 text-sm">
                      <div className="font-medium text-foreground">
                        Promote fee transaction
                      </div>
                      <a
                        href={`https://explorer.e.cash/tx/${feeTxId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block break-all font-mono text-xs text-emerald-300 underline"
                      >
                        {feeTxId}
                      </a>
                    </div>
                  ) : null}

                  {sendTxIds.length > 0 ? (
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-3 text-sm">
                      <div className="font-medium text-foreground">
                        Broadcast transactions
                      </div>
                      <div className="mt-2 space-y-2">
                        {sendTxIds.map((txid) => (
                          <a
                            key={txid}
                            href={`https://explorer.e.cash/tx/${txid}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-start gap-2 break-all font-mono text-xs text-emerald-300 underline"
                          >
                            <Send className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span>{txid}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-2">
                    <Button
                      className="h-11 rounded-xl"
                      disabled={isSending || Boolean(activeSendDisabledReason)}
                      onClick={() =>
                        mode === "token-airdrop"
                          ? void handleSendTokenAirdrop()
                          : void handleSendMessage()
                      }
                    >
                      {isSending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      {sendButtonLabel}
                    </Button>

                    <div className="text-center text-xs text-muted-foreground">
                      {PROMOTE_FEE_CONFIG.enabled
                        ? `Platform fee: ${getPromoteFeeLabel(
                            mode,
                            PROMOTE_FEE_CONFIG,
                            promoteFeeOptions,
                          )}`
                        : "No platform fee is active right now."}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
