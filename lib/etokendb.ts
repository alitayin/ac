import type { ChronikClient } from "chronik-client"

import { resolveTokenDecimals } from "@/lib/chronik"

export const ETOKENDB_UPSTREAM_BASE_URL = "https://etokendb.alitayin.com/api"

const ETOKENDB_API_BASE_PATH = "/api/etokendb"
const ETOKENDB_TOKENS_API_BASE_PATH = `${ETOKENDB_API_BASE_PATH}/tokens`
const STATUS_CACHE_TTL_MS = 60_000
const STATUS_TIMEOUT_MS = 4_000
const TOKEN_TIMEOUT_MS = 8_000
const TOKEN_LIST_TIMEOUT_MS = 8_000
const TOKEN_CANDLES_TIMEOUT_MS = 8_000
const TOKEN_REVIEWS_TIMEOUT_MS = 8_000
const TOKEN_PROJECT_INFO_TIMEOUT_MS = 8_000
const TOKEN_ID_PATTERN = /^[a-f0-9]{64}$/i
const INVOICE_ID_PATTERN = /^[0-9a-f-]{16,}$/i
const TXID_PATTERN = /^[a-f0-9]{64}$/i
const NANOSATS_PER_XEC = 100_000_000_000
const ETOKENDB_TOP_VOLUME_PAGE_SIZE = 100
export const MAX_ETOKENDB_TOKEN_LIST_PAGE_SIZE = 200
const ETOKENDB_TOKEN_LIST_SORT_FIELDS = [
  "recent144VolumeSats",
  "recent1008VolumeSats",
  "recent4320VolumeSats",
  "recent144TradeCount",
  "recent1008TradeCount",
  "recent4320TradeCount",
  "lastTradeBlockHeight",
  "lastTradeBlockTimestamp",
  "lastSyncedAt",
  "latestPriceNanosatsPerAtom",
  "totalVolumeSats",
  "totalTradeCount",
  "reviewAverageScore",
  "reviewScorerCount",
  "reviewCountTotal",
  "reviewCommentCountTotal",
  "lastReviewAt",
] as const
const ETOKENDB_TOKEN_LIST_SORT_FIELD_SET = new Set<string>(
  ETOKENDB_TOKEN_LIST_SORT_FIELDS,
)

type NumericLike = number | string | null | undefined
type EtokenDbTokenListSort = (typeof ETOKENDB_TOKEN_LIST_SORT_FIELDS)[number]
type EtokenDbTokenListOrder = "asc" | "desc"

type EtokenDbTokenListQueryInput = {
  sort?: unknown
  order?: unknown
  pageSize?: unknown
  readyOnly?: unknown
}

export type EtokenDbTokenListQuery = {
  sort: EtokenDbTokenListSort
  order: EtokenDbTokenListOrder
  pageSize: number
  readyOnly: boolean
}

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
  reviewAverageScore?: NumericLike
  reviewScorerCount?: NumericLike
  reviewCountTotal?: NumericLike
  reviewCommentCountTotal?: NumericLike
  lastReviewAt?: NumericLike
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

export type EtokenDbCandleInterval = "hour" | "day" | "week"

export type EtokenDbTokenCandleRecord = {
  bucketStart?: NumericLike
  bucketEnd?: NumericLike
  openPriceNanosatsPerAtom?: NumericLike
  highPriceNanosatsPerAtom?: NumericLike
  lowPriceNanosatsPerAtom?: NumericLike
  closePriceNanosatsPerAtom?: NumericLike
  tradeCount?: NumericLike
  volumeSats?: NumericLike
  soldAtoms?: NumericLike
}

export type EtokenDbTokenCandlesPayload = {
  ok?: boolean
  data?: {
    tokenId?: string
    interval?: EtokenDbCandleInterval
    timezone?: string
    items?: (EtokenDbTokenCandleRecord | null)[] | null
    [key: string]: unknown
  }
  error?: string
}

export type ReviewInvoiceStatus =
  | "pending"
  | "tx_submitted"
  | "published"
  | "invalid"
  | "expired"

export type ProjectInfoInvoiceStatus = ReviewInvoiceStatus

export type ProjectInfoFeeTier = "initial" | "update"
export type ReviewPaymentKind = "xec" | "token"
export type ReviewPaymentTokenSymbol = "SS" | "SC"

export type CreateEtokenDbReviewInvoiceInput = {
  authorAddress: string
  score: number
  comment?: string
  paymentKind?: ReviewPaymentKind
  paymentTokenSymbol?: ReviewPaymentTokenSymbol
}

export type CreateEtokenDbProjectInfoInvoiceInput = {
  editorAddress: string
  description?: string
  websiteUrl?: string | null
  xUrl?: string | null
  telegramUrl?: string | null
}

export type SubmitEtokenDbReviewInvoiceTxInput = {
  txid: string
}

export type SubmitEtokenDbProjectInfoInvoiceTxInput = {
  txid: string
}

export type EtokenDbReviewInvoice = {
  invoiceId: string
  tokenId: string
  authorAddress: string
  score: number
  comment: string
  paymentAddress: string
  expectedPaidSats: number
  expectedPaidXec: string
  paymentKind: ReviewPaymentKind
  paymentTokenId: string | null
  paymentTokenSymbol: ReviewPaymentTokenSymbol | null
  creditSatsPerAtom: number | null
  expectedPaidAtoms: string | null
  status: ReviewInvoiceStatus
  expiresAt: number
  paymentTxid: string | null
  publishedReviewId: string | null
}

export type EtokenDbTokenProjectInfo = {
  tokenId: string
  description: string
  websiteUrl: string | null
  xUrl: string | null
  telegramUrl: string | null
  createdAt: number
  updatedAt: number
  updateCount: number
  lastEditorMasked: string
}

export type EtokenDbProjectInfoInvoice = {
  invoiceId: string
  tokenId: string
  editorAddress: string
  description: string
  websiteUrl: string | null
  xUrl: string | null
  telegramUrl: string | null
  paymentAddress: string
  expectedPaidSats: number
  expectedPaidXec: string
  feeTier: ProjectInfoFeeTier
  status: ProjectInfoInvoiceStatus
  expiresAt: number
  paymentTxid: string | null
}

export type EtokenDbTokenReviewItem = {
  reviewId: string
  tokenId: string
  authorMasked: string
  score: number
  comment: string
  createdAt: number
}

export type EtokenDbTokenReviewSummary = {
  averageScore: number | null
  scorerCount: number
  reviewCountTotal: number
  commentCountTotal: number
  lastReviewAt: number | null
}

export type EtokenDbReviewInvoicePayload = {
  ok?: boolean
  data?: Partial<EtokenDbReviewInvoice> | null
  error?: string
}

export type EtokenDbTokenProjectInfoPayload = {
  ok?: boolean
  data?: Partial<EtokenDbTokenProjectInfo> | null
  error?: string
}

export type EtokenDbProjectInfoInvoicePayload = {
  ok?: boolean
  data?: Partial<EtokenDbProjectInfoInvoice> | null
  error?: string
}

export type EtokenDbTokenReviewSummaryPayload = {
  ok?: boolean
  data?: Partial<EtokenDbTokenReviewSummary> | null
  error?: string
}

export type EtokenDbPaginatedTokenReviewsPayload = {
  ok?: boolean
  data?: {
    page?: NumericLike
    pageSize?: NumericLike
    total?: NumericLike
    items?: (Partial<EtokenDbTokenReviewItem> | null)[] | null
    [key: string]: unknown
  } | null
  error?: string
}

export type EtokenDbMappedTokenSummary = {
  tokenId: string
  tokenDecimals: number
  recent24hTradeCount: number
  recent7dTradeCount: number
  recent30dTradeCount: number
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
  reviewAverageScore: number | null
  reviewScorerCount: number
  reviewCountTotal: number
  reviewCommentCountTotal: number
  lastReviewAt: number | null
}

export type EtokenDbTopVolumeToken = {
  tokenId: string
  recent24hTradeCount: number
  recent7dTradeCount: number
  recent30dTradeCount: number
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
  reviewAverageScore: number | null
  reviewScorerCount: number
  reviewCountTotal: number
  reviewCommentCountTotal: number
  lastReviewAt: number | null
}

export type EtokenDbMappedTokenCandle = {
  bucketStart: number
  bucketEnd: number
  openPriceXec: number
  highPriceXec: number
  lowPriceXec: number
  closePriceXec: number
  tradeCount: number
  volumeXec: number
  soldTokenAmount: number
}

export type EtokenDbMappedTokenCandles = {
  tokenId: string
  interval: EtokenDbCandleInterval
  timezone: string
  tokenDecimals: number
  items: EtokenDbMappedTokenCandle[]
}

type MapEtokenDbTokenSummaryOptions = {
  decimals?: number
}

type FetchEtokenDbTokenSummaryOptions = {
  decimals?: number
  chronikClient?: ChronikClient
}

type MapEtokenDbTokenCandlesOptions = {
  decimals?: number
}

type FetchEtokenDbTokenCandlesOptions = {
  interval?: EtokenDbCandleInterval
  limit?: number
  decimals?: number
  chronikClient?: ChronikClient
}

type FetchEtokenDbTokenReviewsOptions = {
  page?: number
  pageSize?: number
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

const getTokenListQueryInputValue = (
  input: EtokenDbTokenListQueryInput | URLSearchParams | undefined,
  key: keyof EtokenDbTokenListQueryInput,
): unknown => {
  if (!input) {
    return undefined
  }

  if (input instanceof URLSearchParams) {
    return input.get(key)
  }

  return input[key]
}

const parseTokenListPageSize = (value: unknown): number => {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : ETOKENDB_TOP_VOLUME_PAGE_SIZE

  const finiteValue = Number.isFinite(parsed) ? parsed : ETOKENDB_TOP_VOLUME_PAGE_SIZE
  return Math.min(
    MAX_ETOKENDB_TOKEN_LIST_PAGE_SIZE,
    Math.max(1, Math.trunc(finiteValue)),
  )
}

const parseTokenListSort = (value: unknown): EtokenDbTokenListSort => {
  return typeof value === "string" && ETOKENDB_TOKEN_LIST_SORT_FIELD_SET.has(value)
    ? (value as EtokenDbTokenListSort)
    : "recent1008VolumeSats"
}

const parseTokenListOrder = (value: unknown): EtokenDbTokenListOrder => {
  return value === "asc" ? "asc" : "desc"
}

const parseTokenListReadyOnly = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (normalized === "false" || normalized === "0") {
      return false
    }
    if (normalized === "true" || normalized === "1") {
      return true
    }
  }

  return true
}

export const normalizeEtokenDbTokenListQuery = (
  input?: EtokenDbTokenListQueryInput | URLSearchParams,
): EtokenDbTokenListQuery => ({
  sort: parseTokenListSort(getTokenListQueryInputValue(input, "sort")),
  order: parseTokenListOrder(getTokenListQueryInputValue(input, "order")),
  pageSize: parseTokenListPageSize(getTokenListQueryInputValue(input, "pageSize")),
  readyOnly: parseTokenListReadyOnly(getTokenListQueryInputValue(input, "readyOnly")),
})

export const createEtokenDbTokenListSearchParams = (
  query: EtokenDbTokenListQuery,
): URLSearchParams =>
  new URLSearchParams({
    sort: query.sort,
    order: query.order,
    pageSize: `${query.pageSize}`,
    readyOnly: query.readyOnly ? "true" : "false",
  })

const coerceNullableFiniteNumber = (value: NumericLike): number | null => {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === "string" && value.trim().length === 0) {
    return null
  }

  const coerced = coerceFiniteNumber(value)
  return Number.isFinite(coerced) ? coerced : null
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

export const isValidReviewInvoiceId = (invoiceId: string): boolean => {
  return INVOICE_ID_PATTERN.test(invoiceId)
}

export const isValidProjectInfoInvoiceId = (invoiceId: string): boolean => {
  return INVOICE_ID_PATTERN.test(invoiceId)
}

export const isValidEtokenDbTxid = (txid: string): boolean => {
  return TXID_PATTERN.test(txid)
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
      const payloadError =
        payload && typeof payload === "object" ? (payload as any).error : null
      const message =
        typeof payloadError === "string"
          ? payloadError
          : payloadError &&
              typeof payloadError === "object" &&
              typeof payloadError.message === "string"
            ? typeof payloadError.code === "string"
              ? `${payloadError.code}: ${payloadError.message}`
              : payloadError.message
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
    recent30dTradeCount: coerceCount(summary.recent4320TradeCount),
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
    reviewAverageScore: coerceNullableFiniteNumber(summary.reviewAverageScore),
    reviewScorerCount: coerceCount(summary.reviewScorerCount),
    reviewCountTotal: coerceCount(summary.reviewCountTotal),
    reviewCommentCountTotal: coerceCount(summary.reviewCommentCountTotal),
    lastReviewAt:
      summary.lastReviewAt === null || summary.lastReviewAt === undefined
        ? null
        : coerceCount(summary.lastReviewAt),
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
  const params = createEtokenDbTokenListSearchParams(
    normalizeEtokenDbTokenListQuery(options),
  )

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
      recent30dTradeCount: coerceCount(item?.recent4320TradeCount),
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
      reviewAverageScore: coerceNullableFiniteNumber(item?.reviewAverageScore),
      reviewScorerCount: coerceCount(item?.reviewScorerCount),
      reviewCountTotal: coerceCount(item?.reviewCountTotal),
      reviewCommentCountTotal: coerceCount(item?.reviewCommentCountTotal),
      lastReviewAt:
        item?.lastReviewAt === null || item?.lastReviewAt === undefined
          ? null
          : coerceCount(item?.lastReviewAt),
    })
  })

  return tokens
}

export const mapEtokenDbTokenCandles = (
  payload: EtokenDbTokenCandlesPayload,
  options?: MapEtokenDbTokenCandlesOptions,
): EtokenDbMappedTokenCandles => {
  const data = payload?.data
  const tokenId = data?.tokenId
  const interval = data?.interval
  const timezone = typeof data?.timezone === "string" && data.timezone.length > 0
    ? data.timezone
    : "UTC"
  const tokenDecimals = Math.max(0, Math.trunc(options?.decimals ?? 0))

  if (!payload?.ok || typeof tokenId !== "string" || !interval || !Array.isArray(data?.items)) {
    throw new Error("Invalid etokendb token candles payload")
  }

  const items = data.items.flatMap((item) => {
    const bucketStartSec = coerceCount(item?.bucketStart)
    const bucketEndSec = coerceCount(item?.bucketEnd)

    if (!bucketStartSec || !bucketEndSec) {
      return []
    }

    const openPriceXec = nanosatsPerAtomToXec(item?.openPriceNanosatsPerAtom, tokenDecimals)
    const highPriceXec = nanosatsPerAtomToXec(item?.highPriceNanosatsPerAtom, tokenDecimals)
    const lowPriceXec = nanosatsPerAtomToXec(item?.lowPriceNanosatsPerAtom, tokenDecimals)
    const closePriceXec = nanosatsPerAtomToXec(item?.closePriceNanosatsPerAtom, tokenDecimals)
    const soldAtoms = coerceFiniteNumber(item?.soldAtoms)
    const soldTokenAmount =
      tokenDecimals > 0 ? soldAtoms / Math.pow(10, tokenDecimals) : soldAtoms

    return [
      {
        bucketStart: bucketStartSec * 1000,
        bucketEnd: bucketEndSec * 1000,
        openPriceXec,
        highPriceXec,
        lowPriceXec,
        closePriceXec,
        tradeCount: coerceCount(item?.tradeCount),
        volumeXec: satsToXec(item?.volumeSats),
        soldTokenAmount: Number.isFinite(soldTokenAmount) ? soldTokenAmount : 0,
      },
    ]
  })

  return {
    tokenId,
    interval,
    timezone,
    tokenDecimals,
    items,
  }
}

export const fetchEtokenDbTokenCandles = async (
  tokenId: string,
  options?: FetchEtokenDbTokenCandlesOptions,
): Promise<EtokenDbMappedTokenCandles> => {
  if (!isValidEtokenDbTokenId(tokenId)) {
    throw new Error("Invalid tokenId")
  }

  const interval = options?.interval ?? "day"
  const limit = Math.min(200, Math.max(1, Math.trunc(options?.limit ?? 200)))
  const params = new URLSearchParams({
    interval,
    limit: `${limit}`,
  })
  const payload = await fetchJsonWithTimeout<EtokenDbTokenCandlesPayload>(
    `${ETOKENDB_TOKENS_API_BASE_PATH}/${encodeURIComponent(tokenId)}/candles?${params.toString()}`,
    TOKEN_CANDLES_TIMEOUT_MS,
  )

  const decimals =
    typeof options?.decimals === "number"
      ? options.decimals
      : await resolveTokenDecimals(tokenId, options?.chronikClient)

  return mapEtokenDbTokenCandles(payload, { decimals })
}

export const mapEtokenDbTokenReviewSummary = (
  payload: EtokenDbTokenReviewSummaryPayload,
): EtokenDbTokenReviewSummary => {
  const summary = payload?.data

  if (!payload?.ok || !summary || typeof summary !== "object") {
    throw new Error("Invalid etokendb token review summary payload")
  }

  return {
    averageScore: coerceNullableFiniteNumber(summary.averageScore),
    scorerCount: coerceCount(summary.scorerCount),
    reviewCountTotal: coerceCount(summary.reviewCountTotal),
    commentCountTotal: coerceCount(summary.commentCountTotal),
    lastReviewAt:
      summary.lastReviewAt === null || summary.lastReviewAt === undefined
        ? null
        : coerceCount(summary.lastReviewAt),
  }
}

export const fetchEtokenDbTokenReviewSummary = async (
  tokenId: string,
): Promise<EtokenDbTokenReviewSummary> => {
  if (!isValidEtokenDbTokenId(tokenId)) {
    throw new Error("Invalid tokenId")
  }

  const payload = await fetchJsonWithTimeout<EtokenDbTokenReviewSummaryPayload>(
    `${ETOKENDB_TOKENS_API_BASE_PATH}/${encodeURIComponent(tokenId)}/reviews/summary`,
    TOKEN_REVIEWS_TIMEOUT_MS,
  )

  return mapEtokenDbTokenReviewSummary(payload)
}

export const mapEtokenDbTokenProjectInfo = (
  payload: EtokenDbTokenProjectInfoPayload,
): EtokenDbTokenProjectInfo | null => {
  const info = payload?.data

  if (!payload?.ok) {
    throw new Error("Invalid etokendb token project info payload")
  }

  if (info === null || info === undefined) {
    return null
  }

  if (
    typeof info.tokenId !== "string" ||
    typeof info.description !== "string" ||
    typeof info.createdAt === "undefined" ||
    typeof info.updatedAt === "undefined"
  ) {
    throw new Error("Invalid etokendb token project info payload")
  }

  return {
    tokenId: info.tokenId,
    description: info.description,
    websiteUrl:
      typeof info.websiteUrl === "string" && info.websiteUrl.length > 0
        ? info.websiteUrl
        : null,
    xUrl:
      typeof info.xUrl === "string" && info.xUrl.length > 0
        ? info.xUrl
        : null,
    telegramUrl:
      typeof info.telegramUrl === "string" && info.telegramUrl.length > 0
        ? info.telegramUrl
        : null,
    createdAt: coerceCount(info.createdAt),
    updatedAt: coerceCount(info.updatedAt),
    updateCount: coerceCount(info.updateCount),
    lastEditorMasked:
      typeof info.lastEditorMasked === "string" ? info.lastEditorMasked : "",
  }
}

export const fetchEtokenDbTokenProjectInfo = async (
  tokenId: string,
): Promise<EtokenDbTokenProjectInfo | null> => {
  if (!isValidEtokenDbTokenId(tokenId)) {
    throw new Error("Invalid tokenId")
  }

  const payload = await fetchJsonWithTimeout<EtokenDbTokenProjectInfoPayload>(
    `${ETOKENDB_TOKENS_API_BASE_PATH}/${encodeURIComponent(tokenId)}/project-info`,
    TOKEN_PROJECT_INFO_TIMEOUT_MS,
  )

  return mapEtokenDbTokenProjectInfo(payload)
}

export const mapEtokenDbProjectInfoInvoice = (
  payload: EtokenDbProjectInfoInvoicePayload,
): EtokenDbProjectInfoInvoice => {
  const invoice = payload?.data

  if (
    !payload?.ok ||
    !invoice ||
    typeof invoice.invoiceId !== "string" ||
    typeof invoice.tokenId !== "string" ||
    typeof invoice.editorAddress !== "string" ||
    typeof invoice.description !== "string" ||
    typeof invoice.paymentAddress !== "string" ||
    typeof invoice.expectedPaidXec !== "string" ||
    typeof invoice.feeTier !== "string" ||
    typeof invoice.status !== "string"
  ) {
    throw new Error("Invalid etokendb project info invoice payload")
  }

  return {
    invoiceId: invoice.invoiceId,
    tokenId: invoice.tokenId,
    editorAddress: invoice.editorAddress,
    description: invoice.description,
    websiteUrl:
      typeof invoice.websiteUrl === "string" && invoice.websiteUrl.length > 0
        ? invoice.websiteUrl
        : null,
    xUrl:
      typeof invoice.xUrl === "string" && invoice.xUrl.length > 0
        ? invoice.xUrl
        : null,
    telegramUrl:
      typeof invoice.telegramUrl === "string" && invoice.telegramUrl.length > 0
        ? invoice.telegramUrl
        : null,
    paymentAddress: invoice.paymentAddress,
    expectedPaidSats: coerceCount(invoice.expectedPaidSats),
    expectedPaidXec: invoice.expectedPaidXec,
    feeTier: invoice.feeTier as ProjectInfoFeeTier,
    status: invoice.status as ProjectInfoInvoiceStatus,
    expiresAt: coerceCount(invoice.expiresAt),
    paymentTxid:
      typeof invoice.paymentTxid === "string" && invoice.paymentTxid.length > 0
        ? invoice.paymentTxid
        : null,
  }
}

export const createEtokenDbProjectInfoInvoice = async (
  tokenId: string,
  input: CreateEtokenDbProjectInfoInvoiceInput,
): Promise<EtokenDbProjectInfoInvoice> => {
  if (!isValidEtokenDbTokenId(tokenId)) {
    throw new Error("Invalid tokenId")
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TOKEN_PROJECT_INFO_TIMEOUT_MS)

  try {
    const response = await fetch(
      `${ETOKENDB_TOKENS_API_BASE_PATH}/${encodeURIComponent(tokenId)}/project-info/invoices`,
      {
        method: "POST",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      },
    )

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

    return mapEtokenDbProjectInfoInvoice(payload as EtokenDbProjectInfoInvoicePayload)
  } finally {
    clearTimeout(timeoutId)
  }
}

export const fetchEtokenDbProjectInfoInvoice = async (
  invoiceId: string,
): Promise<EtokenDbProjectInfoInvoice> => {
  if (!isValidProjectInfoInvoiceId(invoiceId)) {
    throw new Error("Invalid invoiceId")
  }

  const payload = await fetchJsonWithTimeout<EtokenDbProjectInfoInvoicePayload>(
    `${ETOKENDB_API_BASE_PATH}/project-info-invoices/${encodeURIComponent(invoiceId)}`,
    TOKEN_PROJECT_INFO_TIMEOUT_MS,
  )

  return mapEtokenDbProjectInfoInvoice(payload)
}

export const submitEtokenDbProjectInfoInvoiceTx = async (
  invoiceId: string,
  input: SubmitEtokenDbProjectInfoInvoiceTxInput,
): Promise<EtokenDbProjectInfoInvoice> => {
  if (!isValidProjectInfoInvoiceId(invoiceId)) {
    throw new Error("Invalid invoiceId")
  }
  if (!isValidEtokenDbTxid(input.txid)) {
    throw new Error("Invalid txid")
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TOKEN_PROJECT_INFO_TIMEOUT_MS)

  try {
    const response = await fetch(
      `${ETOKENDB_API_BASE_PATH}/project-info-invoices/${encodeURIComponent(invoiceId)}/submit-tx`,
      {
        method: "POST",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      },
    )

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

    return mapEtokenDbProjectInfoInvoice(payload as EtokenDbProjectInfoInvoicePayload)
  } finally {
    clearTimeout(timeoutId)
  }
}

export const mapEtokenDbReviewInvoice = (
  payload: EtokenDbReviewInvoicePayload,
): EtokenDbReviewInvoice => {
  const invoice = payload?.data

  if (
    !payload?.ok ||
    !invoice ||
    typeof invoice.invoiceId !== "string" ||
    typeof invoice.tokenId !== "string" ||
    typeof invoice.authorAddress !== "string" ||
    typeof invoice.paymentAddress !== "string" ||
    typeof invoice.expectedPaidXec !== "string" ||
    typeof invoice.status !== "string"
  ) {
    throw new Error("Invalid etokendb review invoice payload")
  }

  return {
    invoiceId: invoice.invoiceId,
    tokenId: invoice.tokenId,
    authorAddress: invoice.authorAddress,
    score: coerceCount(invoice.score),
    comment: typeof invoice.comment === "string" ? invoice.comment : "",
    paymentAddress: invoice.paymentAddress,
    expectedPaidSats: coerceCount(invoice.expectedPaidSats),
    expectedPaidXec: invoice.expectedPaidXec,
    paymentKind: invoice.paymentKind === "token" ? "token" : "xec",
    paymentTokenId:
      typeof invoice.paymentTokenId === "string" && invoice.paymentTokenId.length > 0
        ? invoice.paymentTokenId
        : null,
    paymentTokenSymbol:
      invoice.paymentTokenSymbol === "SS" || invoice.paymentTokenSymbol === "SC"
        ? invoice.paymentTokenSymbol
        : null,
    creditSatsPerAtom:
      invoice.creditSatsPerAtom === null || invoice.creditSatsPerAtom === undefined
        ? null
        : coerceCount(invoice.creditSatsPerAtom),
    expectedPaidAtoms:
      typeof invoice.expectedPaidAtoms === "string" && invoice.expectedPaidAtoms.length > 0
        ? invoice.expectedPaidAtoms
        : null,
    status: invoice.status as ReviewInvoiceStatus,
    expiresAt: coerceCount(invoice.expiresAt),
    paymentTxid:
      typeof invoice.paymentTxid === "string" && invoice.paymentTxid.length > 0
        ? invoice.paymentTxid
        : null,
    publishedReviewId:
      typeof invoice.publishedReviewId === "string" && invoice.publishedReviewId.length > 0
        ? invoice.publishedReviewId
        : null,
  }
}

export const createEtokenDbReviewInvoice = async (
  tokenId: string,
  input: CreateEtokenDbReviewInvoiceInput,
): Promise<EtokenDbReviewInvoice> => {
  if (!isValidEtokenDbTokenId(tokenId)) {
    throw new Error("Invalid tokenId")
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TOKEN_REVIEWS_TIMEOUT_MS)

  try {
    const response = await fetch(
      `${ETOKENDB_TOKENS_API_BASE_PATH}/${encodeURIComponent(tokenId)}/reviews/invoices`,
      {
        method: "POST",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      },
    )

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

    return mapEtokenDbReviewInvoice(payload as EtokenDbReviewInvoicePayload)
  } finally {
    clearTimeout(timeoutId)
  }
}

export const fetchEtokenDbReviewInvoice = async (
  invoiceId: string,
): Promise<EtokenDbReviewInvoice> => {
  if (!isValidReviewInvoiceId(invoiceId)) {
    throw new Error("Invalid invoiceId")
  }

  const payload = await fetchJsonWithTimeout<EtokenDbReviewInvoicePayload>(
    `${ETOKENDB_API_BASE_PATH}/review-invoices/${encodeURIComponent(invoiceId)}`,
    TOKEN_REVIEWS_TIMEOUT_MS,
  )

  return mapEtokenDbReviewInvoice(payload)
}

export const submitEtokenDbReviewInvoiceTx = async (
  invoiceId: string,
  input: SubmitEtokenDbReviewInvoiceTxInput,
): Promise<EtokenDbReviewInvoice> => {
  if (!isValidReviewInvoiceId(invoiceId)) {
    throw new Error("Invalid invoiceId")
  }
  if (!isValidEtokenDbTxid(input.txid)) {
    throw new Error("Invalid txid")
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TOKEN_REVIEWS_TIMEOUT_MS)

  try {
    const response = await fetch(
      `${ETOKENDB_API_BASE_PATH}/review-invoices/${encodeURIComponent(invoiceId)}/submit-tx`,
      {
        method: "POST",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      },
    )

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

    return mapEtokenDbReviewInvoice(payload as EtokenDbReviewInvoicePayload)
  } finally {
    clearTimeout(timeoutId)
  }
}

export const fetchEtokenDbTokenReviews = async (
  tokenId: string,
  options?: FetchEtokenDbTokenReviewsOptions,
): Promise<{
  page: number
  pageSize: number
  total: number
  items: EtokenDbTokenReviewItem[]
}> => {
  if (!isValidEtokenDbTokenId(tokenId)) {
    throw new Error("Invalid tokenId")
  }

  const page = Math.max(1, Math.trunc(options?.page ?? 1))
  const pageSize = Math.min(200, Math.max(1, Math.trunc(options?.pageSize ?? 20)))
  const params = new URLSearchParams({
    page: `${page}`,
    pageSize: `${pageSize}`,
  })

  const payload = await fetchJsonWithTimeout<EtokenDbPaginatedTokenReviewsPayload>(
    `${ETOKENDB_TOKENS_API_BASE_PATH}/${encodeURIComponent(tokenId)}/reviews?${params.toString()}`,
    TOKEN_REVIEWS_TIMEOUT_MS,
  )

  if (!payload?.ok || !payload.data || !Array.isArray(payload.data.items)) {
    throw new Error("Invalid etokendb token reviews payload")
  }

  return {
    page: coerceCount(payload.data.page) || page,
    pageSize: coerceCount(payload.data.pageSize) || pageSize,
    total: coerceCount(payload.data.total),
    items: payload.data.items.flatMap((item) => {
      if (
        !item ||
        typeof item.reviewId !== "string" ||
        typeof item.tokenId !== "string" ||
        typeof item.authorMasked !== "string"
      ) {
        return []
      }

      return [
        {
          reviewId: item.reviewId,
          tokenId: item.tokenId,
          authorMasked: item.authorMasked,
          score: coerceCount(item.score),
          comment: typeof item.comment === "string" ? item.comment : "",
          createdAt: coerceCount(item.createdAt),
        },
      ]
    }),
  }
}
