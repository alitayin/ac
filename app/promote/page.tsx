"use client"

import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "@/components/ui/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import quick from "ecash-quicksend";
import { ChronikClient } from "chronik-client";
import { encodeCashAddress, getTypeAndHashFromOutputScript } from "ecashaddrjs";
import { useWallet } from "@/lib/context/WalletContext";
import { fetchTokenDetails, getTokenDecimalsFromDetails } from "@/lib/chronik";
import { tokens as TOKEN_CONFIGS } from "@/config/tokens";

type AddressRow = {
  address: string;
  rawAmount: bigint;
};

type AirdropRow = AddressRow & {
  dropAmount: bigint;
};

const TARGET_TOKENS = [
  {
    tokenId: "aed861a31b96934b88c0252ede135cb9700d7649f69191235087a3030e553cb1",
    label: "Cachet holders",
    decimals: 0,
  },
  {
    tokenId: "d1131675cb62b65909fb45ba53b022da0bd0f34aaa71fc61770115472b186ffb",
    label: "Star Shard holders",
    decimals: 0,
  },
];

const FEE_PAYMENT_ADDRESS = "ecash:qzey4jkh2x23q2zngq50z8uxgw0ek4xazgh65we6y0";
const FEE_PER_ADDRESS_XEC = BigInt(500);
const SATS_PER_XEC = BigInt(100);

const chronik = new ChronikClient([
  "https://chronik.e.cash",
  "https://chronik-native1.fabien.cash",
  "https://chronik-native2.fabien.cash",
  "https://chronik-native3.fabien.cash",
]);

function makeDivisor(decimals: number): bigint {
  if (decimals <= 0) return BigInt(1);
  return BigInt("1" + "0".repeat(decimals));
}

function formatAmount(rawAmount: bigint, decimals: number): string {
  if (rawAmount === BigInt(0)) return "0";
  const divisor = makeDivisor(decimals);
  const integerPart = rawAmount / divisor;
  const fractionPart = rawAmount % divisor;
  const integerStr = Number(integerPart).toLocaleString("en-US");
  if (fractionPart === BigInt(0)) return integerStr;
  const fractionStr = fractionPart.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${integerStr}.${fractionStr}`;
}

function formatPercent(n: number): string {
  return `${n.toFixed(2)}%`;
}

function formatXecFromSats(sats: bigint): string {
  const integer = sats / SATS_PER_XEC;
  const fraction = sats % SATS_PER_XEC;
  if (fraction === BigInt(0)) return integer.toString();
  const fracStr = fraction.toString().padStart(2, "0").replace(/0+$/, "");
  return `${integer.toString()}.${fracStr}`;
}

function parseAmountToAtoms(amount: string, decimals: number): bigint {
  const trimmed = amount.trim();
  if (!trimmed) return BigInt(0);
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return BigInt(0);
  const [intPart, fracPartRaw = ""] = trimmed.split(".");
  const fracPart = (fracPartRaw + "0".repeat(decimals)).slice(0, decimals);
  try {
    return BigInt(intPart + fracPart);
  } catch {
    return BigInt(0);
  }
}

export default function AirdropPage() {
  const { isWalletConnected, userTokens, mnemonic, isGuestMode, balance } = useWallet();

  const [targetTokenId, setTargetTokenId] = useState<string>("");
  const [customTargetInput, setCustomTargetInput] = useState<string>("");
  const [showTargetSuggestions, setShowTargetSuggestions] = useState<boolean>(false);
  const [rows, setRows] = useState<AddressRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const [airdropTokenId, setAirdropTokenId] = useState<string>("");
  const [airdropDecimals, setAirdropDecimals] = useState<number>(0);
  const [airdropTokenLabel, setAirdropTokenLabel] = useState<string>("");
  const [airdropProtocol, setAirdropProtocol] = useState<"ALP" | "SLP" | "UNKNOWN">("UNKNOWN");
  const [distributionMode, setDistributionMode] = useState<"proportional" | "fixed">("proportional");
  const [totalInput, setTotalInput] = useState<string>("");
  const [fixedInput, setFixedInput] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendError, setSendError] = useState<string>("");
  const [sendTxIds, setSendTxIds] = useState<string[]>([]);
  const [feeTxId, setFeeTxId] = useState<string>("");
  const [currentBatch, setCurrentBatch] = useState<number>(0);

  const currentTargetConfig = useMemo(() => TARGET_TOKENS.find((t) => t.tokenId === targetTokenId), [targetTokenId]);

  const suggestedTokens = useMemo(() => {
    const merged: { tokenId: string; label: string }[] = [];
    // 优先展示固定目标代币
    for (const t of TARGET_TOKENS) {
      merged.push({
        tokenId: t.tokenId,
        label: t.label,
      });
    }
    for (const t of Object.values(TOKEN_CONFIGS)) {
      merged.push({
        tokenId: t.tokenId,
        label: `${t.name} (${t.symbol})`,
      });
    }
    // de-dup by tokenId, keep first occurrence
    const seen = new Set<string>();
    return merged.filter((item) => {
      if (seen.has(item.tokenId)) return false;
      seen.add(item.tokenId);
      return true;
    });
  }, []);

  const walletTokens = useMemo(
    () =>
      Object.entries(userTokens).map(([tokenId, atoms]) => ({
        tokenId,
        atoms,
      })),
    [userTokens],
  );

  const selectedWalletTokenBalance = useMemo(() => {
    if (!airdropTokenId) return BigInt(0);
    const raw = userTokens[airdropTokenId];
    if (!raw) return BigInt(0);
    try {
      return BigInt(raw);
    } catch {
      return BigInt(0);
    }
  }, [airdropTokenId, userTokens]);

  useEffect(() => {
    let cancelled = false;
    async function loadDecimals() {
      if (!airdropTokenId) {
        setAirdropDecimals(0);
        setAirdropProtocol("UNKNOWN");
        return;
      }
      try {
        const details = await fetchTokenDetails(airdropTokenId);
        if (cancelled) return;
        const dec = getTokenDecimalsFromDetails(details, 0);
        setAirdropDecimals(dec);
        const ticker = details?.genesisInfo?.tokenTicker;
        const name = details?.genesisInfo?.tokenName;
        const label = ticker || name || airdropTokenId.substring(0, 6);
        setAirdropTokenLabel(label);
        const protocol = details?.tokenType?.protocol === "SLP" ? "SLP" : "ALP";
        setAirdropProtocol(protocol);
      } catch {
        if (!cancelled) setAirdropDecimals(0);
        if (!cancelled) setAirdropTokenLabel("");
        if (!cancelled) setAirdropProtocol("UNKNOWN");
      }
    }
    loadDecimals();
    return () => {
      cancelled = true;
    };
  }, [airdropTokenId]);

  const load = useCallback(
    async (tokenId: string) => {
      if (!tokenId) {
        setRows([]);
        setError("");
        return;
      }
      setIsLoading(true);
      setError("");
      try {
        const utxosResp = await chronik.tokenId(tokenId).utxos();
        const utxos = utxosResp?.utxos || [];

        const mapAddressToAmount = new Map<string, bigint>();

        for (const utxo of utxos) {
          const token = utxo.token;
          if (!token) continue;

          let rawAmount: bigint = BigInt(0);
          if (typeof (token as any).atoms !== "undefined") {
            try {
              rawAmount = BigInt((token as any).atoms);
            } catch {
              rawAmount = BigInt(0);
            }
          } else if (typeof (token as any).amount !== "undefined") {
            try {
              rawAmount = BigInt((token as any).amount);
            } catch {
              rawAmount = BigInt(0);
            }
          } else if (typeof (token as any).value !== "undefined") {
            try {
              rawAmount = BigInt((token as any).value);
            } catch {
              rawAmount = BigInt(0);
            }
          }

          if (rawAmount === BigInt(0)) continue;

          let address = "unknown";
          try {
            const { type, hash } = getTypeAndHashFromOutputScript(utxo.script);
            address = encodeCashAddress("ecash", type, hash);
          } catch {
            continue;
          }

          const prev = mapAddressToAmount.get(address) || BigInt(0);
          mapAddressToAmount.set(address, prev + rawAmount);
        }

        const nextRows: AddressRow[] = Array.from(mapAddressToAmount.entries()).map(([address, rawAmount]) => ({
          address,
          rawAmount,
        }));
        setRows(nextRows);
      } catch (e: any) {
        setError(e?.message || "Failed to load holder addresses");
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    load(targetTokenId);
    if (!targetTokenId) return;
    const id = setInterval(() => load(targetTokenId), 30000);
    return () => clearInterval(id);
  }, [targetTokenId, load]);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (a.rawAmount === b.rawAmount) return 0;
      return a.rawAmount < b.rawAmount ? 1 : -1;
    });
    return copy;
  }, [rows]);

  const totalRaw = useMemo(() => rows.reduce((acc, r) => acc + r.rawAmount, BigInt(0)), [rows]);
  const targetDecimals = currentTargetConfig?.decimals ?? 0;
  const totalFormatted = useMemo(() => formatAmount(totalRaw, targetDecimals), [totalRaw, targetDecimals]);

  const parsedTotalAtoms = useMemo(() => parseAmountToAtoms(totalInput, airdropDecimals), [totalInput, airdropDecimals]);
  const parsedFixedAtoms = useMemo(() => parseAmountToAtoms(fixedInput, airdropDecimals), [fixedInput, airdropDecimals]);

  const airdropPlan: AirdropRow[] = useMemo(() => {
    if (!airdropTokenId || rows.length === 0) return [];
    let plan: AirdropRow[] = [];
    if (distributionMode === "proportional") {
      if (parsedTotalAtoms === BigInt(0) || totalRaw === BigInt(0)) return [];
      plan = rows.map((r) => ({
        ...r,
        dropAmount: (parsedTotalAtoms * r.rawAmount) / totalRaw,
      }));
    } else if (distributionMode === "fixed") {
      if (parsedFixedAtoms === BigInt(0)) return [];
      plan = rows.map((r) => ({
        ...r,
        dropAmount: parsedFixedAtoms,
      }));
    }
    plan = plan.filter((r) => r.dropAmount > BigInt(0));
    return plan.sort((a, b) => {
      if (a.dropAmount === b.dropAmount) return 0;
      return a.dropAmount < b.dropAmount ? 1 : -1;
    });
  }, [airdropTokenId, rows, distributionMode, parsedTotalAtoms, parsedFixedAtoms, totalRaw]);

  const totalAirdropNeeded = useMemo(
    () => airdropPlan.reduce((acc, r) => acc + r.dropAmount, BigInt(0)),
    [airdropPlan],
  );

  const requiredXecFee = useMemo(
    () => BigInt(airdropPlan.length) * FEE_PER_ADDRESS_XEC * BigInt(100),
    [airdropPlan.length],
  );

  const requiredXecFeeDisplay = useMemo(() => formatXecFromSats(requiredXecFee), [requiredXecFee]);

  const availableXecSats = useMemo(() => {
    const [intPart, fracPartRaw = ""] = balance.trim().split(".");
    const fracPart = (fracPartRaw + "0".repeat(2)).slice(0, 2);
    try {
      return BigInt(intPart || "0") * BigInt(100) + BigInt(fracPart || "0");
    } catch {
      return BigInt(0);
    }
  }, [balance]);

  const hasEnoughXecForFee = useMemo(() => availableXecSats >= requiredXecFee, [availableXecSats, requiredXecFee]);

  const hasEnoughAirdropToken = useMemo(
    () => selectedWalletTokenBalance >= totalAirdropNeeded,
    [selectedWalletTokenBalance, totalAirdropNeeded],
  );

  const planBatches = useMemo(() => {
    const batches: AirdropRow[][] = [];
    const size = 19;
    for (let i = 0; i < airdropPlan.length; i += size) {
      batches.push(airdropPlan.slice(i, i + size));
    }
    return batches;
  }, [airdropPlan]);

  const handleSend = useCallback(async () => {
    if (!airdropTokenId || airdropPlan.length === 0) {
      setSendError("Generate the airdrop list first.");
      return;
    }
    if (!isWalletConnected) {
      setSendError("Connect your wallet first.");
      return;
    }
    if (isGuestMode || !mnemonic) {
      setSendError("Mnemonic not available. Please connect with a mnemonic-enabled wallet.");
      return;
    }

    setSendError("");
    setSendTxIds([]);
    setFeeTxId("");
    setIsSending(true);
    setCurrentBatch(0);
    try {
      const feeAmountNumber = Number(requiredXecFee);
      if (!Number.isFinite(feeAmountNumber) || BigInt(feeAmountNumber) !== requiredXecFee) {
        throw new Error("Fee amount too large to process.");
      }

      const feeRes = await quick.sendXec([
        {
          address: FEE_PAYMENT_ADDRESS,
          amount: feeAmountNumber,
        },
      ], {
        mnemonic,
      });
      const feeTxid = (feeRes as any)?.txid;
      if (!feeTxid) {
        throw new Error("Fee payment failed; please retry.");
      }
      setFeeTxId(feeTxid);

      const method = airdropProtocol === "SLP" ? quick.sendSlp : quick.sendAlp;

      const txids: string[] = [];
        for (let i = 0; i < planBatches.length; i++) {
          const batch = planBatches[i];
          setCurrentBatch(i + 1);
        const recipients = batch.map((r) => {
          if (r.dropAmount > BigInt(Number.MAX_SAFE_INTEGER)) {
            throw new Error("Airdrop amount too large. Split into more batches or reduce total.");
          }
          return {
            address: r.address,
            amount: Number(r.dropAmount), 
          };
        });

        const res = await method(recipients, {
          tokenId: airdropTokenId,
          tokenDecimals: airdropDecimals,
          mnemonic,
        });

        if (res && (res as any).txid) {
          txids.push((res as any).txid);
        }
      }
      setSendTxIds(txids);
    } catch (e: any) {
      setSendError(e?.message || "Send failed");
    } finally {
      setIsSending(false);
    }
  }, [airdropTokenId, airdropPlan, isWalletConnected, airdropProtocol, airdropDecimals, planBatches, requiredXecFee, mnemonic, isGuestMode]);

  const handleReset = useCallback(() => {
    setTargetTokenId("");
    setRows([]);
    setAirdropTokenId("");
    setAirdropDecimals(0);
    setAirdropTokenLabel("");
    setAirdropProtocol("UNKNOWN");
    setDistributionMode("proportional");
    setTotalInput("");
    setFixedInput("");
    setSendTxIds([]);
    setFeeTxId("");
    setSendError("");
    setCurrentBatch(0);
    setIsSending(false);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 p-0 sm:p-6">
        <div className="mx-auto w-full md:max-w-5xl space-y-4">
          <Card className="rounded-2xl">
            <CardHeader>
                <CardTitle>Promote</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  This page lets you send any token in your wallet to holders of any token. Connect your wallet, choose
                  the target token holders, pick the token you want to promote, then send.
                </p>
                <p>Select a target token below to load its holders, then prepare your transfers.</p>
              </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Target token holders</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Sorted by holding amount to help you airdrop efficiently.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-full max-w-[360px]">
                  <Input
                    placeholder="Enter target token ID or pick suggestion"
                    value={customTargetInput}
                    onChange={(e) => setCustomTargetInput(e.target.value)}
                    onFocus={() => setShowTargetSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowTargetSuggestions(false), 120)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const nextId = customTargetInput.trim();
                        setTargetTokenId(nextId);
                        setShowTargetSuggestions(false);
                      }
                    }}
                  />
                  {showTargetSuggestions && (
                    <div className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-md border bg-popover shadow-sm">
                      {suggestedTokens.map((t) => (
                        <button
                          key={t.tokenId}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-accent"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setCustomTargetInput(t.tokenId);
                            setTargetTokenId(t.tokenId);
                            setShowTargetSuggestions(false);
                          }}
                        >
                          <div className="font-medium">{t.label}</div>
                          <div className="text-xs text-muted-foreground break-all">{t.tokenId}</div>
                        </button>
                      ))}
                      {suggestedTokens.length === 0 && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No suggestions</div>
                      )}
                    </div>
                  )}
                </div>
                <Button variant="outline" onClick={() => load(targetTokenId)} disabled={isLoading || !targetTokenId}>
                  {isLoading ? "Loading..." : "Refresh"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {error && <div className="text-sm text-red-500">{error}</div>}
              {!error && (
                <>
                  <div className="text-sm mb-3 text-muted-foreground flex items-center justify-between">
                    <span>Total: {totalFormatted}</span>
                    <span>Holders: {rows.length}</span>
                  </div>
                  <div className="h-[200px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Address</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedRows.map((r) => {
                          const pct = totalRaw === BigInt(0) ? 0 : (Number(r.rawAmount) / Number(totalRaw)) * 100;
                          const barWidth = Math.max(2, Math.min(100, pct));
                          return (
                            <TableRow key={r.address}>
                              <TableCell className="font-mono text-xs break-all">{r.address}</TableCell>
                              <TableCell className="text-right relative">
                                <div
                                  className="absolute left-0 top-1/2 -translate-y-1/2 h-5 rounded bg-white/10"
                                  style={{ width: `${barWidth}%` }}
                                />
                                <span className="relative z-10">{formatAmount(r.rawAmount, targetDecimals)}</span>
                              </TableCell>
                              <TableCell className="text-right">{formatPercent(pct)}</TableCell>
                            </TableRow>
                          );
                        })}
                        {sortedRows.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                              No token UTXOs found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Prepare promotion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {isWalletConnected
                  ? "Wallet connected. Choose the token you want to promote."
                  : "Connect your wallet first, then choose the token to promote."}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Your airdrop token</Label>
                  <Select
                    value={airdropTokenId}
                    onValueChange={(v) => setAirdropTokenId(v)}
                    disabled={!isWalletConnected || walletTokens.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isWalletConnected ? "Select token" : "Connect wallet first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {walletTokens.map((t) => (
                        <SelectItem key={t.tokenId} value={t.tokenId}>
                          {t.tokenId} (balance: {formatAmount(BigInt(t.atoms || "0"), airdropDecimals)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Token decimals</Label>
                  <div className="p-3 border rounded-lg text-sm">{airdropDecimals}</div>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Airdrop mode</Label>
                <RadioGroup
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                  value={distributionMode}
                  onValueChange={(v) => setDistributionMode(v as "proportional" | "fixed")}
                >
                  <Label className="flex items-center gap-2 border rounded-lg p-3 cursor-pointer">
                    <RadioGroupItem value="proportional" />
                    Proportional to holdings (enter total to airdrop)
                  </Label>
                  <Label className="flex items-center gap-2 border rounded-lg p-3 cursor-pointer">
                    <RadioGroupItem value="fixed" />
                    Fixed amount per address
                  </Label>
                </RadioGroup>
              </div>

              {distributionMode === "proportional" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Total amount to airdrop</Label>
                    <Input
                      placeholder="e.g. 100000"
                      value={totalInput}
                      onChange={(e) => setTotalInput(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Wallet available balance</Label>
                    <div className="p-3 border rounded-lg text-sm">
                      {formatAmount(selectedWalletTokenBalance, airdropDecimals)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount per address</Label>
                    <Input
                      placeholder="e.g. 100"
                      value={fixedInput}
                      onChange={(e) => setFixedInput(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Wallet available balance</Label>
                    <div className="p-3 border rounded-lg text-sm">
                      {formatAmount(selectedWalletTokenBalance, airdropDecimals)}
                    </div>
                  </div>
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                Planned total: {formatAmount(totalAirdropNeeded, airdropDecimals)} (holder count {rows.length})
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Promotion preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground mb-3">
                After selecting target token, your token, and amounts, the promotion per address is calculated below.
              </div>
              <div className="h-[200px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Address</TableHead>
                      <TableHead className="text-right">Holding</TableHead>
                      <TableHead className="text-right">Promotion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {airdropPlan.map((r) => (
                      <TableRow key={r.address}>
                        <TableCell className="font-mono text-xs break-all">{r.address}</TableCell>
                        <TableCell className="text-right">
                          {formatAmount(r.rawAmount, targetDecimals)} {airdropTokenLabel || ""}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatAmount(r.dropAmount, airdropDecimals)} {airdropTokenLabel || ""}
                        </TableCell>
                      </TableRow>
                    ))}
                    {airdropPlan.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                        Select target token, your token, and amounts to preview promotion
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Confirm & send</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-1">
                <div>
                  Total addresses: {airdropPlan.length}, batches: {planBatches.length} (max 19 each), planned send:{" "}
                  {formatAmount(totalAirdropNeeded, airdropDecimals)} {airdropTokenLabel || ""}.
                </div>
                  <div>Service fee: {requiredXecFeeDisplay} XEC (500 XEC per address).</div>
                <div className="text-red-400">
                  Do not leave or refresh the page while sending to avoid interruptions.
                </div>
                {isSending && planBatches.length > 0 && (
                  <div className="text-yellow-400">
                    Sending batch {currentBatch}/{planBatches.length}
                  </div>
                )}
                {!hasEnoughXecForFee && (
                  <div className="text-red-400">Insufficient XEC balance for service fee.</div>
                )}
                {!hasEnoughAirdropToken && (
                  <div className="text-red-400">Insufficient airdrop token balance.</div>
                )}
              </div>

              {sendError && <div className="text-sm text-red-500">{sendError}</div>}
              {feeTxId && (
                <div className="text-sm text-green-500 space-y-1">
                  <div>Service fee paid:</div>
                  <div className="font-mono break-all">
                    <a
                      href={`https://explorer.e.cash/tx/${feeTxId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-green-300"
                    >
                      {feeTxId}
                    </a>
                  </div>
                </div>
              )}
              {sendTxIds.length > 0 && (
                <div className="text-sm text-green-500 space-y-1">
                  <div>Sent successfully:</div>
                  {sendTxIds.map((txid) => (
                    <div key={txid} className="font-mono break-all">
                      <a
                        href={`https://explorer.e.cash/tx/${txid}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-green-300"
                      >
                        {txid}
                      </a>
                    </div>
                  ))}
                </div>
              )}

              {sendTxIds.length > 0 ? (
                <Button className="w-full" disabled={isSending} onClick={handleReset}>
                  Clear & restart
                </Button>
              ) : (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      disabled={
                        isSending ||
                        !airdropTokenId ||
                        airdropPlan.length === 0 ||
                        totalAirdropNeeded === BigInt(0) ||
                        !hasEnoughXecForFee ||
                        !hasEnoughAirdropToken
                      }
                    >
                      {isSending ? "Sending..." : "Confirm & send"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 space-y-3">
                    <div className="text-sm font-medium">Please confirm the details</div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>Address count: {airdropPlan.length}</div>
                      <div>Batches: {planBatches.length} (max 19 each)</div>
                      <div>
                        Total: {formatAmount(totalAirdropNeeded, airdropDecimals)} {airdropTokenLabel || ""}
                      </div>
                    <div>Service fee: {requiredXecFeeDisplay} XEC (500 XEC per address)</div>
                      <div>Token protocol: {airdropProtocol}</div>
                      {isSending && planBatches.length > 0 && (
                        <div>Progress: batch {currentBatch}/{planBatches.length}</div>
                      )}
                    </div>
                    <Button className="w-full" disabled={isSending || !hasEnoughXecForFee || !hasEnoughAirdropToken} onClick={handleSend}>
                      {isSending ? "Sending..." : "Confirm & send"}
                    </Button>
                    <div className="text-xs text-muted-foreground">
                      Powered by ecash-quicksend. Requires mnemonic-mode wallet; ensure sufficient balance.
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

