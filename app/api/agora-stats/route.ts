import { NextResponse } from "next/server"

import {
  type AgoraStatsApiResponse,
  type CumulativeVolumeData,
  type DailyVolumeData,
  type GenesisData,
  type VolumeUSDData,
  getAgoraStatsDateParams,
} from "@/lib/agora-stats"

export const dynamic = "force-dynamic"
export const revalidate = 0

const CHARTS_BASE_URL = "https://charts.e.cash/api/charts"
const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
}

async function fetchChartSeries<T>(path: string, dateParams: string): Promise<T[]> {
  const response = await fetch(`${CHARTS_BASE_URL}/${path}?${dateParams}`, {
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`)
  }

  const payload = await response.json()

  if (!Array.isArray(payload)) {
    throw new Error(`${path} returned an invalid payload`)
  }

  return payload as T[]
}

function unwrapSeries<T>(
  result: PromiseSettledResult<T[]>,
  path: string,
  warnings: string[],
): T[] {
  if (result.status === "fulfilled") {
    return result.value
  }

  console.error(`Failed to fetch ${path}:`, result.reason)
  warnings.push(`${path} temporarily unavailable`)
  return []
}

export async function GET() {
  try {
    const dateParams = getAgoraStatsDateParams()
    const [dailyVolumeResult, cumulativeVolumeResult, genesisDataResult, volumeUsdResult] =
      await Promise.allSettled([
        fetchChartSeries<DailyVolumeData>("daily-agora-volume", dateParams),
        fetchChartSeries<CumulativeVolumeData>("cumulative-agora-volume", dateParams),
        fetchChartSeries<GenesisData>("daily-genesis-txs", dateParams),
        fetchChartSeries<VolumeUSDData>("daily-agora-volume-usd", dateParams),
      ])

    const warnings: string[] = []
    const payload: AgoraStatsApiResponse = {
      dailyVolume: unwrapSeries(dailyVolumeResult, "daily-agora-volume", warnings),
      cumulativeVolume: unwrapSeries(
        cumulativeVolumeResult,
        "cumulative-agora-volume",
        warnings,
      ),
      genesisData: unwrapSeries(genesisDataResult, "daily-genesis-txs", warnings),
      volumeUSD: unwrapSeries(volumeUsdResult, "daily-agora-volume-usd", warnings),
      warnings,
      generatedAt: new Date().toISOString(),
    }

    const hasData =
      payload.dailyVolume.length > 0 ||
      payload.cumulativeVolume.length > 0 ||
      payload.genesisData.length > 0 ||
      payload.volumeUSD.length > 0

    if (!hasData) {
      return NextResponse.json(
        {
          ...payload,
          error: "Failed to fetch Agora stats",
        },
        {
          status: 502,
          headers: RESPONSE_HEADERS,
        },
      )
    }

    return NextResponse.json(payload, {
      headers: RESPONSE_HEADERS,
    })
  } catch (error) {
    console.error("Failed to fetch Agora stats:", error)
    return NextResponse.json(
      {
        dailyVolume: [],
        cumulativeVolume: [],
        genesisData: [],
        volumeUSD: [],
        warnings: ["All Agora stats sources are unavailable"],
        error: "Failed to fetch Agora stats",
      },
      {
        status: 500,
        headers: RESPONSE_HEADERS,
      },
    )
  }
}
