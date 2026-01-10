import { fetchAgoraTransactionsFromChronik } from "./chronik-transactions"
import { parseUTCDate } from "./time-utils"
import { RealtimePriceData } from "./types"

type HourlyCacheEntry = {
  hours: number
  hourly: RealtimePriceData[]
}

type FilledCacheEntry = {
  hours: number
  filled: RealtimePriceData[]
}

const hourlyCache = new Map<string, HourlyCacheEntry>()
const filledCache = new Map<string, FilledCacheEntry>()

export const buildHourlyData = (transactions: any[]): RealtimePriceData[] => {
  if (!transactions || transactions.length === 0) return []

  const sorted = [...transactions].sort((a, b) => a.timestamp - b.timestamp)
  const hourMap = new Map<
    string,
    {
      amount: number
      token: number
      matchedTxCount: number
      totalTxCount: number
      valueSum: number
      latestPrice: number
      latestTs: number
    }
  >()

  sorted.forEach((tx) => {
    const tsMs = (tx.timestamp || 0) * 1000
    const date = new Date(tsMs)
    const hourKey = date.toISOString().slice(0, 13).replace("T", " ") + ":00"

    const price = Number(tx.price) || 0
    const tokenAmount = Number(tx.amount) || 0
    const xecValue = price * tokenAmount

    const entry =
      hourMap.get(hourKey) || {
        amount: 0,
        token: 0,
        matchedTxCount: 0,
        totalTxCount: 0,
        valueSum: 0,
        latestPrice: 0,
        latestTs: 0,
      }

    entry.amount += xecValue * 100
    entry.token += tokenAmount
    entry.matchedTxCount += 1
    entry.totalTxCount += 1
    entry.valueSum += xecValue

    if (tsMs >= entry.latestTs) {
      entry.latestTs = tsMs
      entry.latestPrice = price
    }

    hourMap.set(hourKey, entry)
  })

  return Array.from(hourMap.entries())
    .sort((a, b) => (a[0] > b[0] ? 1 : -1))
    .map(([date, entry]) => {
      const avgPrice = entry.token > 0 ? entry.valueSum / entry.token : 0
      return {
        date,
        amount: entry.amount,
        token: entry.token,
        matchedTxCount: entry.matchedTxCount,
        totalTxCount: entry.totalTxCount,
        averagePrice: avgPrice,
        latestPrice: entry.latestPrice || avgPrice,
      }
    })
}

export const fetchHourlyData = async (
  tokenId: string,
  hours: number,
): Promise<RealtimePriceData[]> => {
  const existing = hourlyCache.get(tokenId)
  if (existing && existing.hours >= hours) {
    return existing.hourly.slice(existing.hourly.length - hours)
  }

  const blocksPerDay = 144
  const maxBlocksBack = Math.ceil((hours / 24) * blocksPerDay)

  const rawTx = await fetchAgoraTransactionsFromChronik(tokenId, undefined, {
    maxBlocksBack,
    targetCount: Math.max(2000, maxBlocksBack * 2),
  })
  const txList = Array.isArray(rawTx) ? rawTx : Object.values(rawTx)
  const hourlyData = buildHourlyData(txList)

  if (hourlyData.length === 0) {
    hourlyCache.set(tokenId, { hours, hourly: [] })
    return []
  }

  const lastDate = parseUTCDate(hourlyData[hourlyData.length - 1].date)
  const startDate = new Date(lastDate)
  startDate.setHours(lastDate.getHours() - hours + 1)

  const filtered = hourlyData.filter((item) => {
    const d = parseUTCDate(item.date)
    return d >= startDate && d <= lastDate
  })

  hourlyCache.set(tokenId, {
    hours: Math.max(hours, existing?.hours ?? 0),
    hourly: hourlyData,
  })

  return filtered
}

export const getFilledCache = (
  tokenId: string,
  hours: number,
): RealtimePriceData[] | null => {
  const existing = filledCache.get(tokenId)
  if (!existing || existing.hours < hours) return null
  return existing.filled.slice(existing.filled.length - hours)
}

export const setFilledCache = (
  tokenId: string,
  hours: number,
  filled: RealtimePriceData[],
) => {
  const prev = filledCache.get(tokenId)
  filledCache.set(tokenId, {
    hours: Math.max(hours, prev?.hours ?? 0),
    filled,
  })
}

