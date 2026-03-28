"use client"
import { useEffect, useState } from "react"
import { getLastNDays } from "./time-utils"
import { fetchHourlyData } from "./hourly-cache"

export type DailyHourlyData = {
  date: string
  amount: number
  token: number
  matchedTxCount: number
  totalTxCount: number
  highPrice: number | null
  lowPrice: number | null
  closePrice: number | null
}

function aggregateHourlyToDays(dataArrays: any[][], days: number): DailyHourlyData[] {
  const lastNDays = getLastNDays(days)
  const dailyDataMap = new Map<string, any>()

  dataArrays.flat().forEach((hourData: any) => {
    const date = hourData.date.split(" ")[0]
    if (!dailyDataMap.has(date)) {
      dailyDataMap.set(date, { date, amount: 0, token: 0, matchedTxCount: 0, totalTxCount: 0, prices: [] })
    }
    const d = dailyDataMap.get(date)
    d.amount += hourData.amount / 100
    d.token += hourData.token
    d.matchedTxCount += hourData.matchedTxCount
    d.totalTxCount += hourData.totalTxCount
    if (hourData.latestPrice) d.prices.push(hourData.latestPrice)
  })

  return lastNDays.map((date) => {
    const d = dailyDataMap.get(date)
    if (!d) return { date, amount: 0, token: 0, matchedTxCount: 0, totalTxCount: 0, highPrice: null, lowPrice: null, closePrice: null }
    const { prices, ...rest } = d
    return {
      ...rest,
      highPrice: prices.length ? Math.max(...prices) : null,
      lowPrice: prices.length ? Math.min(...prices) : null,
      closePrice: prices.length ? prices[prices.length - 1] : null,
    }
  })
}

export function useHourlyData(tokenIds: string[], timeRange: string) {
  const [data, setData] = useState<DailyHourlyData[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const days = timeRange === "90d" ? 90 : timeRange === "7d" ? 7 : 30
        const hours = days * 24
        const hourlyArrays = await Promise.all(
          tokenIds.map((id) => fetchHourlyData(id, hours).catch(() => []))
        )
        setData(aggregateHourlyToDays(hourlyArrays, days))
      } catch {
        setData([])
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [tokenIds.join(","), timeRange])

  return { data, isLoading }
}
