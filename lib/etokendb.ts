import type { ChronikClient } from "chronik-client"

import { resolveTokenDecimals } from "@/lib/chronik"

export const ETOKENDB_UPSTREAM_BASE_URL = "https://etokendb.alitayin.com/api"

const ETOKENDB_API_BASE_PATH = "/api/etokendb"
const ETOKENDB_TOKENS_API_BASE_PATH = `${ETOKENDB_API_BASE_PATH}/tokens`
const STATUS_CACHE_TTL_MS = 60_000
const STATUS_TIMEOUT_MS = 4_000
const TOKEN_TIMEOUT_MS = 8_000
const TOKEN_LIST_TIMEOUT_MS = 8_000
const TOKEN_ID_PATTERN = /^[a-f0-9]{64}$/i
const NANOSATS_PER_XEC = 100_000_000_000
const ETOKENDB_TOP_VOLUME_PAGE_SIZE = 100

type NumericLike = number | string | null | undefined

export type EtokenDbTokenSummaryRecord = {
  tokenId?: string
  isActive?: boolean
  isReady?: boolean
  bootstrapCohort?: boolean
  totalTradeCount?: NumericLike
  totalVolumeSats?: NumericLike
  latestPriceNanosatsPerAtom?: NumericLike
  recent144TradeCount?: NumericLike
  recent144VolumeSats?: NumericLike
  recent144PriceChangeBps?: NumericLike
  recent144PriceChangePct?: NumericLike
  recent1008TradeCount?: NumericLike
  recent1008VolumeSats?: NumericLike
  recent4320TradeCount?: NumericLike
  recent4320VolumeSats?: NumericLike
  lastTradeBlockHeight?: NumericLike
  lastTradeBlockTimestamp?: NumericLike
  lastSyncedAt?: NumericLike
  lastWsEventAt?: NumericLike
  [key: string]: unknown
}

export type EtokenDbStatusPayload = {
  ok?: boolean
  data?: {
    healthy?: boolean
    ready?: boolean
    phase?: string
    [key: string]: unknown
  }
  error?: string
}

export type EtokenDbTokenPayload = {
  ok?: boolean
  data?: {
    summary?: EtokenDbTokenSummaryRecord | null
    [key: string]: unknown
  }
  error?: string
}

export type EtokenDbTokenListPayload = {
  ok?: boolean
  data?: {
    page?: NumericLike
    pageSize?: NumericLike
    total?: NumericLike
    items?: (EtokenDbTokenSummaryRecord | null)[] | null
    [key: string]: unknown
  }
  error?: string
}

export type EtokenDbMappedTokenSummary = {
  tokenId: string
  tokenDecimals: number
  recent24hTradeCount: number
  recent7dTradeCount: number
  last24HoursXECAmount: number
  last7DaysXECAmount: number
  last30DaysVolumeXECAmount: number
  latestPriceXec: number
  priceChange24h: number
  hasLatestPriceXec: boolean
  hasPriceChange24h: boolean
  has30DayVolume: boolean
  lastTradeBlockHeight: number | null
  lastTradeBlockTimestamp: number | null
  lastSyncedAt: number | null
}

export type EtokenDbTopVolumeToken = {
  tokenId: string
  recent24hTradeCount: number
  recent7dTradeCount: number
  last24HoursXECAmount: number
  last7DaysXECAmount: number
  last30DaysVolumeXECAmount: number
  latestPriceNanosatsPerAtom: number
  priceChange24h: number
  hasLatestPrice: boolean
  hasPriceChange24h: boolean
  has30DayVolume: boolean
  lastTradeBlockHeight: number | null
  lastTradeBlockTimestamp: number | null
  lastSyncedAt: number | null
}

type MapEtokenDbTokenSummaryOptions = {
  decimals?: number
}

type FetchEtokenDbTokenSummaryOptions = {
  decimals?: number
  chronikClient?: ChronikClient
}

let cachedAvailability: { value: boolean; checkedAt: number } | null = null
let pendingAvailabilityRequest: Promise<boolean> | null = null

const coerceFiniteNumber = (value: NumericLike): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

const coerceCount = (value: NumericLike): number => {
  return Math.max(0, Math.trunc(coerceFiniteNumber(value)))
}

const hasValue = (value: NumericLike): boolean => {
  return value !== null && value !== undefined && `${value}`.trim().length > 0
}

export const satsToXec = (value: NumericLike): number => {
  return coerceFiniteNumber(value) / 100
}

export const nanosatsPerAtomToXec = (
  value: NumericLike,
  decimals: number,
): number => {
  const nanosatsPerAtom = coerceFiniteNumber(value)
  if (nanosatsPerAtom <= 0) return 0

  const normalizedDecimals = Math.max(0, Math.trunc(decimals || 0))
  const nanosatsPerToken = nanosatsPerAtom * Math.pow(10, normalizedDecimals)
  const xecPerToken = nanosatsPerToken / NANOSATS_PER_XEC

  return Number.isFinite(xecPerToken) ? xecPerToken : 0
}

export const getEtokenDbPriceChange24h = (
  pctValue: NumericLike,
  bpsValue: NumericLike,
): { value: number; hasValue: boolean } => {
  if (hasValue(pctValue)) {
    return {
      value: coerceFiniteNumber(pctValue),
      hasValue: true,
    }
  }

  if (hasValue(bpsValue)) {
    return {
      value: coerceFiniteNumber(bpsValue) / 100,
      hasValue: true,
    }
  }

  return {
    value: 0,
    hasValue: false,
  }
}

export const isValidEtokenDbTokenId = (tokenId: string): boolean => {
  return TOKEN_ID_PATTERN.test(tokenId)
}

const fetchJsonWithTimeout = async <T>(
  input: string,
  timeoutMs: number,
): Promise<T> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(input, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      const message =
        payload && typeof payload === "object" && typeof (payload as any).error === "string"
          ? (payload as any).error
          : `Request failed with status ${response.status}`
      throw new Error(message)
    }

    if (!payload || typeof payload !== "object") {
      throw new Error("Invalid JSON response")
    }

    return payload as T
  } finally {
    clearTimeout(timeoutId)
  }
}

const isReadyStatusPayload = (
  payload: EtokenDbStatusPayload | null | undefined,
): boolean => {
  return Boolean(
    payload?.ok &&
      payload?.data?.healthy &&
      payload?.data?.ready &&
      payload?.data?.phase === "ready",
  )
}

export const isEtokenDbAvailable = async (
  options?: { forceRefresh?: boolean },
): Promise<boolean> => {
  const now = Date.now()

  if (
    !options?.forceRefresh &&
    cachedAvailability &&
    now - cachedAvailability.checkedAt < STATUS_CACHE_TTL_MS
  ) {
    return cachedAvailability.value
  }

  if (!options?.forceRefresh && pendingAvailabilityRequest) {
    return pendingAvailabilityRequest
  }

  pendingAvailabilityRequest = (async () => {
    try {
      const payload = await fetchJsonWithTimeout<EtokenDbStatusPayload>(
        `${ETOKENDB_API_BASE_PATH}/status`,
        STATUS_TIMEOUT_MS,
      )
      const value = isReadyStatusPayload(payload)
      cachedAvailability = { value, checkedAt: Date.now() }
      return value
    } catch (_error) {
      cachedAvailability = { value: false, checkedAt: Date.now() }
      return false
    } finally {
      pendingAvailabilityRequest = null
    }
  })()

  return pendingAvailabilityRequest
}

export const resetEtokenDbAvailabilityCache = () => {
  cachedAvailability = null
  pendingAvailabilityRequest = null
}

export const isEtokenDbAvailableWithRetry = async (
  options?: { attempts?: number; delayMs?: number },
): Promise<boolean> => {
  const attempts = Math.max(1, Math.trunc(options?.attempts ?? 3))
  const delayMs = Math.max(0, Math.trunc(options?.delayMs ?? 1_000))

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const available = await isEtokenDbAvailable({ forceRefresh: attempt > 1 })
    if (available) {
      return true
    }

    if (attempt < attempts && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  return false
}

export const mapEtokenDbTokenSummary = (
  payload: EtokenDbTokenPayload,
  options?: MapEtokenDbTokenSummaryOptions,
): EtokenDbMappedTokenSummary => {
  const summary = payload?.data?.summary

  if (!payload?.ok || !summary || typeof summary.tokenId !== "string") {
    throw new Error("Invalid etokendb token payload")
  }

  const tokenDecimals = Math.max(0, Math.trunc(options?.decimals ?? 0))
  const latestPriceXec = nanosatsPerAtomToXec(summary.latestPriceNanosatsPerAtom, tokenDecimals)
  const priceChange = getEtokenDbPriceChange24h(
    summary.recent144PriceChangePct,
    summary.recent144PriceChangeBps,
  )
  const hasLatestPriceXec =
    hasValue(summary.latestPriceNanosatsPerAtom) &&
    coerceFiniteNumber(summary.latestPriceNanosatsPerAtom) > 0

  return {
    tokenId: summary.tokenId,
    tokenDecimals,
    recent24hTradeCount: coerceCount(summary.recent144TradeCount),
    recent7dTradeCount: coerceCount(summary.recent1008TradeCount),
    last24HoursXECAmount: satsToXec(summary.recent144VolumeSats),
    last7DaysXECAmount: satsToXec(summary.recent1008VolumeSats),
    last30DaysVolumeXECAmount: satsToXec(summary.recent4320VolumeSats),
    latestPriceXec,
    priceChange24h: priceChange.value,
    hasLatestPriceXec,
    hasPriceChange24h: priceChange.hasValue,
    has30DayVolume: hasValue(summary.recent4320VolumeSats),
    lastTradeBlockHeight:
      summary.lastTradeBlockHeight === null || summary.lastTradeBlockHeight === undefined
        ? null
        : coerceCount(summary.lastTradeBlockHeight),
    lastTradeBlockTimestamp:
      summary.lastTradeBlockTimestamp === null ||
      summary.lastTradeBlockTimestamp === undefined
        ? null
        : coerceCount(summary.lastTradeBlockTimestamp),
    lastSyncedAt:
      summary.lastSyncedAt === null || summary.lastSyncedAt === undefined
        ? null
        : coerceCount(summary.lastSyncedAt),
  }
}

export const fetchEtokenDbTokenSummary = async (
  tokenId: string,
  options?: FetchEtokenDbTokenSummaryOptions,
): Promise<EtokenDbMappedTokenSummary> => {
  if (!isValidEtokenDbTokenId(tokenId)) {
    throw new Error("Invalid tokenId")
  }

  const payload = await fetchJsonWithTimeout<EtokenDbTokenPayload>(
    `${ETOKENDB_API_BASE_PATH}/tokens/${encodeURIComponent(tokenId)}`,
    TOKEN_TIMEOUT_MS,
  )

  const decimals =
    typeof options?.decimals === "number"
      ? options.decimals
      : await resolveTokenDecimals(tokenId, options?.chronikClient)

  return mapEtokenDbTokenSummary(payload, { decimals })
}

export const fetchEtokenDbTopVolumeTokenIds = async (
  options?: { pageSize?: number },
): Promise<string[]> => {
  const tokens = await fetchEtokenDbTopVolumeTokens(options)
  return tokens.map((token) => token.tokenId)
}

export const fetchEtokenDbTopVolumeTokens = async (
  options?: { pageSize?: number },
): Promise<EtokenDbTopVolumeToken[]> => {
  const pageSize = Math.max(
    1,
    Math.trunc(options?.pageSize ?? ETOKENDB_TOP_VOLUME_PAGE_SIZE),
  )
  const params = new URLSearchParams({
    sort: "recent1008VolumeSats",
    order: "desc",
    pageSize: `${pageSize}`,
    readyOnly: "true",
  })

  const payload = await fetchJsonWithTimeout<EtokenDbTokenListPayload>(
    `${ETOKENDB_TOKENS_API_BASE_PATH}?${params.toString()}`,
    TOKEN_LIST_TIMEOUT_MS,
  )

  if (!payload?.ok || !Array.isArray(payload.data?.items)) {
    throw new Error("Invalid etokendb token list payload")
  }

  const seen = new Set<string>()
  const tokens: EtokenDbTopVolumeToken[] = []

  payload.data.items.forEach((item) => {
    const tokenId = item?.tokenId
    if (typeof tokenId !== "string" || !isValidEtokenDbTokenId(tokenId)) {
      return
    }
    if (seen.has(tokenId)) {
      return
    }

    seen.add(tokenId)
    const priceChange = getEtokenDbPriceChange24h(
      item?.recent144PriceChangePct,
      item?.recent144PriceChangeBps,
    )
    const latestPriceNanosatsPerAtom = coerceFiniteNumber(item?.latestPriceNanosatsPerAtom)
    tokens.push({
      tokenId,
      recent24hTradeCount: coerceCount(item?.recent144TradeCount),
      recent7dTradeCount: coerceCount(item?.recent1008TradeCount),
      last24HoursXECAmount: satsToXec(item?.recent144VolumeSats),
      last7DaysXECAmount: satsToXec(item?.recent1008VolumeSats),
      last30DaysVolumeXECAmount: satsToXec(item?.recent4320VolumeSats),
      latestPriceNanosatsPerAtom,
      priceChange24h: priceChange.value,
      hasLatestPrice: hasValue(item?.latestPriceNanosatsPerAtom) && latestPriceNanosatsPerAtom > 0,
      hasPriceChange24h: priceChange.hasValue,
      has30DayVolume: hasValue(item?.recent4320VolumeSats),
      lastTradeBlockHeight:
        item?.lastTradeBlockHeight === null || item?.lastTradeBlockHeight === undefined
          ? null
          : coerceCount(item?.lastTradeBlockHeight),
      lastTradeBlockTimestamp:
        item?.lastTradeBlockTimestamp === null || item?.lastTradeBlockTimestamp === undefined
          ? null
          : coerceCount(item?.lastTradeBlockTimestamp),
      lastSyncedAt:
        item?.lastSyncedAt === null || item?.lastSyncedAt === undefined
          ? null
          : coerceCount(item?.lastSyncedAt),
    })
  })

  return tokens
}
