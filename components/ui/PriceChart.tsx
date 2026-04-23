"use client"

import { useState } from "react"
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
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  formatTokenChartAxisLabel,
  formatTokenChartTooltipLabel,
  type TokenChartRange,
} from "@/lib/token-chart-data"
import { TokenListComponentProps } from "@/lib/types"
import { useTokenChartData } from "@/lib/use-token-chart-data"

const chartConfig: ChartConfig = {
  tradeCount: {
    label: "Trade Count",
    color: "hsl(var(--chart-2))",
  },
}

export default function Component({ tokenIds }: TokenListComponentProps) {
  const [timeRange, setTimeRange] = useState<TokenChartRange>("7d")
  const tokenId = tokenIds[0] || ""
  const { data, interval, isLoading, source } = useTokenChartData(tokenId, timeRange)

  return (
    <Card className="h-full border-none">
      <CardHeader className="flex items-center gap-2 space-y-0 py-5 sm:flex-row">
        <div className="grid flex-1 gap-1 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <CardTitle>Trade Count</CardTitle>
            {isLoading && (
              <svg
                className="h-4 w-4 animate-spin text-gray-500"
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
            {source === "chronik" ? "Chronik fallback" : "Trades per candle"}
          </CardDescription>
        </div>
        <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TokenChartRange)}>
          <SelectTrigger
            className="w-[160px] rounded-lg sm:ml-auto"
            aria-label="Select a value"
          >
            <SelectValue placeholder="Last 7 days" />
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
            <SelectItem value="72h" className="rounded-lg">
              Last 72 hours
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={data}>
            <defs>
              <linearGradient id="fillTradeCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-tradeCount)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-tradeCount)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="bucketStart"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => formatTokenChartAxisLabel(Number(value), interval)}
            />
            <ChartTooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const data = payload[0].payload

                return (
                  <div className="rounded-lg border bg-background p-2 shadow-sm">
                    <div className="grid gap-2">
                      <div className="font-medium">
                        {formatTokenChartTooltipLabel(data.bucketStart, interval)}
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ background: chartConfig.tradeCount.color }}
                        />
                        <span>{data.tradeCount.toLocaleString()} trades</span>
                      </div>
                    </div>
                  </div>
                )
              }}
            />
            <Area
              dataKey="tradeCount"
              type="natural"
              fill="url(#fillTradeCount)"
              stroke="var(--color-tradeCount)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
