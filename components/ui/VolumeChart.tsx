"use client"

import { useEffect, useState, useMemo } from "react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

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
} from "@/components/ui/chart"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatNumber } from "@/lib/formatters"
import { getLastNDays } from "@/lib/time-utils"
import { VolumeData, TokenListComponentProps } from "@/lib/types"
import { fetchHourlyData } from "@/lib/hourly-cache"

const chartConfig = {
  views: { label: "Trading Volume" },
  amount: { label: "XEC", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig

const aggregateVolumeData = (dataArrays: any[], days: number): VolumeData[] => {
  const lastNDays = getLastNDays(days)
  const dailyDataMap = new Map<string, any>()

  dataArrays.flat().forEach((hourData: any) => {
    const date = hourData.date.split(" ")[0]
    
    if (!dailyDataMap.has(date)) {
      dailyDataMap.set(date, {
        date,
        amount: 0,
        token: 0,
        matchedTxCount: 0,
        totalTxCount: 0,
        prices: []
      })
    }
    
    const dayData = dailyDataMap.get(date)
    dayData.amount += hourData.amount / 100
    dayData.token += hourData.token
    dayData.matchedTxCount += hourData.matchedTxCount
    dayData.totalTxCount += hourData.totalTxCount
    if (hourData.latestPrice) dayData.prices.push(hourData.latestPrice)
  })
  
  return lastNDays.map(date => {
    const dayData = dailyDataMap.get(date)
    if (!dayData) {
      return {
        date,
        amount: 0,
        token: 0,
        matchedTxCount: 0,
        totalTxCount: 0,
        highPrice: null,
        lowPrice: null,
        closePrice: null
      }
    }
    const { prices, ...rest } = dayData
    return {
      ...rest,
      highPrice: prices.length ? Math.max(...prices) : null,
      lowPrice: prices.length ? Math.min(...prices) : null,
      closePrice: prices.length ? prices[prices.length - 1] : null
    }
  })
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  
  const data = payload[0].payload
  return (
    <div className="rounded-lg bg-white p-2 shadow-md">
      <p className="text-sm text-gray-600">
        {new Date(data.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric", 
          year: "numeric",
        })}
      </p>
      <p className="font-bold text-black">
        {`${formatNumber(data.amount)} XEC`}
      </p>
    </div>
  )
}

export default function Component({ tokenIds }: TokenListComponentProps) {
  const [chartData, setChartData] = useState<VolumeData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [timeRange, setTimeRange] = useState("30d")

  useEffect(() => {
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
            }),
          ),
        )

        const aggregatedData = aggregateVolumeData(hourlyArrays, days)
        setChartData(aggregatedData)
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [tokenIds.join(','), timeRange])

  const totalVolume = useMemo(() => 
    chartData.reduce((sum, item) => sum + item.amount, 0),
    [chartData]
  )

  return (
    <Card className="h-full border-none">
      <CardHeader className="flex items-center gap-2 space-y-0 py-5 sm:flex-row">
        <div className="grid flex-1 gap-1 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <CardTitle>Volume Chart </CardTitle>
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
          <CardDescription>
            Agora data
          </CardDescription>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[160px] rounded-lg sm:ml-auto" aria-label="Select a value">
            <SelectValue placeholder="Last 30 days" />
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
      <CardContent className="px-2 sm:p-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{ left: 12, right: 12 }}
          >
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
            <ChartTooltip content={CustomTooltip} />
            <Bar 
              dataKey="amount"
              fill={chartConfig.amount.color}
              radius={4}
              activeBar={{ fill: "#fc72ff" }}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}