"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { encodeCashAddress } from "ecashaddrjs"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { cn } from "@/lib/utils"
import {
  fetchBlockchainInfo,
  chronik,
  fetchTokenDetails,
  getTokenAmountFromToken,
} from "@/lib/chronik"

// Ad constants
export const AD_ADDRESS = "ecash:qrjys4vegetqdcxehwrekttkklfafzea8cw3eh5tpx"
export const AD_TRIGGER_TOKEN_ID =
  "d1131675cb62b65909fb45ba53b022da0bd0f34aaa71fc61770115472b186ffb"
export const AD_TRIGGER_AMOUNT = 300_000n
// Ads v2: starting from this block, ads rotate every 1 day (144 blocks/day on eCash).
export const AD_START_BLOCK = 927_773
export const AD_BLOCKS_PER_DAY = 144
export const AD_SLOT_BLOCKS = AD_BLOCKS_PER_DAY * 1
const AD_QUEUE_CACHE_KEY = "agora_ad_queue_v2"
const AD_QUEUE_CACHE_TTL_MS = 2 * 60 * 1000

export type AdStatus = "loading" | "ready" | "empty" | "error"

const hexToBytes = (hex: string): Uint8Array => {
  const clean = (hex || "").toLowerCase().replace(/^0x/, "")
  if (!clean || clean.length % 2 !== 0) return new Uint8Array()
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16)
  }
  return out
}

const outputScriptToEcashAddress = (outputScriptHex: string): string | null => {
  const hex = (outputScriptHex || "").toLowerCase()
  const p2pkh = hex.match(/^76a914([0-9a-f]{40})88ac$/)
  if (p2pkh) {
    const hash = hexToBytes(p2pkh[1])
    return encodeCashAddress("ecash", "p2pkh", hash)
  }
  const p2sh = hex.match(/^a914([0-9a-f]{40})87$/)
  if (p2sh) {
    const hash = hexToBytes(p2sh[1])
    return encodeCashAddress("ecash", "p2sh", hash)
  }
  return null
}

const getChronikTokenId = (token: any): string | null => {
  if (!token) return null
  return token.tokenId || token.tokenIdHex || token.tokenIdStr || null
}

const getChronikTxId = (tx: any): string | null => {
  return tx?.txid || tx?.hash || tx?.txidStr || null
}

const getChronikBlockHeight = (tx: any): number | null => {
  const direct = tx?.blockHeight
  if (typeof direct === "number") return direct
  const nested = tx?.block?.height
  if (typeof nested === "number") return nested
  return null
}

const getFirstInputAddress = (
  tx: any,
  exclude: Set<string> = new Set(),
): string | null => {
  const inputs: any[] = Array.isArray(tx?.inputs) ? tx.inputs : []
  for (const input of inputs) {
    const scriptHex = input?.outputScript || input?.prevOut?.outputScript
    if (!scriptHex) continue
    const inAddr = outputScriptToEcashAddress(scriptHex)
    if (!inAddr) continue
    if (exclude.has(inAddr)) continue
    return inAddr
  }
  return null
}

const fetchAddressHistorySince = async (
  address: string,
  minBlockHeight: number,
  options?: { pageSize?: number; maxPages?: number },
): Promise<any[]> => {
  const pageSize = options?.pageSize ?? 200
  const maxPages = options?.maxPages ?? 25
  const all: any[] = []

  for (let page = 0; page < maxPages; page++) {
    const history = await (chronik.address(address) as any).history(page, pageSize)
    const txs: any[] = history?.txs || []
    if (txs.length === 0) break
    all.push(...txs)

    // History is typically newest -> oldest. Stop once we have crossed below minBlockHeight.
    const confirmedHeights = txs
      .map((tx) => getChronikBlockHeight(tx))
      .filter((h): h is number => typeof h === "number")
    if (confirmedHeights.length > 0) {
      const minHeightInPage = Math.min(...confirmedHeights)
      if (minHeightInPage < minBlockHeight) break
    }

    if (txs.length < pageSize) break
  }

  // Keep only confirmed txs from the window and sort oldest -> newest for deterministic ordering.
  return all
    .filter((tx) => {
      const h = getChronikBlockHeight(tx)
      return typeof h === "number" && h >= minBlockHeight
    })
    .sort((a, b) => {
      const ha = getChronikBlockHeight(a) ?? 0
      const hb = getChronikBlockHeight(b) ?? 0
      if (ha !== hb) return ha - hb
      const ta = a?.block?.timestamp ?? a?.timeFirstSeen ?? 0
      const tb = b?.block?.timestamp ?? b?.timeFirstSeen ?? 0
      if (ta !== tb) return ta - tb
      const ida = getChronikTxId(a) || ""
      const idb = getChronikTxId(b) || ""
      return ida.localeCompare(idb)
    })
}

type AdQueueBuildResult = {
  queue: Array<string | null>
}

const buildAdQueueFromAdAddressHistory = (adTxs: any[]): AdQueueBuildResult => {
  type PaymentEvent = {
    payer: string
    height: number
    txid: string
    slotCount: number
    deadlineHeight: number
  }

  type TokenSubmission = {
    height: number
    txid: string
    tokenId: string
  }

  const submissionsBySender = new Map<string, TokenSubmission[]>()

  // Pass 1: collect token submissions to AD_ADDRESS (any token except trigger token).
  for (const tx of adTxs) {
    const height = getChronikBlockHeight(tx)
    const txid = getChronikTxId(tx)
    if (typeof height !== "number" || !txid) continue

    const sender = getFirstInputAddress(tx, new Set([AD_ADDRESS]))
    if (!sender) continue

    const outputs: any[] = Array.isArray(tx?.outputs) ? tx.outputs : []
    for (const out of outputs) {
      const outAddr = outputScriptToEcashAddress(out?.outputScript || "")
      if (outAddr !== AD_ADDRESS) continue
      const tokenId = getChronikTokenId(out?.token)
      if (!tokenId) continue
      if (tokenId === AD_TRIGGER_TOKEN_ID) continue

      const list = submissionsBySender.get(sender) || []
      list.push({ height, txid, tokenId })
      submissionsBySender.set(sender, list)
    }
  }

  // Ensure deterministic order per sender.
  for (const [sender, list] of submissionsBySender.entries()) {
    list.sort((a, b) => {
      if (a.height !== b.height) return a.height - b.height
      return a.txid.localeCompare(b.txid)
    })
    submissionsBySender.set(sender, list)
  }

// Pass 2: collect payment events (>= 300,000 trigger token sent to AD_ADDRESS).
  const payments: PaymentEvent[] = []
  for (const tx of adTxs) {
    const height = getChronikBlockHeight(tx)
    const txid = getChronikTxId(tx)
    if (typeof height !== "number" || !txid) continue

    const outputs: any[] = Array.isArray(tx?.outputs) ? tx.outputs : []

    let paidAtoms = 0n
    for (const out of outputs) {
      const outAddr = outputScriptToEcashAddress(out?.outputScript || "")
      if (outAddr !== AD_ADDRESS) continue
      const tokenId = getChronikTokenId(out?.token)
      if (tokenId !== AD_TRIGGER_TOKEN_ID) continue
      const amount = getTokenAmountFromToken(out?.token)
      if (amount > 0n) paidAtoms += amount
    }

    if (paidAtoms < AD_TRIGGER_AMOUNT) continue

    const payer = getFirstInputAddress(tx, new Set([AD_ADDRESS]))
    if (!payer) continue

    const rawSlots = paidAtoms / AD_TRIGGER_AMOUNT
    const slotCount = Number(rawSlots > 10_000n ? 10_000n : rawSlots)
    if (!Number.isFinite(slotCount) || slotCount <= 0) continue

    payments.push({
      payer,
      height,
      txid,
      slotCount,
      deadlineHeight: height + AD_SLOT_BLOCKS,
    })
  }

  // Payments are already ordered by height (adTxs is sorted), but keep it explicit.
  payments.sort((a, b) => {
    if (a.height !== b.height) return a.height - b.height
    return a.txid.localeCompare(b.txid)
  })

  // Build the global queue: one entry per 1-day slot.
  const queue: Array<string | null> = []

  for (const payment of payments) {
    const submissions = submissionsBySender.get(payment.payer) || []
    const usable = submissions
      .filter(
        (s) =>
          s.height >= payment.height && s.height <= payment.deadlineHeight,
      )
      .sort((a, b) => {
        if (a.height !== b.height) return a.height - b.height
        return a.txid.localeCompare(b.txid)
      })

    // Unique tokenIds in order of appearance within the allowed window.
    const tokenIds: string[] = []
    const seen = new Set<string>()
    for (const s of usable) {
      if (seen.has(s.tokenId)) continue
      seen.add(s.tokenId)
      tokenIds.push(s.tokenId)
    }

    if (tokenIds.length === 0) {
      for (let i = 0; i < payment.slotCount; i++) queue.push(null)
      continue
    }

    for (let i = 0; i < payment.slotCount; i++) {
      if (i < tokenIds.length) {
        queue.push(tokenIds[i])
      } else {
        // Not enough tokens provided: repeat the last provided token to fill remaining slots.
        queue.push(tokenIds[tokenIds.length - 1])
      }
    }
  }

  return { queue }
}

const findAdSponsoredTokenIdLegacy = async (): Promise<string | null> => {
  // 1) Find a sender that transferred exactly 300,000 of AD_TRIGGER_TOKEN_ID to AD_ADDRESS.
  const adHistory = await (chronik.address(AD_ADDRESS) as any).history(0, 200)
  const adTxs: any[] = adHistory?.txs || []

  let senderAddress: string | null = null

  for (const tx of adTxs) {
    const outputs: any[] = Array.isArray(tx?.outputs) ? tx.outputs : []
    const inputs: any[] = Array.isArray(tx?.inputs) ? tx.inputs : []

    const hasQualifyingPayment = outputs.some((out) => {
      const token = out?.token
      const tokenId = getChronikTokenId(token)
      if (tokenId !== AD_TRIGGER_TOKEN_ID) return false
      const amount = getTokenAmountFromToken(token)
      if (amount !== AD_TRIGGER_AMOUNT) return false
      const outAddr = outputScriptToEcashAddress(out?.outputScript || "")
      return outAddr === AD_ADDRESS
    })

    if (!hasQualifyingPayment) continue

    // Pick the first decodable input address as sender.
    for (const input of inputs) {
      const scriptHex = input?.outputScript || input?.prevOut?.outputScript
      if (!scriptHex) continue
      const inAddr = outputScriptToEcashAddress(scriptHex)
      if (!inAddr) continue
      if (inAddr === AD_ADDRESS) continue
      senderAddress = inAddr
      break
    }

    if (senderAddress) break
  }

  if (!senderAddress) return null

  // 2) From sender outgoing txs, find the first token (by history order) that is NOT AD_TRIGGER_TOKEN_ID.
  const senderHistory = await (chronik.address(senderAddress) as any).history(0, 200)
  const senderTxs: any[] = senderHistory?.txs || []

  for (const tx of senderTxs) {
    const inputs: any[] = Array.isArray(tx?.inputs) ? tx.inputs : []
    const outputs: any[] = Array.isArray(tx?.outputs) ? tx.outputs : []

    const isOutgoing = inputs.some((input) => {
      const scriptHex = input?.outputScript || input?.prevOut?.outputScript
      if (!scriptHex) return false
      const inAddr = outputScriptToEcashAddress(scriptHex)
      return inAddr === senderAddress
    })
    if (!isOutgoing) continue

    for (const out of outputs) {
      const token = out?.token
      const tokenId = getChronikTokenId(token)
      if (!tokenId) continue
      if (tokenId === AD_TRIGGER_TOKEN_ID) continue
      return tokenId
    }
  }

  return null
}

export const fetchAdQueueV2 = async (): Promise<{
  queue: Array<string | null>
  tipHeight: number | null
  slotIndex: number | null
}> => {
  const info = await fetchBlockchainInfo()
  const tipHeight = typeof info?.tipHeight === "number" ? info.tipHeight : null
  if (typeof tipHeight !== "number") {
    return { queue: [], tipHeight: null, slotIndex: null }
  }

  if (tipHeight < AD_START_BLOCK) {
    const legacy = await findAdSponsoredTokenIdLegacy()
    return {
      queue: legacy ? [legacy] : [null],
      tipHeight,
      slotIndex: 0,
    }
  }

  // Cache to avoid fetching/parsing large history too frequently.
  try {
    const cachedRaw = sessionStorage.getItem(AD_QUEUE_CACHE_KEY)
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw) as {
        computedAt?: number
        tipHeight?: number
        queue?: Array<string | null>
      }
      if (
        cached &&
        typeof cached.computedAt === "number" &&
        Date.now() - cached.computedAt < AD_QUEUE_CACHE_TTL_MS &&
        Array.isArray(cached.queue)
      ) {
        const slotIndex = Math.floor(
          (tipHeight - AD_START_BLOCK) / AD_SLOT_BLOCKS,
        )
        return { queue: cached.queue, tipHeight, slotIndex }
      }
    }
  } catch (_e) {}

  const adTxs = await fetchAddressHistorySince(AD_ADDRESS, AD_START_BLOCK, {
    pageSize: 200,
    maxPages: 200,
  })
  const { queue } = buildAdQueueFromAdAddressHistory(adTxs)

  try {
    sessionStorage.setItem(
      AD_QUEUE_CACHE_KEY,
      JSON.stringify({ computedAt: Date.now(), tipHeight, queue }),
    )
  } catch (_e) {}

  const slotIndex = Math.floor((tipHeight - AD_START_BLOCK) / AD_SLOT_BLOCKS)
  return { queue, tipHeight, slotIndex }
}

export const findCurrentAdSponsoredTokenIdV2 = async (): Promise<{
  tokenId: string | null
  tipHeight: number | null
}> => {
  const { queue, tipHeight, slotIndex } = await fetchAdQueueV2()
  if (typeof tipHeight !== "number" || typeof slotIndex !== "number") {
    return { tokenId: null, tipHeight }
  }
  const tokenId = slotIndex >= 0 ? queue[slotIndex] ?? null : null
  return { tokenId, tipHeight }
}

export const AdScheduleView = () => {
  const router = useRouter()
  const ITEMS_PER_PAGE = 10
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [tipHeight, setTipHeight] = React.useState<number | null>(null)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rows, setRows] = React.useState<
    Array<{
      slotIndex: number
      startHeight: number
      endHeight: number
      estDateLabel: string
      tokenId: string | null
      tokenName: string
      tokenTicker: string
    }>
  >([])

  React.useEffect(() => {
    let cancelled = false
    const run = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const { queue, tipHeight, slotIndex } = await fetchAdQueueV2()
        if (cancelled) return
        setTipHeight(typeof tipHeight === "number" ? tipHeight : null)

        const currentSlot =
          typeof slotIndex === "number" ? slotIndex : Math.max(0, queue.length - 1)
        const startFrom = currentSlot + 1 // future slots only
        const count = 8 * 7

        const upcoming = Array.from({ length: count }, (_, i) => startFrom + i)
        const now = Date.now()
        const baseTip = typeof tipHeight === "number" ? tipHeight : null
        const dateFmt = new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
        })

        const result: Array<{
          slotIndex: number
          startHeight: number
          endHeight: number
          estDateLabel: string
          tokenId: string | null
          tokenName: string
          tokenTicker: string
        }> = []

        for (let i = 0; i < upcoming.length; i++) {
          const idx = upcoming[i]
          const startHeight = AD_START_BLOCK + idx * AD_SLOT_BLOCKS
          const endHeight = startHeight + AD_SLOT_BLOCKS - 1

          // Estimated calendar date based on current tip height and current local time.
          // We assume ~144 blocks per day and do a linear estimate; this is for UI only.
          const deltaBlocks =
            typeof baseTip === "number" ? Math.max(0, startHeight - baseTip) : i * AD_SLOT_BLOCKS
          // Use ceil() so the next slot is labeled as the next calendar day even if it's < 144 blocks away.
          const deltaDays = Math.ceil(deltaBlocks / AD_BLOCKS_PER_DAY)
          const estMs = now + deltaDays * 24 * 60 * 60 * 1000
          const estDateLabel = dateFmt.format(new Date(estMs))

          const tokenId = idx >= 0 ? queue[idx] ?? null : null
          let tokenName = tokenId ? tokenId.substring(0, 6) : "Empty"
          let tokenTicker = ""

          if (tokenId) {
            try {
              const details = await fetchTokenDetails(tokenId)
              if (cancelled) return
              tokenName =
                details?.genesisInfo?.tokenName || tokenId.substring(0, 6)
              tokenTicker = details?.genesisInfo?.tokenTicker || ""
            } catch (_e) {
              tokenName = tokenId.substring(0, 6)
              tokenTicker = ""
            }
          }

          result.push({
            slotIndex: idx,
            startHeight,
            endHeight,
            estDateLabel,
            tokenId,
            tokenName,
            tokenTicker,
          })
        }

        if (cancelled) return
        setRows(result)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Failed to load schedule")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Loading ad schedule...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Failed to load: {error}</div>
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / ITEMS_PER_PAGE))
  const paginatedRows = rows.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  )
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE + 1
  const endIdx = Math.min(currentPage * ITEMS_PER_PAGE, rows.length)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-3">
        <div className="text-sm text-muted-foreground">
          Next 8 weeks ad schedule
          {typeof tipHeight === "number" ? (
            <span className="ml-2">(tip #{tipHeight.toLocaleString()})</span>
          ) : null}
        </div>
        <div className="text-sm text-muted-foreground">
          Showing {startIdx}-{endIdx} / {rows.length}
        </div>
      </div>

      <div className="space-y-2 px-3 pb-2">
        {paginatedRows.map((r) => (
          <div
            key={r.slotIndex}
            className={cn(
              "flex items-center gap-3 p-3 border rounded-lg transition-colors",
              r.tokenId ? "cursor-pointer hover:bg-accent/50" : "opacity-80",
            )}
            onClick={() => {
              if (!r.tokenId) return
              router.push(`/${r.tokenId}`)
            }}
          >
            <div className="w-16 flex-shrink-0 text-xs font-medium text-muted-foreground">
              {r.estDateLabel}
            </div>

            <Avatar className="h-6 w-6 flex-shrink-0">
              {r.tokenId ? (
                <AvatarImage
                  src={`https://icons.etokens.cash/32/${r.tokenId}.png`}
                  alt={r.tokenName}
                />
              ) : null}
              <AvatarFallback className="text-[10px]">
                {r.tokenTicker
                  ? r.tokenTicker.substring(0, 2)
                  : r.tokenName.substring(0, 2)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">
                {r.tokenName}
                {r.tokenTicker ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {r.tokenTicker}
                  </span>
                ) : null}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {r.tokenId ?? "empty"}
              </div>
            </div>

            <div className="flex-shrink-0 text-right text-xs text-muted-foreground whitespace-nowrap">
              blocks {r.startHeight.toLocaleString()}-{r.endHeight.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-2 px-3">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (currentPage > 1) {
                      setCurrentPage(currentPage - 1)
                    }
                  }}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>

              {currentPage > 2 && (
                <>
                  <PaginationItem>
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        setCurrentPage(1)
                      }}
                    >
                      1
                    </PaginationLink>
                  </PaginationItem>
                  {currentPage > 3 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}
                </>
              )}

              {currentPage > 1 && (
                <PaginationItem>
                  <PaginationLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      setCurrentPage(currentPage - 1)
                    }}
                  >
                    {currentPage - 1}
                  </PaginationLink>
                </PaginationItem>
              )}

              <PaginationItem>
                <PaginationLink href="#" isActive>
                  {currentPage}
                </PaginationLink>
              </PaginationItem>

              {currentPage < totalPages && (
                <PaginationItem>
                  <PaginationLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      setCurrentPage(currentPage + 1)
                    }}
                  >
                    {currentPage + 1}
                  </PaginationLink>
                </PaginationItem>
              )}

              {currentPage < totalPages - 1 && (
                <>
                  {currentPage < totalPages - 2 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}
                  <PaginationItem>
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        setCurrentPage(totalPages)
                      }}
                    >
                      {totalPages}
                    </PaginationLink>
                  </PaginationItem>
                </>
              )}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (currentPage < totalPages) {
                      setCurrentPage(currentPage + 1)
                    }
                  }}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  )
}


