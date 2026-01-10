"use client"
import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { ChronikClient } from "chronik-client";
import { encodeCashAddress, getTypeAndHashFromOutputScript } from "ecashaddrjs";

interface AddressDistributionProps {
  tokenId: string;
  decimals?: number;
  className?: string;
}

type AddressRow = {
  address: string;
  rawAmount: bigint; // amount in base units
  hasMintBaton: boolean;
};

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

export default function AddressDistribution({ tokenId, decimals = 0, className = "" }: AddressDistributionProps) {
  const [rows, setRows] = useState<AddressRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [sortDesc, setSortDesc] = useState<boolean>(true);

  useEffect(() => {
    let isCancelled = false;
    async function load() {
      setIsLoading(true);
      setError("");
      try {
        const utxosResp = await chronik.tokenId(tokenId).utxos();
        const utxos = utxosResp?.utxos || [];

        const mapAddressToAmount = new Map<string, bigint>();
        const mapAddressToMintBaton = new Map<string, boolean>();

        for (const utxo of utxos) {
          // Determine token amount field: prefer atoms if available, fallback to amount/value
          const token = utxo.token;
          if (!token) continue;

          let rawAmount: bigint = BigInt(0);
          if (typeof (token as any).atoms !== "undefined") {
            // chronik-client >=2.x
            try {
              rawAmount = BigInt((token as any).atoms);
            } catch {
              rawAmount = BigInt(0);
            }
          } else if (typeof (token as any).amount !== "undefined") {
            // Some chronik responses use amount
            try {
              rawAmount = BigInt((token as any).amount);
            } catch {
              rawAmount = BigInt(0);
            }
          } else if (typeof (token as any).value !== "undefined") {
            // Very old clients may use value
            try {
              rawAmount = BigInt((token as any).value);
            } catch {
              rawAmount = BigInt(0);
            }
          }

          if (rawAmount === BigInt(0)) continue;

          // Convert script to ecash address
          let address = "unknown";
          try {
            const { type, hash } = getTypeAndHashFromOutputScript(utxo.script);
            address = encodeCashAddress("ecash", type, hash);
          } catch (e) {
            // ignore malformed script
            continue;
          }

          // Mark mint baton holder
          try {
            if (typeof (token as any).isMintBaton !== "undefined" && (token as any).isMintBaton) {
              mapAddressToMintBaton.set(address, true);
            }
          } catch {}

          const prev = mapAddressToAmount.get(address) || BigInt(0);
          mapAddressToAmount.set(address, prev + rawAmount);
        }

        if (isCancelled) return;
        const nextRows: AddressRow[] = Array.from(mapAddressToAmount.entries()).map(([address, rawAmount]) => ({
          address,
          rawAmount,
          hasMintBaton: mapAddressToMintBaton.get(address) === true,
        }));
        setRows(nextRows);
      } catch (e: any) {
        if (!isCancelled) setError(e?.message || "Failed to load address distribution");
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }
    load();
    const id = setInterval(load, 30000);
    return () => {
      isCancelled = true;
      clearInterval(id);
    };
  }, [tokenId]);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (a.rawAmount === b.rawAmount) return 0;
      if (sortDesc) return a.rawAmount < b.rawAmount ? 1 : -1;
      return a.rawAmount < b.rawAmount ? -1 : 1;
    });
    return copy;
  }, [rows, sortDesc]);

  const totalRaw = useMemo(() => rows.reduce((acc, r) => acc + r.rawAmount, BigInt(0)), [rows]);
  const totalFormatted = useMemo(() => {
    return formatAmount(totalRaw, decimals);
  }, [totalRaw, decimals]);

  // Simple Decentralization Index: 1 - sum(p_i^2), where p_i is share per address
  const decentralizationIndex = useMemo(() => {
    if (rows.length === 0 || totalRaw === BigInt(0)) return 0;
    let sumSquares = 0;
    for (const r of rows) {
      const p = Number(r.rawAmount) / Number(totalRaw);
      sumSquares += p * p;
    }
    const hhi = sumSquares; // Herfindahl–Hirschman Index on shares
    const di = 1 - hhi;
    return Math.max(0, Math.min(1, di));
  }, [rows, totalRaw]);

  return (
    <Card className={`rounded-3xl ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-medium">Address</CardTitle>
        <button className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setSortDesc(!sortDesc)}>
          {sortDesc ? "Sort ↑" : "Sort ↓"}
        </button>
      </CardHeader>
      <CardContent>
        {isLoading && <div className="text-sm text-muted-foreground">Loading...</div>}
        {error && <div className="text-sm text-red-500">{error}</div>}
        {!isLoading && !error && (
          <>
            <div className="text-sm mb-2 text-muted-foreground flex items-center justify-between">
              <span>Total: {totalFormatted}</span>
              <span>Decentralization: {(decentralizationIndex * 100).toFixed(2)}%</span>
            </div>
            <div className="max-h-[420px] overflow-auto">
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
                    const pct = totalRaw === 0n ? 0 : (Number(r.rawAmount) / Number(totalRaw)) * 100;
                    const barWidth = Math.max(2, Math.min(100, pct));
                    const SPECIAL_GNC_ADDRESS = "ecash:qqmjmlhuyx2thyz6tk6s2thn8gtuwu6dsgup8hn5pf";
                    let displayAddress = r.address;
                    if (displayAddress === SPECIAL_GNC_ADDRESS) {
                      displayAddress = `${displayAddress} (GNC)`;
                    }
                    if (r.hasMintBaton) {
                      displayAddress = `${displayAddress} (mint address)`;
                    }
                    return (
                      <TableRow key={r.address}>
                        <TableCell className="font-mono text-xs break-all">{displayAddress}</TableCell>
                        <TableCell className="text-right relative">
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 rounded bg-white/10" style={{ width: `${barWidth}%` }} />
                          <span className="relative z-10">{formatAmount(r.rawAmount, decimals)}</span>
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
  );
}
