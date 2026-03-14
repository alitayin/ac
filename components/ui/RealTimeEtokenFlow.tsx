"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { chronik, fetchTokenDetails, getTokenDecimalsFromDetails } from "@/lib/chronik"
import { detectAgoraTokenId } from "@/lib/chronik-transactions"
import { WsMsgClient } from "chronik-client"
import { formatNumber } from "@/lib/formatters"
import { Activity, BadgeCheck } from "lucide-react"

type FlowToken = {
  tokenId: string
  ticker: string
  name: string
  amount: string
}

type FlowItem = {
  txid: string
  time: string
  blockHeight: number | null
  tokens: FlowToken[]
  isAgora: boolean
}

const MAX_ITEMS = 20
const CHRONIK_WS_RETRY_MS = 5000

const formatTxid = (txid: string) => {
  if (txid.length <= 12) return txid
  return `${txid.slice(0, 8)}...${txid.slice(-4)}`
}

export default function RealTimeEtokenFlow() {
  const [connected, setConnected] = React.useState(false)
  const [wsError, setWsError] = React.useState<string | null>(null)
  const [items, setItems] = React.useState<FlowItem[]>([])
  const [connecting, setConnecting] = React.useState(true)

  const tokenMetaCache = React.useRef<Map<string, any>>(new Map())
  const seenTxs = React.useRef<Set<string>>(new Set())
  const queueRef = React.useRef<string[]>([])
  const processingRef = React.useRef(false)
  const cancelledRef = React.useRef(false)

  const fetchTokenMeta = React.useCallback(async (tokenId: string) => {
    if (tokenMetaCache.current.has(tokenId)) {
      return tokenMetaCache.current.get(tokenId)
    }
    try {
      const meta = await fetchTokenDetails(tokenId)
      tokenMetaCache.current.set(tokenId, meta)
      return meta
    } catch {
      return null
    }
  }, [])

  const handleTx = React.useCallback(async (txid: string) => {
    if (seenTxs.current.has(txid)) return
    seenTxs.current.add(txid)

    try {
      const tx = await chronik.tx(txid)
      if (!tx) return

      const tokenMap = new Map<
        string,
        { tokenId: string; atoms: bigint; decimals: number; ticker: string; name: string }
      >()

      const outputs = tx.outputs || []
      for (const out of outputs) {
        const token = (out as any).token
        if (!token || !token.tokenId) continue

        const tokenId = token.tokenId as string
        try {
          const atoms = BigInt(
            typeof token.atoms !== "undefined"
              ? token.atoms
              : typeof token.amount !== "undefined"
              ? token.amount
              : 0,
          )
          const meta = await fetchTokenMeta(tokenId)
          const decimals = getTokenDecimalsFromDetails(meta, 0)
          const ticker = meta?.genesisInfo?.tokenTicker || tokenId.slice(0, 6).toUpperCase()
          const name = meta?.genesisInfo?.tokenName || tokenId.slice(0, 6)

          if (tokenMap.has(tokenId)) {
            const prev = tokenMap.get(tokenId)!
            tokenMap.set(tokenId, { ...prev, atoms: prev.atoms + atoms })
          } else {
            tokenMap.set(tokenId, { tokenId, atoms, decimals, ticker, name })
          }
        } catch {
          continue
        }
      }

      if (tokenMap.size === 0) return

      const isAgora = !!detectAgoraTokenId(tx)

      const tokens: FlowToken[] = Array.from(tokenMap.values()).map((entry) => {
        const precision = Math.min(entry.decimals, 8)
        const amountNumber = Number(entry.atoms) / Math.pow(10, entry.decimals || 0)
        const amountFormatted =
          entry.decimals > 0 ? amountNumber.toFixed(precision) : formatNumber(amountNumber, true)
        return {
          tokenId: entry.tokenId,
          ticker: entry.ticker || entry.tokenId.slice(0, 6).toUpperCase(),
          name: entry.name,
          amount: amountFormatted,
        }
      })

      const time =
        typeof tx.timeFirstSeen === "number"
          ? new Date(tx.timeFirstSeen * 1000).toISOString()
          : new Date().toISOString()

      setItems((prev) => {
        const next = [
          { txid, time, blockHeight: tx.block?.height ?? null, tokens, isAgora },
          ...prev,
        ]
        return next.slice(0, MAX_ITEMS)
      })
    } catch {
      return
    }
  }, [fetchTokenMeta])

  const processQueue = React.useCallback(async () => {
    if (processingRef.current) return
    processingRef.current = true

    while (queueRef.current.length > 0 && !cancelledRef.current) {
      const txid = queueRef.current.shift()
      if (txid) {
        await handleTx(txid)
      }
    }

    processingRef.current = false
  }, [handleTx])

  const enqueueTx = React.useCallback(
    (txid: string) => {
      queueRef.current.push(txid)
      void processQueue()
    },
    [processQueue],
  )

  React.useEffect(() => {
    let ws: ReturnType<typeof chronik.ws> | null = null
    cancelledRef.current = false

    const connect = async () => {
      setConnecting(true)
      setWsError(null)
      try {
        ws = chronik.ws({
          onConnect: () => {
            setConnected(true)
            setConnecting(false)
          },
          onReconnect: () => {
            setConnected(false)
            setConnecting(true)
          },
          onError: () => {
            setConnected(false)
            setWsError("WebSocket error, retrying...")
          },
          onMessage: (msg: WsMsgClient) => {
            if (msg.type === "Tx" && msg.msgType === "TX_ADDED_TO_MEMPOOL" && msg.txid) {
              enqueueTx(msg.txid)
            }
          },
        })

        await ws.waitForOpen()
        ws.subscribeToTxs()
        setConnected(true)
        setConnecting(false)
      } catch {
        setWsError("Can't connect to Chronik WebSocket, please try again later")
        setConnected(false)
        setConnecting(false)

        setTimeout(() => {
          if (!cancelledRef.current) {
            connect()
          }
        }, CHRONIK_WS_RETRY_MS)
      }
    }

    connect()

    return () => {
      cancelledRef.current = true
      try {
        ws?.close()
      } catch {
        return
      }
    }
  }, [enqueueTx])

  return (
    <Card className="relative overflow-hidden">
      <style>
        {`
          @keyframes fadeInFlowRow {
            from { opacity: 0; transform: translateY(4px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .flow-fade-in {
            animation: fadeInFlowRow 240ms ease-out;
          }
        `}
      </style>
      <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg">Real-time eToken Flow</CardTitle>
          <CardDescription>Realtime eToken activity on eCash network</CardDescription>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`h-2 w-2 rounded-full ${
              connected ? "bg-green-500" : connecting ? "bg-amber-500" : "bg-red-500"
            }`}
          />
          <span className="text-muted-foreground">
            {connected ? "Connected" : connecting ? "Connecting..." : "Disconnected"}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {wsError && (
          <div className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {wsError}
          </div>
        )}
        <div className="max-h-[560px] h-[560px] space-y-2 overflow-y-auto pr-1">
          {items.length === 0 && (
            <div className="text-sm text-muted-foreground">Waitng for etokens transcation...</div>
          )}
          {items.map((item) => (
            <div
              key={item.txid}
              className="flow-fade-in rounded-lg border bg-card/60 p-3 shadow-sm transition-colors hover:bg-accent/40 cursor-pointer"
              onClick={() => window.open(`https://explorer.e.cash/tx/${item.txid}`, "_blank")}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-sm text-primary">{formatTxid(item.txid)}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.time).toLocaleTimeString()}
                  </span>
                  {item.isAgora && (
                    <Badge variant="outline" className="text-xs inline-flex items-center gap-1">
                      <BadgeCheck className="h-3 w-3" />
                      Agora Sold
                    </Badge>
                  )}
                  {item.blockHeight !== null && (
                    <Badge variant="outline" className="text-xs">
                      #{item.blockHeight}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.tokens.map((token) => (
                    <Badge
                      key={`${item.txid}-${token.tokenId}`}
                      variant="outline"
                      className="flex items-center gap-1 text-xs"
                    >
                      <span className="font-semibold">{token.ticker}</span>
                      <span className="text-muted-foreground">{token.amount}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {`(${token.tokenId.slice(0, 2)}...${token.tokenId.slice(-4)})`}
                      </span>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

