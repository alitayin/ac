import { Transaction } from "@/lib/types"
import { storageManager } from "./storage-manager"

export const BLOCKS_PER_HOUR = 6
export const BLOCKS_PER_DAY = BLOCKS_PER_HOUR * 24
export const BLOCKS_PER_3_DAYS = BLOCKS_PER_DAY * 3
export const BLOCKS_PER_7_DAYS = BLOCKS_PER_DAY * 7
export const BLOCKS_PER_MONTH = BLOCKS_PER_DAY * 30
export const BLOCKS_PER_YEAR = BLOCKS_PER_DAY * 365
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000
export const SUMMARY_CACHE_TTL_MS = 10 * 60 * 1000
export const CACHE_KEY_PREFIX = "token_stats_cache_v1"
export const SUMMARY_CACHE_KEY_PREFIX = "token_summary_cache_v3"

export type CachedTokenData = {
  computedAt: number
  latestProcessedHeight: number
  last30DaysXECAmount: number
  totalTransactions: number
  last365DaysXECAmount?: number
  totalTransactions365d?: number
  latestProcessedHeight365d?: number
}

export const getCachedTokenData = (tokenId: string): CachedTokenData | null => {
  try {
    const parsed = storageManager.get<CachedTokenData>(`${CACHE_KEY_PREFIX}_${tokenId}` as any)
    if (!parsed) return null
    if (
      typeof parsed.computedAt !== "number" ||
      typeof parsed.latestProcessedHeight !== "number" ||
      typeof parsed.last30DaysXECAmount !== "number" ||
      typeof parsed.totalTransactions !== "number"
    ) {
      return null
    }
    if (
      (parsed.last365DaysXECAmount !== undefined &&
        typeof parsed.last365DaysXECAmount !== "number") ||
      (parsed.totalTransactions365d !== undefined &&
        typeof parsed.totalTransactions365d !== "number") ||
      (parsed.latestProcessedHeight365d !== undefined &&
        typeof parsed.latestProcessedHeight365d !== "number")
    ) {
      return null
    }
    return parsed as CachedTokenData
  } catch {
    return null
  }
}

export const setCachedTokenData = (tokenId: string, data: CachedTokenData) => {
  try {
    storageManager.set(`${CACHE_KEY_PREFIX}_${tokenId}` as any, data)
  } catch (_err) {}
}

export const clearTokenCache = () => {
  try {
    storageManager.clearByPrefix(CACHE_KEY_PREFIX)
    storageManager.clearByPrefix(SUMMARY_CACHE_KEY_PREFIX)
  } catch (_err) {}
}

export const invalidateTokenCache = (tokenId: string) => {
  try {
    const parsed = storageManager.get<CachedTokenData>(`${CACHE_KEY_PREFIX}_${tokenId}` as any)
    if (parsed) {
      parsed.computedAt = 0
      storageManager.set(`${CACHE_KEY_PREFIX}_${tokenId}` as any, parsed)
    }
  } catch (_err) {}
}

export const deleteSummaryCache = (tokenId: string) => {
  try {
    storageManager.remove(`${SUMMARY_CACHE_KEY_PREFIX}_${tokenId}` as any)
  } catch (_err) {}
}

export const refreshSummaryCacheTimestamps = (tokenIds: string[]) => {
  try {
    const now = Date.now()
    tokenIds.forEach((tokenId) => {
      const cached = getCachedTokenSummary(tokenId)
      if (cached) {
        setCachedTokenSummary(tokenId, {
          ...cached,
          computedAt: now,
        })
      }
    })
  } catch (_err) {
    console.error('[Cache Refresh] ❌ Error during refresh:', _err)
  }
}

export const calculateStats = (
  transactions: Transaction[],
  latestBlockHeight: number | null,
  tipHeight: number | null,
) => {
  if (transactions.length === 0) {
    return {
      latestPrice: 0,
      priceChange24h: 0,
      last24HoursXECAmount: 0,
      last30DaysXECAmount: 0,
      totalTransactions: 0,
      totalXECAmount: 0,
    }
  }

  const allTx = [...transactions].sort((a, b) => b.timestamp - a.timestamp)
  const confirmedTx = transactions.filter((tx) => typeof tx.blockHeight === "number")
  const orderedConfirmedTx = [...confirmedTx].sort((a, b) => b.timestamp - a.timestamp)

  const referenceHeight =
    tipHeight ??
    latestBlockHeight ??
    orderedConfirmedTx.find((tx) => typeof tx.blockHeight === "number")?.blockHeight ??
    null
  const referenceTime = allTx[0]?.timestamp ?? Math.floor(Date.now() / 1000)

  const isWithin1D = (tx: Transaction) => {
    return tx.timestamp >= referenceTime - 86400
  }

  const isWithin30D = (tx: Transaction) => {
    if (referenceHeight && typeof tx.blockHeight === "number") {
      return tx.blockHeight >= referenceHeight - BLOCKS_PER_MONTH
    }
    return tx.timestamp >= referenceTime - 86400 * 30
  }

  const tx1D = allTx.filter(isWithin1D)
  const tx30D = orderedConfirmedTx.filter(isWithin30D)

  const latestPrice = allTx[0]?.price || 0
  const earliest24hPrice = tx1D.length > 0 ? tx1D[tx1D.length - 1].price : 0
  const priceChange24h =
    earliest24hPrice > 0 ? ((latestPrice - earliest24hPrice) / earliest24hPrice) * 100 : 0

  const sumXec = (list: Transaction[]) =>
    list.reduce((sum, tx) => sum + (tx.price || 0) * (tx.amount || 0), 0)

  const last24HoursXECAmount = sumXec(tx1D)
  const last30DaysXECAmount = sumXec(tx30D)

  return {
    latestPrice,
    priceChange24h,
    last24HoursXECAmount,
    last30DaysXECAmount,
    totalTransactions: tx30D.length,
    totalXECAmount: last30DaysXECAmount,
  }
}

export const applyStarShardFloor = (price: number, tokenId: string) => {
  return price
}

export const pruneRecentTransactions = (
  txs: Transaction[],
  effectiveTipHeight: number | null,
  chainTipHeight: number | null,
) => {
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 86400 * 30
  const heightThreshold =
    typeof effectiveTipHeight === "number"
      ? effectiveTipHeight - BLOCKS_PER_MONTH
      : typeof chainTipHeight === "number"
        ? chainTipHeight - BLOCKS_PER_MONTH
        : null

  const filtered = txs.filter((tx) => {
    if (typeof tx.blockHeight !== "number") return false
    const withinHeight =
      typeof heightThreshold === "number" ? tx.blockHeight >= heightThreshold : true
    const withinTime = tx.timestamp >= thirtyDaysAgo
    return withinHeight && withinTime
  })

  const latestBlockHeight = filtered.reduce<number | null>((max, tx) => {
    if (typeof tx.blockHeight !== "number") return max
    if (max === null) return tx.blockHeight
    return Math.max(max, tx.blockHeight)
  }, null)

  return { filtered, latestBlockHeight }
}

export type CachedTokenSummary<T = any> = {
  computedAt: number
  data: T
}

export const getCachedTokenSummary = <T = any>(
  tokenId: string,
): CachedTokenSummary<T> | null => {
  try {
    const parsed = storageManager.get<CachedTokenSummary<T>>(`${SUMMARY_CACHE_KEY_PREFIX}_${tokenId}` as any)
    if (!parsed) return null
    if (
      typeof parsed.computedAt !== "number" ||
      typeof parsed.data !== "object" ||
      parsed.data === null
    ) {
      return null
    }
    return parsed as CachedTokenSummary<T>
  } catch {
    return null
  }
}

export const setCachedTokenSummary = <T = any>(
  tokenId: string,
  data: CachedTokenSummary<T>,
) => {
  try {
    storageManager.set(`${SUMMARY_CACHE_KEY_PREFIX}_${tokenId}` as any, data)
  } catch (_err) {}
}

export const compute24hStats = (
  txs: Transaction[],
  _referenceHeight: number | null,
  _referenceTime: number | null,
) => {
  if (!txs.length) {
    return {
      latestPrice: 0,
      priceChange24h: 0,
      last24HoursXECAmount: 0,
      last30DaysXECAmount: 0,
      totalTransactions: 0,
      latestBlockHeight: null as number | null,
    }
  }

  const sorted = [...txs].sort((a, b) => b.timestamp - a.timestamp)
  const latestPrice = sorted[0]?.price || 0
  const earliestPrice = sorted.length > 1 ? sorted[sorted.length - 1].price : sorted[0]?.price || 0
  const priceChange24h =
    earliestPrice > 0 ? ((latestPrice - earliestPrice) / earliestPrice) * 100 : 0

  const sumXec = (list: Transaction[]) =>
    list.reduce((sum, tx) => sum + (tx.price || 0) * (tx.amount || 0), 0)

  const last24HoursXECAmount = sumXec(sorted)

  const latestBlockHeight = sorted.reduce<number | null>((max, tx) => {
    if (typeof tx.blockHeight !== "number") return max
    if (max === null) return tx.blockHeight
    return Math.max(max, tx.blockHeight)
  }, null)

  return {
    latestPrice,
    priceChange24h,
    last24HoursXECAmount,
    totalTransactions: sorted.length,
    latestBlockHeight,
  }
}
