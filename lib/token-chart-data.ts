import { fetchEtokenDbTokenCandles, type EtokenDbCandleInterval } from "@/lib/etokendb"
import { fetchHourlyData } from "@/lib/hourly-cache"

export type TokenChartRange = "24h" | "72h" | "7d" | "30d" | "60d" | "90d"
export type TokenChartSource = "etokendb" | "chronik"

export type TokenChartPoint = {
  bucketStart: number
  bucketEnd: number
  volumeXec: number
  tradeCount: number
  openPriceXec: number
  highPriceXec: number
  lowPriceXec: number
  closePriceXec: number
}

export type TokenChartSeries = {
  points: TokenChartPoint[]
  interval: EtokenDbCandleInterval
  source: TokenChartSource
}

type TokenChartRequest = {
  interval: EtokenDbCandleInterval
  limit: number
  hours: number
}

type ChronikHourlyPoint = {
  date: string
  amount: number
  matchedTxCount: number
  averagePrice: number
  latestPrice: number
}

const ETOKENDB_CHART_CACHE = new Map<string, TokenChartPoint[]>()

const INTERVAL_STEP_MS: Record<EtokenDbCandleInterval, number> = {
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
}

const HOUR_IN_MS = INTERVAL_STEP_MS.hour

export const getTokenChartRequest = (range: TokenChartRange): TokenChartRequest => {
  switch (range) {
    case "24h":
      return { interval: "hour", limit: 24, hours: 24 }
    case "72h":
      return { interval: "hour", limit: 72, hours: 72 }
    case "7d":
      return { interval: "hour", limit: 168, hours: 168 }
    case "30d":
      return { interval: "day", limit: 30, hours: 30 * 24 }
    case "60d":
      return { interval: "day", limit: 60, hours: 60 * 24 }
    case "90d":
    default:
      return { interval: "day", limit: 90, hours: 90 * 24 }
  }
}

export const getTokenChartStepMs = (interval: EtokenDbCandleInterval): number => {
  return INTERVAL_STEP_MS[interval]
}

export const clearTokenChartCache = () => {
  ETOKENDB_CHART_CACHE.clear()
}

const toUtcDate = (date: string): Date => {
  if (!date) return new Date(0)
  if (date.includes("T")) {
    return new Date(date.endsWith("Z") ? date : `${date}Z`)
  }

  return new Date(`${date.replace(" ", "T")}:00Z`)
}

const getWeekStartMs = (timestampMs: number): number => {
  const date = new Date(timestampMs)
  date.setUTCHours(0, 0, 0, 0)
  const offset = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - offset)
  return date.getTime()
}

const normalizeBucketStart = (
  timestampMs: number,
  interval: EtokenDbCandleInterval,
): number => {
  const date = new Date(timestampMs)

  if (interval === "hour") {
    date.setUTCMinutes(0, 0, 0)
    return date.getTime()
  }

  if (interval === "day") {
    date.setUTCHours(0, 0, 0, 0)
    return date.getTime()
  }

  return getWeekStartMs(timestampMs)
}

export const fillTokenChartPoints = (
  points: TokenChartPoint[],
  interval: EtokenDbCandleInterval,
  limit: number,
): TokenChartPoint[] => {
  if (!points.length) return []

  const sorted = [...points].sort((left, right) => left.bucketStart - right.bucketStart)
  const stepMs = getTokenChartStepMs(interval)
  const latestBucketStart = sorted[sorted.length - 1].bucketStart
  const firstBucketStart = latestBucketStart - stepMs * (Math.max(1, limit) - 1)
  const indexed = new Map(sorted.map((item) => [item.bucketStart, item]))
  const filled: TokenChartPoint[] = []
  const firstKnownPrice =
    sorted
      .map((item) => (
        item.openPriceXec > 0 ? item.openPriceXec :
        item.closePriceXec > 0 ? item.closePriceXec :
        item.highPriceXec > 0 ? item.highPriceXec :
        item.lowPriceXec > 0 ? item.lowPriceXec :
        0
      ))
      .find((price) => price > 0) || 0
  let previousClose = firstKnownPrice

  for (let cursor = firstBucketStart; cursor <= latestBucketStart; cursor += stepMs) {
    const existing = indexed.get(cursor)
    if (existing) {
      filled.push(existing)
      previousClose = existing.closePriceXec
      continue
    }

    filled.push({
      bucketStart: cursor,
      bucketEnd: cursor + stepMs,
      volumeXec: 0,
      tradeCount: 0,
      openPriceXec: previousClose,
      highPriceXec: previousClose,
      lowPriceXec: previousClose,
      closePriceXec: previousClose,
    })
  }

  return filled
}

export const mapChronikHourlyDataToTokenChartPoints = (
  hourlyData: ChronikHourlyPoint[],
  interval: EtokenDbCandleInterval,
): TokenChartPoint[] => {
  if (!hourlyData.length) return []

  const buckets = new Map<number, TokenChartPoint>()

  hourlyData.forEach((item) => {
    const bucketStart = normalizeBucketStart(toUtcDate(item.date).getTime(), interval)
    const bucketEnd = bucketStart + getTokenChartStepMs(interval)
    const openPrice = item.averagePrice || item.latestPrice || 0
    const closePrice = item.latestPrice || item.averagePrice || 0
    const highPrice = Math.max(openPrice, closePrice)
    const lowPrice = Math.min(openPrice, closePrice)
    const volumeXec = item.amount / 100
    const existing = buckets.get(bucketStart)

    if (!existing) {
      buckets.set(bucketStart, {
        bucketStart,
        bucketEnd,
        volumeXec,
        tradeCount: item.matchedTxCount || 0,
        openPriceXec: openPrice,
        highPriceXec: highPrice,
        lowPriceXec: lowPrice,
        closePriceXec: closePrice,
      })
      return
    }

    existing.bucketEnd = bucketEnd
    existing.volumeXec += volumeXec
    existing.tradeCount += item.matchedTxCount || 0
    existing.highPriceXec = Math.max(existing.highPriceXec, highPrice)
    existing.lowPriceXec = Math.min(existing.lowPriceXec, lowPrice)
    existing.closePriceXec = closePrice
  })

  return Array.from(buckets.values()).sort((left, right) => left.bucketStart - right.bucketStart)
}

export const formatTokenChartAxisLabel = (
  timestampMs: number,
  interval: EtokenDbCandleInterval,
): string => {
  const date = new Date(timestampMs)

  if (interval === "hour") {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

export const formatTokenChartTooltipLabel = (
  timestampMs: number,
  interval: EtokenDbCandleInterval,
): string => {
  const date = new Date(timestampMs)

  if (interval === "hour") {
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

const fetchChronikFallbackChartSeries = async (
  tokenId: string,
  request: TokenChartRequest,
): Promise<TokenChartPoint[]> => {
  const hourlyData = await fetchHourlyData(tokenId, request.hours)
  if (!hourlyData.length) return []

  const points = mapChronikHourlyDataToTokenChartPoints(hourlyData, request.interval)
  return fillTokenChartPoints(points, request.interval, request.limit)
}

export const fetchTokenChartSeries = async (
  tokenId: string,
  range: TokenChartRange,
): Promise<TokenChartSeries> => {
  if (!tokenId) {
    return {
      points: [],
      interval: "day",
      source: "chronik",
    }
  }

  const request = getTokenChartRequest(range)
  const cacheKey = `${tokenId}:${request.interval}:${request.limit}`
  const cached = ETOKENDB_CHART_CACHE.get(cacheKey)

  if (cached) {
    return {
      points: cached,
      interval: request.interval,
      source: "etokendb",
    }
  }

  try {
    const candles = await fetchEtokenDbTokenCandles(tokenId, {
      interval: request.interval,
      limit: request.limit,
    })

    if (candles.items.length > 0) {
      const points = fillTokenChartPoints(candles.items, candles.interval, request.limit)
      ETOKENDB_CHART_CACHE.set(cacheKey, points)

      return {
        points,
        interval: candles.interval,
        source: "etokendb",
      }
    }
  } catch {
  }

  return {
    points: await fetchChronikFallbackChartSeries(tokenId, request),
    interval: request.interval,
    source: "chronik",
  }
}

export const getHourlyRangeFromHours = (hours: number): TokenChartRange => {
  if (hours <= 24) return "24h"
  if (hours <= 72) return "72h"
  if (hours <= 168) return "7d"
  if (hours <= 720) return "30d"
  if (hours <= 1440) return "60d"
  return "90d"
}

export const aggregateHourlyRangeToTokenChartPoints = (
  hourlyData: ChronikHourlyPoint[],
  hours: number,
): TokenChartPoint[] => {
  const range = getHourlyRangeFromHours(hours)
  const request = getTokenChartRequest(range)
  const trailingHours = request.limit * (request.interval === "hour" ? 1 : 24)
  const trimmed =
    hourlyData.length > trailingHours
      ? hourlyData.slice(hourlyData.length - trailingHours)
      : hourlyData

  return fillTokenChartPoints(
    mapChronikHourlyDataToTokenChartPoints(trimmed, request.interval),
    request.interval,
    request.limit,
  )
}

export const buildTokenChartPointFromHour = (
  date: string,
  closePriceXec: number,
): TokenChartPoint => {
  const bucketStart = normalizeBucketStart(toUtcDate(date).getTime(), "hour")
  return {
    bucketStart,
    bucketEnd: bucketStart + HOUR_IN_MS,
    volumeXec: 0,
    tradeCount: 0,
    openPriceXec: closePriceXec,
    highPriceXec: closePriceXec,
    lowPriceXec: closePriceXec,
    closePriceXec,
  }
}
