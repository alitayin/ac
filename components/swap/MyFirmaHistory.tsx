"use client"

import * as React from "react"
import { ExternalLink, Loader2, RefreshCw } from "lucide-react"

import { fetchAgoraTransactionsFromChronik } from "@/lib/chronik-transactions"
import { fetchBlockchainInfo } from "@/lib/chronik"
import { watchAgoraTokens } from "@/lib/agora-ws"
import { formatNumber, formatPrice } from "@/lib/formatters"
import { formatTime, getRelativeTime } from "@/lib/time-utils"
import type { Transaction } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export interface MyFirmaHistoryProps {
  /** Firma token id used by Chronik and the Agora websocket. */
  tokenId: string
  /** The connected eCash address. History is intentionally scoped to this address. */
  address?: string
  className?: string
}

const HISTORY_LIMIT = 50
// XEC's six-blocks-per-hour estimate gives a bounded 72-hour window.
// Keeping the cutoff at the raw Chronik block level prevents sparse token
// histories from paging through the entire chain just to find recent trades.
export const FIRMA_HISTORY_MAX_BLOCKS = 6 * 24 * 3

const normalizeAddress = (address?: string): string | null => {
  const normalized = address?.trim().toLowerCase()
  return normalized ? normalized : null
}

type TradeSide = "buy" | "sell"

const getTradeSide = (
  transaction: Transaction,
  address: string,
): TradeSide | null => {
  if (transaction.buyerAddress?.trim().toLowerCase() === address) {
    return "buy"
  }

  if (transaction.sellerAddress?.trim().toLowerCase() === address) {
    return "sell"
  }

  return null
}

const transactionLink = (txid: string): string =>
  `https://explorer.e.cash/tx/${encodeURIComponent(txid)}`

/**
 * A deliberately small, wallet-scoped history for the Firma/XEC workspace.
 *
 * `fetchAgoraTransactionsFromChronik` performs the address filtering at the
 * Chronik parsing boundary. The second filter here protects the component if
 * a stale or mocked response contains a transaction for another wallet side.
 */
export default function MyFirmaHistory({
  tokenId,
  address,
  className,
}: MyFirmaHistoryProps) {
  const normalizedAddress = React.useMemo(() => normalizeAddress(address), [address])
  const [transactions, setTransactions] = React.useState<Transaction[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = React.useState<number | null>(null)
  const requestIdRef = React.useRef(0)
  const abortControllerRef = React.useRef<AbortController | null>(null)

  const fetchHistory = React.useCallback(async () => {
    const requestId = ++requestIdRef.current
    abortControllerRef.current?.abort()

    if (!tokenId || !normalizedAddress) {
      abortControllerRef.current = null
      setTransactions([])
      setError(null)
      setIsLoading(false)
      setLastUpdated(null)
      return
    }

    const abortController = new AbortController()
    abortControllerRef.current = abortController
    setIsLoading(true)
    setError(null)

    const isCurrentRequest = () =>
      requestIdRef.current === requestId && !abortController.signal.aborted

    try {
      let stopBelowHeight: number | undefined
      try {
        const blockchainInfo = await fetchBlockchainInfo()
        if (blockchainInfo.tipHeight > 0) {
          stopBelowHeight = Math.max(
            blockchainInfo.tipHeight - FIRMA_HISTORY_MAX_BLOCKS,
            0,
          )
        }
      } catch (_error) {
        // The relative maxBlocksBack guard below still bounds the request.
      }

      if (!isCurrentRequest()) return

      const collected: Transaction[] = []
      const applyBatch = (batch: Transaction[]) => {
        if (!isCurrentRequest()) return

        const ownedBatch = batch.filter(
          (transaction) => getTradeSide(transaction, normalizedAddress) !== null,
        )
        if (ownedBatch.length === 0) return

        const next = [...collected, ...ownedBatch]
        next.sort((a, b) => b.timestamp - a.timestamp)
        collected.splice(0, collected.length, ...next.slice(0, HISTORY_LIMIT))
        setTransactions([...collected])
      }

      const result = await fetchAgoraTransactionsFromChronik(
        tokenId,
        applyBatch,
        {
          address: normalizedAddress,
          addressRole: "either",
          pageSize: 100,
          targetCount: HISTORY_LIMIT,
          maxBlocksBack: FIRMA_HISTORY_MAX_BLOCKS,
          stopBelowHeight,
          failOnError: true,
          signal: abortController.signal,
        },
      )

      if (!isCurrentRequest()) return

      const ownedTransactions = result
        .filter(
          (transaction) => getTradeSide(transaction, normalizedAddress) !== null,
        )
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, HISTORY_LIMIT)

      setTransactions(ownedTransactions)
      setLastUpdated(Date.now())
    } catch (fetchError) {
      if (!isCurrentRequest()) return
      if (fetchError instanceof Error && fetchError.name === "AbortError") return

      setTransactions([])
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load Firma/XEC history.",
      )
    } finally {
      if (requestIdRef.current === requestId) {
        abortControllerRef.current = null
        setIsLoading(false)
      }
    }
  }, [normalizedAddress, tokenId])

  React.useEffect(() => {
    void fetchHistory()

    if (!tokenId || !normalizedAddress) {
      return undefined
    }

    const unwatch = watchAgoraTokens([tokenId], () => {
      void fetchHistory()
    })

    return () => {
      unwatch()
      abortControllerRef.current?.abort()
      requestIdRef.current += 1
    }
  }, [fetchHistory, normalizedAddress, tokenId])

  React.useEffect(
    () => () => {
      abortControllerRef.current?.abort()
    },
    [],
  )

  const renderContent = () => {
    if (!normalizedAddress) {
      return (
        <p className="px-6 py-8 text-center text-sm text-muted-foreground">
          Connect a wallet to view your Firma/XEC history.
        </p>
      )
    }

    if (isLoading && transactions.length === 0) {
      return (
        <div className="flex items-center justify-center gap-2 px-6 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          <span>Loading history...</span>
        </div>
      )
    }

    if (error && transactions.length === 0) {
      return (
        <div className="space-y-2 px-6 py-7 text-center">
          <p className="text-sm text-destructive">Unable to load history.</p>
          <button
            type="button"
            onClick={() => void fetchHistory()}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Retry
          </button>
        </div>
      )
    }

    if (transactions.length === 0) {
      return (
        <p className="px-6 py-8 text-center text-sm text-muted-foreground">
          No Firma trades found.
        </p>
      )
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-sm">
          <thead className="border-b text-sm text-muted-foreground">
            <tr>
              <th className="w-[20%] px-6 py-2 text-left font-medium">Type</th>
              <th className="w-[26%] px-1 py-2 text-left font-medium">Time</th>
              <th className="w-[27%] px-1 py-2 text-right font-medium">Price</th>
              <th className="w-[27%] px-6 py-2 text-right font-medium">Firma</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => {
              const side = getTradeSide(transaction, normalizedAddress)
              if (!side) return null

              return (
                <tr
                  key={`${transaction.txid}-${transaction.timestamp}`}
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="px-6 py-2 text-left">
                    <span
                      className={cn(
                        "font-medium",
                        side === "buy" ? "text-emerald-500" : "text-amber-500",
                      )}
                    >
                      {side === "buy" ? "Buy" : "Sell"}
                    </span>
                  </td>
                  <td
                    className="truncate px-1 py-2 text-left text-muted-foreground"
                    title={formatTime(transaction.timestamp)}
                  >
                    {getRelativeTime(transaction.timestamp)}
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-1 py-2 text-right font-mono",
                      side === "buy" ? "text-emerald-500" : "text-amber-500",
                    )}
                  >
                    {formatPrice(transaction.price)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-2 text-right font-mono">
                    {formatNumber(transaction.amount)}
                    <a
                      href={transactionLink(transaction.txid)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`View transaction ${transaction.txid}`}
                      className="ml-1 inline-flex align-middle text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <Card
      className={cn(
        "rounded-3xl",
        className,
      )}
      aria-label="My Firma/XEC history"
    >
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="min-w-0">
          <CardTitle className="truncate text-lg font-medium">
            My Firma/XEC history
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Last 72 hours
            {lastUpdated !== null && !error
              ? ` · Updated ${new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : ""}
          </p>
        </div>
        {normalizedAddress && (
          <button
            type="button"
            onClick={() => void fetchHistory()}
            disabled={isLoading}
            aria-label="Refresh Firma/XEC history"
            title="Refresh history"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} aria-hidden="true" />
          </button>
        )}
      </CardHeader>
      <CardContent className="pt-0">{renderContent()}</CardContent>
    </Card>
  )
}
