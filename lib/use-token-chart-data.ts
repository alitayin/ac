"use client"

import { useEffect, useState } from "react"

import {
  fetchTokenChartSeries,
  type TokenChartPoint,
  type TokenChartRange,
  type TokenChartSource,
} from "@/lib/token-chart-data"
import type { EtokenDbCandleInterval } from "@/lib/etokendb"

type UseTokenChartDataResult = {
  data: TokenChartPoint[]
  interval: EtokenDbCandleInterval
  isLoading: boolean
  source: TokenChartSource | null
}

export function useTokenChartData(
  tokenId: string,
  range: TokenChartRange,
): UseTokenChartDataResult {
  const [data, setData] = useState<TokenChartPoint[]>([])
  const [interval, setInterval] = useState<EtokenDbCandleInterval>("day")
  const [source, setSource] = useState<TokenChartSource | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!tokenId) {
        setData([])
        setInterval("day")
        setSource(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)

      try {
        const result = await fetchTokenChartSeries(tokenId, range)
        if (cancelled) return
        setData(result.points)
        setInterval(result.interval)
        setSource(result.source)
      } catch {
        if (cancelled) return
        setData([])
        setInterval("day")
        setSource(null)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [range, tokenId])

  return {
    data,
    interval,
    isLoading,
    source,
  }
}
