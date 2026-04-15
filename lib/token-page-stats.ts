import { fetchBlockchainInfo } from "@/lib/chronik"
import { fetchAgoraTransactionsFromChronik } from "@/lib/chronik-transactions"
import {
  fetchEtokenDbTokenSummary,
  type EtokenDbMappedTokenSummary,
} from "@/lib/etokendb"
import type { Transaction } from "@/lib/types"
import {
  applyStarShardFloor,
  BLOCKS_PER_DAY,
  BLOCKS_PER_MONTH,
  CACHE_TTL_MS,
  compute24hStats,
  getCachedTokenData,
  setCachedTokenData,
  setCachedTokenSummary,
} from "@/lib/token-stats"

export type TokenPageStats = {
  latestPrice: number
  priceChange24h: number
  last24HoursXECAmount: number
  last30DaysXECAmount: number
  totalTransactions: number
  totalXECAmount: number
  tokenId: string
  tokenName: string
}

type TokenPageStatsMapOptions = {
  tokenId: string
  tokenName: string
}

export type LoadTokenPageStatsOptions = {
  tokenId: string
  tokenName: string
  chainTipHeight: number | null
  etokenDbAvailable: boolean
  tokenDecimals?: number
}

export type LoadTokenPageStatsResult = {
  stats: TokenPageStats
  nextChainTipHeight: number | null
  source: "etokendb" | "chronik"
}

export const mapEtokenDbSummaryToTokenPageStats = (
  summary: EtokenDbMappedTokenSummary,
  options: TokenPageStatsMapOptions,
): TokenPageStats => {
  const latestPrice = summary.hasLatestPriceXec
    ? applyStarShardFloor(summary.latestPriceXec, options.tokenId)
    : 0

  return {
    latestPrice,
    priceChange24h: summary.hasPriceChange24h ? summary.priceChange24h : 0,
    last24HoursXECAmount: summary.last24HoursXECAmount,
    last30DaysXECAmount: summary.last30DaysVolumeXECAmount,
    totalTransactions: summary.recent30dTradeCount,
    totalXECAmount: summary.last30DaysVolumeXECAmount,
    tokenId: options.tokenId,
    tokenName: options.tokenName,
  }
}

export const loadTokenPageStats = async (
  options: LoadTokenPageStatsOptions,
): Promise<LoadTokenPageStatsResult> => {
  const { tokenId, tokenName, chainTipHeight, etokenDbAvailable, tokenDecimals } = options

  if (etokenDbAvailable) {
    try {
      const etokenDbSummary = await fetchEtokenDbTokenSummary(
        tokenId,
        typeof tokenDecimals === "number" ? { decimals: tokenDecimals } : undefined,
      )

      return {
        stats: mapEtokenDbSummaryToTokenPageStats(etokenDbSummary, {
          tokenId,
          tokenName,
        }),
        nextChainTipHeight: chainTipHeight,
        source: "etokendb",
      }
    } catch {
    }
  }

  const now = Date.now()
  const cached = getCachedTokenData(tokenId)
  const cacheValid = !!cached && now - cached.computedAt < CACHE_TTL_MS

  let effectiveTipHeight = chainTipHeight
  if (typeof effectiveTipHeight !== "number") {
    try {
      const info = await fetchBlockchainInfo()
      if (typeof info?.tipHeight === "number") {
        effectiveTipHeight = info.tipHeight
      }
    } catch {
    }
  }

  let last30DaysXECAmount = cacheValid ? cached!.last30DaysXECAmount : 0
  let totalTransactions30d = cacheValid ? cached!.totalTransactions : 0
  let latestProcessedHeight: number | null =
    typeof cached?.latestProcessedHeight === "number" ? cached.latestProcessedHeight : null
  let fetchError = false
  const tx24h: Transaction[] = []

  try {
    await fetchAgoraTransactionsFromChronik(
      tokenId,
      (batch) => {
        tx24h.push(...batch)
      },
      {
        targetCount: 400,
        pageSize: 200,
        maxBlocksBack: BLOCKS_PER_DAY,
        stopBelowHeight:
          typeof effectiveTipHeight === "number"
            ? Math.max(effectiveTipHeight - BLOCKS_PER_DAY, 0)
            : undefined,
        failOnError: true,
      },
    )
  } catch {
    fetchError = true
  }

  const {
    latestPrice: rawLatestPrice,
    priceChange24h,
    last24HoursXECAmount,
    latestBlockHeight,
  } = compute24hStats(tx24h, effectiveTipHeight ?? chainTipHeight, null)

  if (cacheValid && typeof latestProcessedHeight === "number") {
    const deltaTx = tx24h.filter(
      (tx) => typeof tx.blockHeight === "number" && tx.blockHeight > latestProcessedHeight!,
    )
    const deltaVolume = deltaTx.reduce(
      (sum, tx) => sum + (tx.price || 0) * (tx.amount || 0),
      0,
    )
    last30DaysXECAmount += deltaVolume
    totalTransactions30d += deltaTx.length
  }

  if (!cacheValid) {
    try {
      const tx30d = await fetchAgoraTransactionsFromChronik(tokenId, undefined, {
        targetCount: 800,
        pageSize: 200,
        maxBlocksBack: BLOCKS_PER_MONTH,
        stopBelowHeight:
          typeof effectiveTipHeight === "number"
            ? Math.max(effectiveTipHeight - BLOCKS_PER_MONTH, 0)
            : undefined,
        failOnError: false,
      })
      const confirmed30d = tx30d.filter((tx) => typeof tx.blockHeight === "number")
      last30DaysXECAmount = confirmed30d.reduce(
        (sum, tx) => sum + (tx.price || 0) * (tx.amount || 0),
        0,
      )
      totalTransactions30d = confirmed30d.length
      const maxHeight = confirmed30d.reduce<number | null>((max, tx) => {
        if (typeof tx.blockHeight !== "number") return max
        if (max === null) return tx.blockHeight
        return Math.max(max, tx.blockHeight)
      }, null)
      if (typeof maxHeight === "number") {
        latestProcessedHeight = maxHeight
      }
    } catch {
    }
  }

  if (typeof latestBlockHeight === "number") {
    latestProcessedHeight =
      typeof latestProcessedHeight === "number"
        ? Math.max(latestProcessedHeight, latestBlockHeight)
        : latestBlockHeight
  }

  const latestPrice = applyStarShardFloor(rawLatestPrice, tokenId)
  const finalData: TokenPageStats = {
    latestPrice,
    priceChange24h,
    last24HoursXECAmount,
    last30DaysXECAmount,
    totalTransactions: totalTransactions30d,
    totalXECAmount: last30DaysXECAmount,
    tokenId,
    tokenName,
  }

  if (!fetchError) {
    setCachedTokenData(tokenId, {
      computedAt: Date.now(),
      latestProcessedHeight: latestProcessedHeight || 0,
      last30DaysXECAmount,
      totalTransactions: totalTransactions30d,
    })

    if (!etokenDbAvailable) {
      setCachedTokenSummary(tokenId, {
        computedAt: Date.now(),
        data: finalData,
      })
    }
  }

  return {
    stats: finalData,
    nextChainTipHeight: effectiveTipHeight ?? chainTipHeight ?? null,
    source: "chronik",
  }
}
