import { isValidEtokenDbTokenId } from "@/lib/etokendb"

type NumericLike = number | string | null | undefined

export const ANALYTICS_HOURS_OPTIONS = [24, 168, 720] as const
export type AnalyticsHours = (typeof ANALYTICS_HOURS_OPTIONS)[number]

export const ANALYTICS_WINDOW_PRESETS = [
  { value: "24h", label: "24h", hours: 24 },
  { value: "7d", label: "7d", hours: 168 },
  { value: "30d", label: "30d", hours: 720 },
] as const

export type AnalyticsWindowPreset = (typeof ANALYTICS_WINDOW_PRESETS)[number]["value"]

export const ANALYTICS_ROUTE_LABELS = {
  status: "Status Panel",
  "tokens.list": "Home / Token Table",
  "tokens.detail": "Token Detail Pages",
  "tokens.trades": "Token Trade History",
  "tokens.candles": "Token Candle Charts",
  "trades.list": "Global Trades Feed",
} as const

export const ANALYTICS_ROUTE_DESCRIPTIONS = {
  status: "Service status and health checks shown in the UI.",
  "tokens.list": "Opening the home page loads the token table and counts as a homepage view proxy.",
  "tokens.detail": "Successful token detail page loads act like token page views.",
  "tokens.trades": "Trade history panels and token trade tabs.",
  "tokens.candles": "Chart and candle widgets for token pages.",
  "trades.list": "Global trades views and feed-like traffic.",
} as const

export type AnalyticsRouteKey = keyof typeof ANALYTICS_ROUTE_LABELS

export type AnalyticsAccessBucket = {
  bucketStart: number
  bucketEnd: number
  accessCount: number
  successCount: number
  clientErrorCount: number
  serverErrorCount: number
}

export type AnalyticsVisitBucket = {
  bucketStart: number
  bucketEnd: number
  visitCount: number
}

export type AnalyticsEndpointRow = {
  routeKey: AnalyticsRouteKey
  routeLabel: string
  accessCountTotal: number
  accessCountWindow: number
  successCountTotal: number
  successCountWindow: number
  clientErrorCountTotal: number
  clientErrorCountWindow: number
  serverErrorCountTotal: number
  serverErrorCountWindow: number
  lastAccessedAt: number | null
  successRate: number
}

export type AnalyticsTokenRow = {
  tokenId: string
  visitCountTotal: number
  visitCount24h: number
  lastVisitedAt: number | null
}

export type AnalyticsOverview = {
  hours: AnalyticsHours
  windowStart: number | null
  windowEnd: number | null
  apiAccessCountTotal: number
  apiAccessCountWindow: number
  tokenVisitCountTotal: number
  tokenVisitCountWindow: number
  successRate: number
  activeEndpointCount: number
}

export type AnalyticsStatusSummary = {
  healthy: boolean
  ready: boolean
  phase: string | null
  lastTipUpdateAt: string | null
  lastDiscoveryAt: string | null
  lastError: string | null
}

export type AnalyticsDashboard = {
  status: AnalyticsStatusSummary | null
  overview: AnalyticsOverview
  apiAccessBuckets: AnalyticsAccessBucket[]
  tokenVisitBuckets: AnalyticsVisitBucket[]
  endpoints: AnalyticsEndpointRow[]
  tokens: AnalyticsTokenRow[]
  warnings: string[]
  generatedAt: string
}

export type AnalyticsEndpointDetail = AnalyticsEndpointRow & {
  hours: AnalyticsHours
  windowStart: number | null
  windowEnd: number | null
  buckets: AnalyticsAccessBucket[]
}

export type AnalyticsTokenDetail = {
  tokenId: string
  hours: AnalyticsHours
  windowStart: number | null
  windowEnd: number | null
  visitCountTotal: number
  visitCount24h: number
  lastVisitedAt: number | null
  visitCountWindow: number
  buckets: AnalyticsVisitBucket[]
}

const DEFAULT_ANALYTICS_HOURS: AnalyticsHours = 168

const hasValue = (value: unknown): boolean => {
  return value !== null && value !== undefined && `${value}`.trim().length > 0
}

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

const coerceTimestamp = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.trunc(value) : 0
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) {
      return 0
    }

    const numericValue = Number(trimmed)
    if (Number.isFinite(numericValue)) {
      return Math.trunc(numericValue)
    }

    const timestamp = Date.parse(trimmed)
    return Number.isFinite(timestamp) ? timestamp : 0
  }

  return 0
}

const coerceNullableTimestamp = (value: unknown): number | null => {
  if (!hasValue(value)) {
    return null
  }

  const timestamp = coerceTimestamp(value)
  return timestamp > 0 ? timestamp : null
}

const coerceDisplayTimestamp = (value: unknown): string | null => {
  if (!hasValue(value)) {
    return null
  }

  if (typeof value === "string") {
    return value.trim() || null
  }

  const timestamp = coerceTimestamp(value)
  return timestamp > 0 ? new Date(timestamp).toISOString() : null
}

const assertOkEnvelope = (payload: unknown, message: string): any => {
  if (!payload || typeof payload !== "object" || !(payload as any).ok) {
    throw new Error(message)
  }

  const data = (payload as any).data
  if (!data || typeof data !== "object") {
    throw new Error(message)
  }

  return data
}

export const getAnalyticsRouteLabel = (routeKey: string): string => {
  return ANALYTICS_ROUTE_LABELS[routeKey as AnalyticsRouteKey] ?? routeKey
}

export const getAnalyticsRouteDescription = (routeKey: string): string => {
  return ANALYTICS_ROUTE_DESCRIPTIONS[routeKey as AnalyticsRouteKey] ?? "Tracked traffic source."
}

export const isAnalyticsRouteKey = (routeKey: string): routeKey is AnalyticsRouteKey => {
  return Object.prototype.hasOwnProperty.call(ANALYTICS_ROUTE_LABELS, routeKey)
}

export const getAnalyticsHours = (value?: string | null): AnalyticsHours => {
  if (!hasValue(value)) {
    return DEFAULT_ANALYTICS_HOURS
  }

  const parsed = Number(value)
  if (ANALYTICS_HOURS_OPTIONS.includes(parsed as AnalyticsHours)) {
    return parsed as AnalyticsHours
  }

  throw new Error("hours must be one of 24, 168, or 720")
}

export const hoursToWindowPreset = (hours: AnalyticsHours): AnalyticsWindowPreset => {
  const preset = ANALYTICS_WINDOW_PRESETS.find((item) => item.hours === hours)
  return preset?.value ?? "7d"
}

export const windowPresetToHours = (preset: AnalyticsWindowPreset): AnalyticsHours => {
  const match = ANALYTICS_WINDOW_PRESETS.find((item) => item.value === preset)
  return match?.hours ?? DEFAULT_ANALYTICS_HOURS
}

export const buildSuccessRate = (successCount: number, totalCount: number): number => {
  if (!Number.isFinite(successCount) || !Number.isFinite(totalCount) || totalCount <= 0) {
    return 0
  }

  return Number(((successCount / totalCount) * 100).toFixed(1))
}

const normalizeAccessBucket = (entry: any): AnalyticsAccessBucket => {
  return {
    bucketStart: coerceTimestamp(entry?.bucketStart),
    bucketEnd: coerceTimestamp(entry?.bucketEnd),
    accessCount: coerceCount(entry?.accessCount),
    successCount: coerceCount(entry?.successCount),
    clientErrorCount: coerceCount(entry?.clientErrorCount),
    serverErrorCount: coerceCount(entry?.serverErrorCount),
  }
}

const normalizeVisitBucket = (entry: any): AnalyticsVisitBucket => {
  return {
    bucketStart: coerceTimestamp(entry?.bucketStart),
    bucketEnd: coerceTimestamp(entry?.bucketEnd),
    visitCount: coerceCount(entry?.visitCount),
  }
}

const normalizeEndpointRow = (entry: any): AnalyticsEndpointRow => {
  const routeKey = `${entry?.routeKey ?? ""}`.trim()
  if (!isAnalyticsRouteKey(routeKey)) {
    throw new Error("Invalid analytics route key")
  }

  const accessCountWindow = coerceCount(entry?.accessCountWindow)
  const successCountWindow = coerceCount(entry?.successCountWindow)

  return {
    routeKey,
    routeLabel: getAnalyticsRouteLabel(routeKey),
    accessCountTotal: coerceCount(entry?.accessCountTotal),
    accessCountWindow,
    successCountTotal: coerceCount(entry?.successCountTotal),
    successCountWindow,
    clientErrorCountTotal: coerceCount(entry?.clientErrorCountTotal),
    clientErrorCountWindow: coerceCount(entry?.clientErrorCountWindow),
    serverErrorCountTotal: coerceCount(entry?.serverErrorCountTotal),
    serverErrorCountWindow: coerceCount(entry?.serverErrorCountWindow),
    lastAccessedAt: coerceNullableTimestamp(entry?.lastAccessedAt),
    successRate: buildSuccessRate(successCountWindow, accessCountWindow),
  }
}

const normalizeTokenRow = (entry: any): AnalyticsTokenRow => {
  const tokenId = `${entry?.tokenId ?? ""}`.trim()
  if (!isValidEtokenDbTokenId(tokenId)) {
    throw new Error("Invalid analytics token id")
  }

  return {
    tokenId,
    visitCountTotal: coerceCount(entry?.visitCountTotal),
    visitCount24h: coerceCount(entry?.visitCount24h),
    lastVisitedAt: coerceNullableTimestamp(entry?.lastVisitedAt),
  }
}

export const normalizeAnalyticsSummaryPayload = (
  payload: unknown,
  hours: AnalyticsHours,
): {
  hours: AnalyticsHours
  windowStart: number | null
  windowEnd: number | null
  apiAccessCountTotal: number
  apiAccessCountWindow: number
  apiAccessBuckets: AnalyticsAccessBucket[]
  tokenVisitCountTotal: number
  tokenVisitCountWindow: number
  tokenVisitBuckets: AnalyticsVisitBucket[]
} => {
  const data = assertOkEnvelope(payload, "Invalid analytics summary payload")

  return {
    hours: getAnalyticsHours(`${data.hours ?? hours}`),
    windowStart: coerceNullableTimestamp(data.windowStart),
    windowEnd: coerceNullableTimestamp(data.windowEnd),
    apiAccessCountTotal: coerceCount(data.apiAccessCountTotal),
    apiAccessCountWindow: coerceCount(data.apiAccessCountWindow),
    apiAccessBuckets: Array.isArray(data.apiAccessBuckets)
      ? data.apiAccessBuckets.map(normalizeAccessBucket)
      : [],
    tokenVisitCountTotal: coerceCount(data.tokenVisitCountTotal),
    tokenVisitCountWindow: coerceCount(data.tokenVisitCountWindow),
    tokenVisitBuckets: Array.isArray(data.tokenVisitBuckets)
      ? data.tokenVisitBuckets.map(normalizeVisitBucket)
      : [],
  }
}

export const normalizeAnalyticsEndpointListPayload = (
  payload: unknown,
): AnalyticsEndpointRow[] => {
  const data = assertOkEnvelope(payload, "Invalid analytics endpoint list payload")
  const items = Array.isArray((data as any).items)
    ? (data as any).items
    : Array.isArray(data)
      ? data
      : null

  if (!items) {
    throw new Error("Invalid analytics endpoint list payload")
  }

  const rows: AnalyticsEndpointRow[] = items.map(normalizeEndpointRow)
  return rows.sort((left, right) => right.accessCountWindow - left.accessCountWindow)
}

export const normalizeAnalyticsEndpointDetailPayload = (
  payload: unknown,
  routeKey: AnalyticsRouteKey,
  hours: AnalyticsHours,
): AnalyticsEndpointDetail => {
  const data = assertOkEnvelope(payload, "Invalid analytics endpoint detail payload")
  const detail = normalizeEndpointRow({
    ...data,
    routeKey,
  })

  return {
    ...detail,
    hours: getAnalyticsHours(`${data.hours ?? hours}`),
    windowStart: coerceNullableTimestamp(data.windowStart),
    windowEnd: coerceNullableTimestamp(data.windowEnd),
    buckets: Array.isArray(data.buckets) ? data.buckets.map(normalizeAccessBucket) : [],
  }
}

export const normalizeAnalyticsTokenListPayload = (payload: unknown): AnalyticsTokenRow[] => {
  const data = assertOkEnvelope(payload, "Invalid analytics token list payload")
  const items = Array.isArray((data as any).items)
    ? (data as any).items
    : Array.isArray(data)
      ? data
      : null

  if (!items) {
    throw new Error("Invalid analytics token list payload")
  }

  const rows: AnalyticsTokenRow[] = items.map(normalizeTokenRow)
  return rows.sort((left, right) => right.visitCount24h - left.visitCount24h)
}

export const normalizeAnalyticsTokenDetailPayload = (
  payload: unknown,
  tokenId: string,
  hours: AnalyticsHours,
): AnalyticsTokenDetail => {
  const data = assertOkEnvelope(payload, "Invalid analytics token detail payload")
  const resolvedTokenId = `${data.tokenId ?? tokenId}`.trim()
  if (!isValidEtokenDbTokenId(resolvedTokenId)) {
    throw new Error("Invalid analytics token detail payload")
  }

  return {
    tokenId: resolvedTokenId,
    hours: getAnalyticsHours(`${data.hours ?? hours}`),
    windowStart: coerceNullableTimestamp(data.windowStart),
    windowEnd: coerceNullableTimestamp(data.windowEnd),
    visitCountTotal: coerceCount(data.visitCountTotal),
    visitCount24h: coerceCount(data.visitCount24h),
    lastVisitedAt: coerceNullableTimestamp(data.lastVisitedAt),
    visitCountWindow: coerceCount(data.visitCountWindow),
    buckets: Array.isArray(data.buckets) ? data.buckets.map(normalizeVisitBucket) : [],
  }
}

export const normalizeAnalyticsStatusPayload = (
  payload: unknown,
): AnalyticsStatusSummary => {
  const data = assertOkEnvelope(payload, "Invalid etokendb status payload")

  return {
    healthy: Boolean(data.healthy),
    ready: Boolean(data.ready),
    phase: typeof data.phase === "string" ? data.phase : null,
    lastTipUpdateAt: coerceDisplayTimestamp(data.lastTipUpdateAt),
    lastDiscoveryAt: coerceDisplayTimestamp(data.lastDiscoveryAt),
    lastError: typeof data.lastError === "string" && data.lastError.trim() ? data.lastError : null,
  }
}

export const buildAnalyticsDashboard = (params: {
  summary: ReturnType<typeof normalizeAnalyticsSummaryPayload>
  endpoints: AnalyticsEndpointRow[]
  tokens: AnalyticsTokenRow[]
  status: AnalyticsStatusSummary | null
  warnings?: string[]
  generatedAt?: string
}): AnalyticsDashboard => {
  const { summary, endpoints, tokens, status } = params

  return {
    status,
    overview: {
      hours: summary.hours,
      windowStart: summary.windowStart,
      windowEnd: summary.windowEnd,
      apiAccessCountTotal: summary.apiAccessCountTotal,
      apiAccessCountWindow: summary.apiAccessCountWindow,
      tokenVisitCountTotal: summary.tokenVisitCountTotal,
      tokenVisitCountWindow: summary.tokenVisitCountWindow,
      successRate: buildSuccessRate(
        summary.apiAccessBuckets.reduce((sum, bucket) => sum + bucket.successCount, 0),
        summary.apiAccessBuckets.reduce((sum, bucket) => sum + bucket.accessCount, 0),
      ),
      activeEndpointCount: endpoints.filter((item) => item.accessCountWindow > 0).length,
    },
    apiAccessBuckets: summary.apiAccessBuckets,
    tokenVisitBuckets: summary.tokenVisitBuckets,
    endpoints,
    tokens,
    warnings: params.warnings ?? [],
    generatedAt: params.generatedAt ?? new Date().toISOString(),
  }
}
