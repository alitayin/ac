"use client"

import { TrendingUp } from "lucide-react"
import { CartesianGrid, Line, LineChart, XAxis, Bar, BarChart } from "recharts"
import { useEffect, useState, useMemo, useCallback } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { formatPrice } from "@/lib/formatters"
import { parseUTCDate, formatDateShort } from "@/lib/time-utils"
import { RealtimePriceData, TokenComponentProps } from "@/lib/types"
import { 
  createEmptyDataPoint, 
  processPriceData, 
  aggregatePriceData,
  formatChartAmount 
} from "@/lib/price-data-utils"
import { fetchHourlyData, getFilledCache, setFilledCache } from "@/lib/hourly-cache"

const chartConfig = {
  price: {
    label: "Average Price",
    color: "hsl(var(--chart-1))",
  },
  latestPrice: {
    label: "Latest Price",
    color: "rgba(236, 72, 153, 0.9)",
  },
  volume: {
    label: "Volume",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export default function Component({ tokenId }: TokenComponentProps) {
  const [chartData, setChartData] = useState<RealtimePriceData[]>([])
  const [hoverData, setHoverData] = useState<RealtimePriceData | null>(null)
  const [timeRange, setTimeRange] = useState("720")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const hours = parseInt(timeRange)

        const cachedFilled = getFilledCache(tokenId, hours)
        if (cachedFilled) {
          const processed = processPriceData(cachedFilled, false)
          const aggregated = aggregatePriceData(processed)
          setChartData(aggregated)
          return
        }

        const hourlyData = await fetchHourlyData(tokenId, hours)

        if (hourlyData.length === 0) {
          setChartData([])
          setFilledCache(tokenId, hours, [])
          return
        }

        const lastDate = parseUTCDate(hourlyData[hourlyData.length - 1].date)
        const startDate = new Date(lastDate)
        startDate.setHours(lastDate.getHours() - hours + 1)

        const dataMap = new Map<string, RealtimePriceData>()
        for (const item of hourlyData) {
          const d = parseUTCDate(item.date)
          if (d >= startDate && d <= lastDate) {
            const key = item.date.slice(0, 13) + ':00'
            dataMap.set(key, item)
          }
        }

        const filledData: RealtimePriceData[] = []
        let prevPrice = 0
        for (let i = 0; i < hours; i++) {
          const d = new Date(startDate)
          d.setHours(startDate.getHours() + i)
          const key = d.toISOString().slice(0, 13).replace('T', ' ') + ':00'
          let item = dataMap.get(key)
          if (!item) {
            item = createEmptyDataPoint(key, prevPrice)
          }
          prevPrice = item.averagePrice || prevPrice
          filledData.push(item)
        }

        const processedData = processPriceData(filledData, false)
        const aggregatedData = aggregatePriceData(processedData)

        setFilledCache(tokenId, hours, filledData)
        setChartData(aggregatedData)
      } catch {
        setChartData([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [timeRange, tokenId])

  const displayTitle = useMemo(() => 
    hoverData ? `${hoverData.averagePrice.toFixed(2)} XEC` : 'Price Chart',
    [hoverData]
  )

  const displayDescription = useMemo(() => {
    if (hoverData) {
      return parseUTCDate(hoverData.date).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    return null
  }, [hoverData])

  const handleMouseMove = useCallback((state: any) => {
    if (state.isTooltipActive && state.activePayload) {
      setHoverData(state.activePayload[0].payload as RealtimePriceData)
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHoverData(null)
  }, [])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">
              {displayTitle}
            </CardTitle>
            {isLoading && (
              <svg 
                className="animate-spin h-5 w-5 text-gray-500" 
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
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24">Last 24h</SelectItem>
              <SelectItem value="72">Last 72h</SelectItem>
              <SelectItem value="168">Last 7 days</SelectItem>
              <SelectItem value="720">Last 30D</SelectItem>
              <SelectItem value="1440">Last 60D</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <CardDescription className="flex items-center gap-1">
          {displayDescription || (
            <>
              Hourly Price Movement(Average price)
              <TrendingUp className="h-4 w-4" />
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          <ChartContainer config={chartConfig} >
            <LineChart
              data={chartData}
              height={250} 
              margin={{
                top: 20,
                left: 20,
                right: 12,
              }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                hide={true}
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={formatDateShort}
                interval={23}
                padding={{ left: 5, right: 5 }}
              />
              <ChartTooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null
                  const data = payload[0].payload as RealtimePriceData
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="grid gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: chartConfig.price.color }} />
                          <span>Time: {parseUTCDate(data.date).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: chartConfig.price.color }} />
                          <span>Avg Price: {formatPrice(data.averagePrice)} XEC</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: chartConfig.latestPrice.color }} />
                          <span>Latest Price: {formatPrice(data.latestPrice)} XEC</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: chartConfig.volume.color }} />
                          <span>Amount: {formatChartAmount(data.amount)}</span>
                        </div>
                      </div>
                    </div>
                  )
                }}
              />
              <Line
                dataKey="averagePrice"
                type="monotone"
                stroke={chartConfig.price.color}
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 6,
                }}
              />
              <Line
                dataKey="latestPrice"
                type="monotone"
                stroke={chartConfig.latestPrice.color}
                strokeWidth={2}
                dot={false}
                strokeDasharray="6 2"
                activeDot={{
                  r: 6,
                }}
              />
            </LineChart>
          </ChartContainer>

          <ChartContainer 
            config={chartConfig} 
            className="max-h-[80px] sm:max-h-[120px] min-h-[60px] -mt-0 w-full h-[120px]"
          >
            <BarChart
              data={chartData}
              margin={{
                left: 20,
                right: 12,
              }}
            >
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={formatDateShort}
                interval={23}
                padding={{ left: 5, right: 5 }}
              />
  
              <Bar
                dataKey="amount"
                fill="hsl(var(--chart-2))"
                radius={[4, 4, 0, 0]}
                activeBar={{ 
                  fill: "#fc72ff"
                }}
              />
              <ChartTooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null
                  const data = payload[0].payload as RealtimePriceData
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[hsl(var(--chart-2))]" />
                        <span>Volume: {formatChartAmount(data.amount)} XEC</span>
                      </div>
                    </div>
                  )
                }}
              />
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  )
}