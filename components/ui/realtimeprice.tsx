"use client"

import { TrendingUp } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis } from "recharts"
import { useState } from "react"

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
import { formatNumber, formatPrice } from "@/lib/formatters"
import {
  formatTokenChartAxisLabel,
  formatTokenChartTooltipLabel,
  type TokenChartPoint,
  type TokenChartRange,
} from "@/lib/token-chart-data"
import { TokenComponentProps } from "@/lib/types"
import { useTokenChartData } from "@/lib/use-token-chart-data"
import { cn } from "@/lib/utils"

const chartConfig = {
  closePriceXec: {
    label: "Close Price",
    color: "hsl(var(--chart-1))",
  },
  volumeXec: {
    label: "Volume",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export default function Component({ tokenId, className }: TokenComponentProps) {
  const [hoverData, setHoverData] = useState<TokenChartPoint | null>(null)
  const [timeRange, setTimeRange] = useState<TokenChartRange>("7d")
  const { data: chartData, interval, isLoading, source } = useTokenChartData(tokenId, timeRange)
  const displayTitle = hoverData ? `${formatPrice(hoverData.closePriceXec)} XEC` : "Price"
  const displayDescription = hoverData
    ? formatTokenChartTooltipLabel(hoverData.bucketStart, interval)
    : source === "chronik"
      ? "Chronik fallback"
      : "etokendb candles"
  const xAxisInterval = interval === "hour" ? 23 : 4

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">{displayTitle}</CardTitle>
            {isLoading && (
              <svg
                className="h-5 w-5 animate-spin text-gray-500"
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
          <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TokenChartRange)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="72h">Last 72h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30D</SelectItem>
              <SelectItem value="60d">Last 60D</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <CardDescription className="flex items-center gap-1">
          {hoverData ? (
            displayDescription
          ) : (
            <>
              {displayDescription}
              <TrendingUp className="h-4 w-4" />
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          <ChartContainer config={chartConfig}>
            <LineChart
              data={chartData}
              height={250}
              margin={{
                top: 20,
                left: 20,
                right: 12,
              }}
              onMouseMove={(state: any) => {
                if (state.isTooltipActive && state.activePayload?.[0]) {
                  setHoverData(state.activePayload[0].payload as TokenChartPoint)
                }
              }}
              onMouseLeave={() => setHoverData(null)}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                hide={true}
                dataKey="bucketStart"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => formatTokenChartAxisLabel(Number(value), interval)}
                interval={xAxisInterval}
                padding={{ left: 5, right: 5 }}
              />
              <ChartTooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null
                  const data = payload[0].payload as TokenChartPoint

                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="grid gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ background: chartConfig.closePriceXec.color }}
                          />
                          <span>Time: {formatTokenChartTooltipLabel(data.bucketStart, interval)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ background: chartConfig.closePriceXec.color }}
                          />
                          <span>Open: {formatPrice(data.openPriceXec)} XEC</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ background: chartConfig.closePriceXec.color }}
                          />
                          <span>High: {formatPrice(data.highPriceXec)} XEC</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ background: chartConfig.volumeXec.color }}
                          />
                          <span>Low: {formatPrice(data.lowPriceXec)} XEC</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ background: chartConfig.closePriceXec.color }}
                          />
                          <span>Close: {formatPrice(data.closePriceXec)} XEC</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ background: chartConfig.volumeXec.color }}
                          />
                          <span>Volume: {formatNumber(data.volumeXec)} XEC</span>
                        </div>
                      </div>
                    </div>
                  )
                }}
              />
              <Line
                dataKey="closePriceXec"
                type="monotone"
                stroke={chartConfig.closePriceXec.color}
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 6,
                }}
              />
            </LineChart>
          </ChartContainer>

          <ChartContainer
            config={chartConfig}
            className="h-[120px] max-h-[80px] min-h-[60px] w-full -mt-0 sm:max-h-[120px]"
          >
            <BarChart
              data={chartData}
              margin={{
                left: 20,
                right: 12,
              }}
            >
              <XAxis
                dataKey="bucketStart"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => formatTokenChartAxisLabel(Number(value), interval)}
                interval={xAxisInterval}
                padding={{ left: 5, right: 5 }}
              />

              <Bar
                dataKey="volumeXec"
                fill="hsl(var(--chart-2))"
                radius={[4, 4, 0, 0]}
                activeBar={{
                  fill: "#fc72ff",
                }}
              />
              <ChartTooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null
                  const data = payload[0].payload as TokenChartPoint

                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-[hsl(var(--chart-2))]" />
                        <span>Volume: {formatNumber(data.volumeXec)} XEC</span>
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
