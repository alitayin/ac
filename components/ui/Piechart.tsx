"use client"

import { useEffect, useState } from "react"
import { LabelList, Pie, PieChart } from "recharts"
import { encodeCashAddress, getTypeAndHashFromOutputScript } from "ecashaddrjs"

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
  ChartTooltipContent,
} from "@/components/ui/chart"
import { shortenAddress, getChartColor } from "@/lib/formatters"
import { CHART_CONSTANTS } from "@/lib/constants"
import type { 
  TokenComponentProps, 
  HoldersData, 
  Holder, 
  PieChartData 
} from "@/lib/types"
import { fetchTokenUtxos, getTokenAmountFromToken } from "@/lib/chronik"

async function fetchHoldersFromChronik(tokenId: string): Promise<HoldersData> {
  if (!tokenId) {
    throw new Error("tokenId is required")
  }

  const utxos = await fetchTokenUtxos(tokenId)

  const mapAddressToAmount = new Map<string, bigint>()

  for (const utxo of utxos) {
    const token = (utxo as any).token
    if (!token) continue

    const rawAmount = getTokenAmountFromToken(token)

    if (rawAmount === BigInt(0)) continue

    let address = "unknown"
    try {
      const { type, hash } = getTypeAndHashFromOutputScript((utxo as any).script)
      address = encodeCashAddress("ecash", type, hash)
    } catch {
      continue
    }

    const prev = mapAddressToAmount.get(address) || BigInt(0)
    mapAddressToAmount.set(address, prev + rawAmount)
  }

  const holders: Holder[] = Array.from(mapAddressToAmount.entries()).map(
    ([address, amount]) => ({
      address,
      amount: amount.toString(),
    }),
  )

  const totalAmountBigInt = holders.reduce(
    (acc, h) => acc + BigInt(h.amount),
    BigInt(0),
  )

  const data: HoldersData = {
    totalHolders: holders.length,
    totalAmount: totalAmountBigInt.toString(),
    holders,
  }

  return data
}

export default function Component({ tokenId }: TokenComponentProps) {
  const [chartData, setChartData] = useState<PieChartData[]>([])
  const [chartConfig, setChartConfig] = useState<ChartConfig>({} as ChartConfig)
  const [totalHolders, setTotalHolders] = useState<number>(0)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data: HoldersData = await fetchHoldersFromChronik(tokenId)
        setTotalHolders(data.totalHolders)
        
        const sortedHolders = data.holders
          .sort((a, b) => parseInt(b.amount) - parseInt(a.amount))
        
        const topHolders = sortedHolders.slice(0, CHART_CONSTANTS.TOP_HOLDERS_COUNT)
        
        const othersSum = sortedHolders
          .slice(CHART_CONSTANTS.TOP_HOLDERS_COUNT)
          .reduce((sum, holder) => sum + parseInt(holder.amount), 0)

        const newChartData: PieChartData[] = [
          ...topHolders.map((holder, index) => ({
            browser: holder.address,
            amount: parseInt(holder.amount),
            fill: getChartColor(index)
          })),
          {
            browser: "other",
            amount: othersSum,
            fill: getChartColor(CHART_CONSTANTS.TOP_HOLDERS_COUNT)
          }
        ]


        const newChartConfig: ChartConfig = {
          amount: {
            label: "Amount",
          },
          ...Object.fromEntries(
            topHolders.map((holder, index) => [
              holder.address,
              {
                label: shortenAddress(holder.address),
                color: getChartColor(index)
              }
            ])
          ),
          other: {
            label: "Other",
            color: getChartColor(CHART_CONSTANTS.TOP_HOLDERS_COUNT)
          }
        }

        setChartData(newChartData)
        setChartConfig(newChartConfig)
      } catch (error) {
        console.error('Error fetching holders data from chronik:', error)
      }
    }

    fetchData()
  }, [tokenId])

  return (
    <Card className="flex flex-col min-h-[450px]">
      <CardHeader className="items-center pb-0">
        <CardTitle>Holders Distribution</CardTitle>
        <CardDescription>Top Holders ({totalHolders})</CardDescription>
      </CardHeader>
      {chartData.length > 0 && (
        <CardContent className="flex-1 pb-0">
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square max-h-[430px] [&_.recharts-text]:fill-background"
          >
            <PieChart>
              <ChartTooltip
                content={<ChartTooltipContent nameKey="amount" hideLabel />}
              />
              <Pie data={chartData} dataKey="amount" outerRadius={130}>
                <LabelList
                  dataKey="browser"
                  className="fill-background"
                  stroke="none"
                  fontSize={12}
                  formatter={(value: keyof typeof chartConfig) =>
                    chartConfig[value]?.label
                  }
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        </CardContent>
      )}
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="leading-none text-muted-foreground">
        Address Distribution
        </div>
      </CardFooter>
    </Card>
  )
}
