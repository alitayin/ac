export interface DailyVolumeData {
  date: string
  xecx: number
  firma: number
  other: number
  total: number
}

export interface CumulativeVolumeData {
  date: string
  xecx: number
  firma: number
  other: number
  total: number
}

export interface GenesisData {
  date: string
  genesis_alp_standard: number
  genesis_slp_fungible: number
  genesis_slp_mint_vault: number
  genesis_slp_nft1_group: number
  genesis_slp_nft1_child: number
}

export interface VolumeUSDData {
  date: string
  usd: number
  xecx_usd: number
  firma_usd: number
  other_usd: number
}

export interface AgoraStatsApiResponse {
  dailyVolume: DailyVolumeData[]
  cumulativeVolume: CumulativeVolumeData[]
  genesisData: GenesisData[]
  volumeUSD: VolumeUSDData[]
  warnings?: string[]
  error?: string
  generatedAt?: string
}

export interface AgoraStatsViewModel {
  dailyVolume: string
  dailyVolumeChange: number
  totalVolume: string
  totalVolumeChange: number
  newTokens: string
  newTokensChange: number
  volumeUSD: string
  volumeUSDChange: number
}

type DatedRecord = {
  date: string
}

export const EMPTY_AGORA_STATS: AgoraStatsViewModel = {
  dailyVolume: "0.00",
  dailyVolumeChange: 0,
  totalVolume: "0.00",
  totalVolumeChange: 0,
  newTokens: "0",
  newTokensChange: 0,
  volumeUSD: "$0.00",
  volumeUSDChange: 0,
}

export function calculateChange(today: number, yesterday: number): number {
  if (!Number.isFinite(today) || !Number.isFinite(yesterday) || yesterday === 0) {
    return 0
  }

  return ((today - yesterday) / yesterday) * 100
}

export function formatCompactNumber(num: number, decimals = 2): string {
  if (num >= 1e9) {
    return `${(num / 1e9).toFixed(decimals)}B`
  }
  if (num >= 1e6) {
    return `${(num / 1e6).toFixed(decimals)}M`
  }
  if (num >= 1e3) {
    return `${(num / 1e3).toFixed(decimals)}K`
  }

  return num.toFixed(decimals)
}

export function formatDateForChartApi(date: Date): string {
  return date.toISOString().split("T")[0]
}

export function getAgoraStatsDateParams(now = new Date(), lookbackDays = 7): string {
  const endDate = new Date(now)
  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - lookbackDays)

  return `start_date=${formatDateForChartApi(startDate)}&end_date=${formatDateForChartApi(endDate)}`
}

export function sumGenesisTotals(entry?: GenesisData): number {
  if (!entry) {
    return 0
  }

  return (
    entry.genesis_alp_standard +
    entry.genesis_slp_fungible +
    entry.genesis_slp_mint_vault +
    entry.genesis_slp_nft1_group +
    entry.genesis_slp_nft1_child
  )
}

function sortByDateAscending<T extends DatedRecord>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    return new Date(left.date).getTime() - new Date(right.date).getTime()
  })
}

function getLatestPair<T extends DatedRecord>(items: T[]): {
  latest: T | undefined
  previous: T | undefined
} {
  const ordered = sortByDateAscending(items)
  const latestIndex = ordered.length - 1

  return {
    latest: latestIndex >= 0 ? ordered[latestIndex] : undefined,
    previous: latestIndex > 0 ? ordered[latestIndex - 1] : undefined,
  }
}

export function buildAgoraStatsViewModel(
  payload?: Partial<AgoraStatsApiResponse> | null,
): AgoraStatsViewModel {
  const { latest: latestVolume, previous: previousVolume } = getLatestPair(payload?.dailyVolume ?? [])
  const { latest: latestCumulative, previous: previousCumulative } = getLatestPair(
    payload?.cumulativeVolume ?? [],
  )
  const { latest: latestGenesis, previous: previousGenesis } = getLatestPair(payload?.genesisData ?? [])
  const { latest: latestUsd, previous: previousUsd } = getLatestPair(payload?.volumeUSD ?? [])

  const latestGenesisTotal = sumGenesisTotals(latestGenesis)
  const previousGenesisTotal = sumGenesisTotals(previousGenesis)

  return {
    dailyVolume: formatCompactNumber((latestVolume?.total ?? 0) / 100, 2),
    dailyVolumeChange: calculateChange(latestVolume?.total ?? 0, previousVolume?.total ?? 0),
    totalVolume: formatCompactNumber((latestCumulative?.total ?? 0) / 100, 2),
    totalVolumeChange: calculateChange(
      latestCumulative?.total ?? 0,
      previousCumulative?.total ?? 0,
    ),
    newTokens: latestGenesisTotal.toString(),
    newTokensChange: calculateChange(latestGenesisTotal, previousGenesisTotal),
    volumeUSD: `$${formatCompactNumber(latestUsd?.usd ?? 0, 2)}`,
    volumeUSDChange: calculateChange(latestUsd?.usd ?? 0, previousUsd?.usd ?? 0),
  }
}
