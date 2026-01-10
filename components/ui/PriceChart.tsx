"use client"
import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getLastNDays } from "@/lib/time-utils"
import { fetchHourlyData } from "@/lib/hourly-cache"

interface ChartDataItem {
  date: string
  totalTx: number
  matchedTx: number
}

interface TokenComponentProps {
  tokenIds: string[]
}

export default function Component({ tokenIds }: TokenComponentProps) {
  const [timeRange, setTimeRange] = React.useState("30d")
  const [chartData, setChartData] = React.useState<ChartDataItem[]>([])
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const days = timeRange === "90d" ? 90 : timeRange === "7d" ? 7 : 30
        const hours = days * 24

        const hourlyArrays = await Promise.all(
          tokenIds.map((id) =>
            fetchHourlyData(id, hours).catch((err) => {
              console.error("Error fetching token hourly:", id, err)
              return []
            })
          )
        )

        const dailyDataMap = new Map<string, ChartDataItem>()
        hourlyArrays.flat().forEach((hourData: any) => {
          const date = hourData.date.split(" ")[0]
          const existing = dailyDataMap.get(date) || {
            date,
            totalTx: 0,
            matchedTx: 0,
          }
          existing.totalTx += hourData.totalTxCount || 0
          existing.matchedTx += hourData.matchedTxCount || 0
          dailyDataMap.set(date, existing)
        })

        const lastNDays = getLastNDays(days)
        const formattedData = lastNDays.map((date) => {
          const entry = dailyDataMap.get(date)
          return {
            date,
            totalTx: entry?.totalTx ?? 0,
            matchedTx: entry?.matchedTx ?? 0,
          }
        })

        setChartData(formattedData)
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [tokenIds.join(","), timeRange])

  const filteredData = chartData.filter((item: { date: string }) => {
    const date = new Date(item.date)
    const referenceDate = new Date()
    let daysToSubtract = 90
    if (timeRange === "30d") {
      daysToSubtract = 30
    } else if (timeRange === "7d") {
      daysToSubtract = 7
    }
    const startDate = new Date(referenceDate)
    startDate.setDate(startDate.getDate() - daysToSubtract)
    return date >= startDate
  })

  const chartConfig: ChartConfig = {
    transactions: {
      label: "Transactions",
    },
    totalTx: {
      label: "on-chain TX",
      color: "hsl(var(--chart-1))",
    },
    matchedTx: {
      label: "Agora TX",
      color: "hsl(var(--chart-2))",
    },
  }

  return (
    <Card className="h-full border-none">
      <CardHeader className="flex items-center gap-2 space-y-0 py-5 sm:flex-row">
        <div className="grid flex-1 gap-1 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <CardTitle>Statistics</CardTitle>
            {isLoading && (
              <svg
                className="animate-spin h-4 w-4 text-gray-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
          </div>
          <CardDescription>Txs on Chain</CardDescription>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger
            className="w-[160px] rounded-lg sm:ml-auto"
            aria-label="Select a value"
          >
            <SelectValue placeholder="Last 3 months" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="90d" className="rounded-lg">
              Last 3 months
            </SelectItem>
            <SelectItem value="30d" className="rounded-lg">
              Last 30 days
            </SelectItem>
            <SelectItem value="7d" className="rounded-lg">
              Last 7 days
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillTotalTx" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-totalTx)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-totalTx)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillMatchedTx" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-matchedTx)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-matchedTx)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="matchedTx"
              type="natural"
              fill="url(#fillMatchedTx)"
              stroke="var(--color-matchedTx)"
              stackId="a"
            />
            <Area
              dataKey="totalTx"
              type="natural"
              fill="url(#fillTotalTx)"
              stroke="var(--color-totalTx)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}