"use client"

import Link from "next/link"
import { useEffect, useId, useMemo, useState } from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { ArrowUpRight } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { fetchTokenDetails, getCachedTokenDetails } from "@/lib/chronik"
import {
  type AnalyticsAccessBucket,
  type AnalyticsDashboard,
  type AnalyticsEndpointDetail,
  type AnalyticsVisitBucket,
  type AnalyticsWindowPreset,
  windowPresetToHours,
} from "@/lib/etokendb-analytics"

type ApiResponse<T> = {
  ok?: boolean
  data?: T
  error?: string
}

type LoadState<T> = {
  data: T | null
  error: string | null
  isLoading: boolean
}

type TokenNameRecord = {
  name: string
  symbol: string | null
}

type VisitorPoint = {
  bucketStart: number
  bucketEnd: number
  visitors: number
  homeViews: number
  tokenViews: number
}

type VisitorPageRow = {
  key: string
  href: string
  title: string
  subtitle: string
  total: number
  lastSeen: number | null
  symbol: string | null
  tokenId: string | null
  kind: "home" | "token"
}

const WINDOW_OPTIONS: Array<{
  value: AnalyticsWindowPreset
  label: string
}> = [
  { value: "24h", label: "24H" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
]

const CHART_CONFIG = {
  homeViews: {
    label: "Home",
    color: "hsl(var(--chart-1))",
  },
  tokenViews: {
    label: "Token Pages",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

async function fetchJson<T>(input: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    signal,
    headers: {
      Accept: "application/json",
    },
  })
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null

  if (!response.ok || !payload?.ok || !payload.data) {
    throw new Error(payload?.error || `Request failed with status ${response.status}`)
  }

  return payload.data
}

function formatCount(value: number): string {
  return value.toLocaleString("en-US")
}

function formatDateTime(value: number | string | null | undefined): string {
  if (!value && value !== 0) {
    return "--"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "--"
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatWindowRange(
  start: number | null | undefined,
  end: number | null | undefined,
): string {
  if (!start || !end) {
    return ""
  }

  const startDate = new Date(start)
  const endDate = new Date(end)

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return ""
  }

  return `${startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} - ${endDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`
}

function shortenTokenId(tokenId: string): string {
  return `${tokenId.slice(0, 8)}...${tokenId.slice(-8)}`
}

function getTokenIconUrl(tokenId: string): string {
  return `https://icons.etokens.cash/64/${tokenId}.png`
}

function getTokenDisplay(details: unknown, tokenId: string): TokenNameRecord {
  const genesisInfo = (details as any)?.genesisInfo
  const name =
    (typeof genesisInfo?.tokenName === "string" && genesisInfo.tokenName.trim()) ||
    (typeof genesisInfo?.tokenTicker === "string" && genesisInfo.tokenTicker.trim()) ||
    shortenTokenId(tokenId)
  const symbol =
    typeof genesisInfo?.tokenTicker === "string" && genesisInfo.tokenTicker.trim()
      ? genesisInfo.tokenTicker.trim()
      : null

  return {
    name,
    symbol,
  }
}

function buildVisitorSeries(
  homeBuckets: AnalyticsAccessBucket[],
  tokenBuckets: AnalyticsVisitBucket[],
): VisitorPoint[] {
  const bucketMap = new Map<number, VisitorPoint>()

  const ensureBucket = (bucketStart: number, bucketEnd: number): VisitorPoint => {
    const existing = bucketMap.get(bucketStart)
    if (existing) {
      return existing
    }

    const point: VisitorPoint = {
      bucketStart,
      bucketEnd,
      visitors: 0,
      homeViews: 0,
      tokenViews: 0,
    }
    bucketMap.set(bucketStart, point)
    return point
  }

  homeBuckets.forEach((bucket) => {
    const point = ensureBucket(bucket.bucketStart, bucket.bucketEnd)
    point.homeViews = bucket.accessCount
    point.visitors = point.homeViews + point.tokenViews
  })

  tokenBuckets.forEach((bucket) => {
    const point = ensureBucket(bucket.bucketStart, bucket.bucketEnd)
    point.tokenViews = bucket.visitCount
    point.visitors = point.homeViews + point.tokenViews
  })

  return [...bucketMap.values()].sort((left, right) => left.bucketStart - right.bucketStart)
}

function Metric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="text-3xl font-semibold tracking-tight leading-tight">{value}</div>
    </div>
  )
}

function MetricSkeleton() {
  return <Skeleton className="h-16 rounded-xl" />
}

export default function AnalyticsDashboard() {
  const [windowPreset, setWindowPreset] = useState<AnalyticsWindowPreset>("7d")
  const [dashboardState, setDashboardState] = useState<LoadState<AnalyticsDashboard>>({
    data: null,
    error: null,
    isLoading: true,
  })
  const [homeViewsState, setHomeViewsState] = useState<LoadState<AnalyticsEndpointDetail>>({
    data: null,
    error: null,
    isLoading: true,
  })
  const [tokenNames, setTokenNames] = useState<Record<string, TokenNameRecord>>({})

  const hours = windowPresetToHours(windowPreset)
  const gradientId = useId().replace(/:/g, "")

  useEffect(() => {
    const dashboardController = new AbortController()
    const homeController = new AbortController()

    setDashboardState((current) => ({
      data: current.data,
      error: null,
      isLoading: true,
    }))
    setHomeViewsState((current) => ({
      data: current.data,
      error: null,
      isLoading: true,
    }))

    void fetchJson<AnalyticsDashboard>(
      `/api/etokendb/analytics/dashboard?hours=${hours}`,
      dashboardController.signal,
    )
      .then((data) => {
        setDashboardState({
          data,
          error: null,
          isLoading: false,
        })
      })
      .catch((error) => {
        if (dashboardController.signal.aborted) {
          return
        }

        setDashboardState({
          data: null,
          error: error instanceof Error ? error.message : "Failed to load visitors",
          isLoading: false,
        })
      })

    void fetchJson<AnalyticsEndpointDetail>(
      `/api/etokendb/analytics/endpoints/tokens.list?hours=${hours}`,
      homeController.signal,
    )
      .then((data) => {
        setHomeViewsState({
          data,
          error: null,
          isLoading: false,
        })
      })
      .catch((error) => {
        if (homeController.signal.aborted) {
          return
        }

        setHomeViewsState({
          data: null,
          error: error instanceof Error ? error.message : "Failed to load homepage traffic",
          isLoading: false,
        })
      })

    return () => {
      dashboardController.abort()
      homeController.abort()
    }
  }, [hours])

  const topTokenIds = useMemo(
    () => (dashboardState.data?.tokens ?? []).map((item) => item.tokenId),
    [dashboardState.data?.tokens],
  )

  useEffect(() => {
    if (topTokenIds.length === 0) {
      return
    }

    let cancelled = false
    const cachedEntries: Record<string, TokenNameRecord> = {}
    const missingTokenIds: string[] = []

    topTokenIds.forEach((tokenId) => {
      const cached = getCachedTokenDetails(tokenId)
      if (cached) {
        cachedEntries[tokenId] = getTokenDisplay(cached, tokenId)
      } else {
        missingTokenIds.push(tokenId)
      }
    })

    if (Object.keys(cachedEntries).length > 0) {
      setTokenNames((current) => ({
        ...current,
        ...cachedEntries,
      }))
    }

    if (missingTokenIds.length === 0) {
      return
    }

    void Promise.allSettled(
      missingTokenIds.map(async (tokenId) => {
        const details = await fetchTokenDetails(tokenId)
        return {
          tokenId,
          details,
        }
      }),
    ).then((results) => {
      if (cancelled) {
        return
      }

      const resolvedEntries: Record<string, TokenNameRecord> = {}
      results.forEach((result) => {
        if (result.status !== "fulfilled") {
          return
        }

        resolvedEntries[result.value.tokenId] = getTokenDisplay(
          result.value.details,
          result.value.tokenId,
        )
      })

      if (Object.keys(resolvedEntries).length > 0) {
        setTokenNames((current) => ({
          ...current,
          ...resolvedEntries,
        }))
      }
    })

    return () => {
      cancelled = true
    }
  }, [topTokenIds])

  const isLoading = dashboardState.isLoading || homeViewsState.isLoading
  const visitorSeries = useMemo(
    () =>
      buildVisitorSeries(
        homeViewsState.data?.buckets ?? [],
        dashboardState.data?.tokenVisitBuckets ?? [],
      ),
    [dashboardState.data?.tokenVisitBuckets, homeViewsState.data?.buckets],
  )
  const visitorCount =
    (homeViewsState.data?.accessCountWindow ?? 0) +
    (dashboardState.data?.overview.tokenVisitCountWindow ?? 0)
  const visitorTotal =
    (homeViewsState.data?.accessCountTotal ?? 0) +
    (dashboardState.data?.overview.tokenVisitCountTotal ?? 0)
  const homepageViews = homeViewsState.data?.accessCountWindow ?? 0
  const tokenPageViews = dashboardState.data?.overview.tokenVisitCountWindow ?? 0
  const peakPoint = useMemo(
    () =>
      visitorSeries.reduce<VisitorPoint | null>(
        (currentPeak, point) => (!currentPeak || point.visitors > currentPeak.visitors ? point : currentPeak),
        null,
      ),
    [visitorSeries],
  )
  const topPages = useMemo<VisitorPageRow[]>(() => {
    const rows: VisitorPageRow[] = []

    if (homeViewsState.data) {
      rows.push({
        key: "home",
        href: "/",
        title: "Home",
        subtitle: "Token table",
        total: homeViewsState.data.accessCountTotal,
        lastSeen: homeViewsState.data.lastAccessedAt,
        symbol: null,
        tokenId: null,
        kind: "home",
      })
    }

    ;(dashboardState.data?.tokens ?? []).forEach((item) => {
      const tokenName = tokenNames[item.tokenId]

      rows.push({
        key: item.tokenId,
        href: `/${item.tokenId}`,
        title: tokenName?.name || shortenTokenId(item.tokenId),
        subtitle: shortenTokenId(item.tokenId),
        total: item.visitCountTotal,
        lastSeen: item.lastVisitedAt,
        symbol: tokenName?.symbol ?? null,
        tokenId: item.tokenId,
        kind: "token",
      })
    })

    return rows
      .sort((left, right) => {
        if (right.total !== left.total) {
          return right.total - left.total
        }

        return (right.lastSeen ?? 0) - (left.lastSeen ?? 0)
      })
      .slice(0, 8)
  }, [dashboardState.data?.tokens, homeViewsState.data, tokenNames])
  const fatalError = dashboardState.error || homeViewsState.error
  const windowRange = formatWindowRange(
    dashboardState.data?.overview.windowStart,
    dashboardState.data?.overview.windowEnd,
  )

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            Visitors
          </div>
          {isLoading ? (
            <Skeleton className="h-16 w-48 rounded-xl" />
          ) : (
            <div className="flex flex-col gap-2">
              <div className="text-5xl font-semibold tracking-[-0.04em] sm:text-6xl">
                {formatCount(visitorCount)}
              </div>
              <div className="text-sm text-muted-foreground">
                {windowRange || `${hours} hours`}
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-6 border-y border-border/60 py-5 sm:grid-cols-3">
          {isLoading ? (
            <>
              <MetricSkeleton />
              <MetricSkeleton />
              <MetricSkeleton />
            </>
          ) : (
            <>
              <Metric label="Home" value={formatCount(homepageViews)} />
              <Metric label="Tokens" value={formatCount(tokenPageViews)} />
              <Metric label="Peak Hour" value={formatCount(peakPoint?.visitors ?? 0)} />
            </>
          )}
        </div>
      </section>

      <Card className="overflow-hidden rounded-[28px] border-border/60 pt-0 shadow-sm">
        <CardHeader className="border-b border-border/60 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-1">
            <CardTitle className="text-base font-semibold tracking-tight">Trend</CardTitle>
          </div>
          <ToggleGroup
            type="single"
            value={windowPreset}
            onValueChange={(value) => {
              if (value) {
                setWindowPreset(value as AnalyticsWindowPreset)
              }
            }}
            variant="outline"
            size="sm"
            aria-label="Select visitor window"
          >
            {WINDOW_OPTIONS.map((item) => (
              <ToggleGroupItem key={item.value} value={item.value} aria-label={item.label}>
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          {isLoading ? (
            <Skeleton className="h-[320px] w-full rounded-[24px]" />
          ) : visitorSeries.length === 0 ? (
            <div className="flex h-[320px] items-center justify-center rounded-[24px] text-sm text-muted-foreground">
              No data
            </div>
          ) : (
            <ChartContainer config={CHART_CONFIG} className="aspect-auto h-[320px] w-full">
              <AreaChart data={visitorSeries}>
                <defs>
                  <linearGradient id={`${gradientId}-home`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-homeViews)" stopOpacity={0.75} />
                    <stop offset="95%" stopColor="var(--color-homeViews)" stopOpacity={0.08} />
                  </linearGradient>
                  <linearGradient id={`${gradientId}-token`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-tokenViews)" stopOpacity={0.75} />
                    <stop offset="95%" stopColor="var(--color-tokenViews)" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="bucketStart"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={windowPreset === "30d" ? 72 : 48}
                  tickFormatter={(value) => {
                    const date = new Date(value)
                    return windowPreset === "24h"
                      ? date.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : `${date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })} ${date.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                        })}`
                  }}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      indicator="dot"
                      labelFormatter={(_, payload) =>
                        formatDateTime(Number(payload?.[0]?.payload?.bucketStart))
                      }
                    />
                  }
                />
                <Area
                  dataKey="tokenViews"
                  type="natural"
                  fill={`url(#${gradientId}-token)`}
                  stroke="var(--color-tokenViews)"
                  stackId="traffic"
                />
                <Area
                  dataKey="homeViews"
                  type="natural"
                  fill={`url(#${gradientId}-home)`}
                  stroke="var(--color-homeViews)"
                  stackId="traffic"
                />
                <ChartLegend content={<ChartLegendContent />} />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {fatalError ? (
        <Alert variant="destructive">
          <AlertDescription>{fatalError}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="rounded-[36px] border-border/60 shadow-sm">
        <CardHeader className="gap-1">
          <CardTitle className="text-xl font-semibold tracking-tight">Top Pages</CardTitle>
          <div className="text-sm text-muted-foreground">{formatCount(visitorTotal)} total</div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <Skeleton className="h-[420px] w-full rounded-[24px]" />
          ) : topPages.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-[24px] text-sm text-muted-foreground">
              No pages
            </div>
          ) : (
            <div className="flex flex-col">
              {topPages.map((page, index) => (
                <Link
                  key={page.key}
                  href={page.href}
                  className="flex items-center justify-between gap-4 border-t border-border/60 py-4 first:border-t-0"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <Avatar className="size-10 border border-border/60">
                      {page.tokenId ? (
                        <AvatarImage src={getTokenIconUrl(page.tokenId)} alt={page.title} />
                      ) : null}
                      <AvatarFallback className="text-xs">
                        {page.kind === "home" ? "AG" : (page.symbol || page.title).slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-base font-medium">{page.title}</span>
                        {page.kind === "home" ? <Badge variant="secondary">Home</Badge> : null}
                        {page.symbol ? <Badge variant="outline">{page.symbol}</Badge> : null}
                      </div>
                      <span className="truncate text-xs text-muted-foreground">
                        {page.subtitle}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-4">
                    <div className="text-xs text-muted-foreground">{index + 1}</div>
                    <div className="text-right">
                      <div className="text-xl font-semibold tracking-tight">
                        {formatCount(page.total)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(page.lastSeen)}
                      </div>
                    </div>
                    <ArrowUpRight className="size-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
