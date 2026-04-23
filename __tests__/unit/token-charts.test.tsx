import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"

const { mockUseTokenChartData } = vi.hoisted(() => ({
  mockUseTokenChartData: vi.fn(),
}))

vi.mock("@/lib/use-token-chart-data", () => ({
  useTokenChartData: mockUseTokenChartData,
}))

vi.mock("recharts", () => ({
  BarChart: ({ children, data }: any) => (
    <div data-testid="bar-chart" data-points={data?.length ?? 0}>
      {children}
    </div>
  ),
  LineChart: ({ children, data }: any) => (
    <div data-testid="line-chart" data-points={data?.length ?? 0}>
      {children}
    </div>
  ),
  AreaChart: ({ children, data }: any) => (
    <div data-testid="area-chart" data-points={data?.length ?? 0}>
      {children}
    </div>
  ),
  CartesianGrid: () => null,
  XAxis: ({ dataKey }: any) => <div data-testid="x-axis">{String(dataKey)}</div>,
  Bar: ({ dataKey }: any) => <div data-testid="bar-series">{String(dataKey)}</div>,
  Line: ({ dataKey }: any) => <div data-testid="line-series">{String(dataKey)}</div>,
  Area: ({ dataKey }: any) => <div data-testid="area-series">{String(dataKey)}</div>,
}))

vi.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ChartTooltip: ({ content }: { content?: ReactNode | ((props: any) => ReactNode) }) => {
    const payload = [
      {
        name: "tradeCount",
        dataKey: "tradeCount",
        value: 2,
        payload: {
          bucketStart: 1_710_000_000_000,
          bucketEnd: 1_710_003_600_000,
          interval: "day",
          volumeXec: 10,
          tradeCount: 2,
          openPriceXec: 1,
          highPriceXec: 1.2,
          lowPriceXec: 0.9,
          closePriceXec: 1.1,
        },
      },
    ]

    return (
      <div data-testid="chart-tooltip">
        {typeof content === "function"
          ? content({ active: true, payload })
          : content}
      </div>
    )
  },
  ChartTooltipContent: () => null,
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => (
    <button type="button" role="combobox">
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

import PriceChart from "@/components/ui/PriceChart"
import RealtimePrice from "@/components/ui/realtimeprice"
import VolumeChart from "@/components/ui/VolumeChart"

const baseChartData = [
  {
    bucketStart: 1_710_000_000_000,
    bucketEnd: 1_710_003_600_000,
    volumeXec: 10,
    tradeCount: 2,
    openPriceXec: 1,
    highPriceXec: 1.2,
    lowPriceXec: 0.9,
    closePriceXec: 1.1,
  },
]

describe("token charts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders the volume chart with candle volume data", () => {
    mockUseTokenChartData.mockReturnValue({
      data: baseChartData,
      interval: "day",
      isLoading: false,
      source: "etokendb",
    })

    render(<VolumeChart tokenIds={["token-id"]} />)

    expect(screen.getByText("Volume Chart")).toBeInTheDocument()
    expect(screen.getByText("etokendb candles")).toBeInTheDocument()
    expect(screen.getByTestId("bar-series")).toHaveTextContent("volumeXec")
  })

  it("renders the trade count chart as a single tradeCount series", () => {
    mockUseTokenChartData.mockReturnValue({
      data: baseChartData,
      interval: "day",
      isLoading: false,
      source: "etokendb",
    })

    render(<PriceChart tokenIds={["token-id"]} />)

    expect(screen.getByText("Trade Count")).toBeInTheDocument()
    expect(screen.getByText("Trades per candle")).toBeInTheDocument()
    expect(screen.getByTestId("area-series")).toHaveTextContent("tradeCount")
    expect(screen.getByText("2 trades")).toBeInTheDocument()
    expect(screen.queryByText("Statistics")).not.toBeInTheDocument()
    expect(screen.queryByText("Invalid Date")).not.toBeInTheDocument()
  })

  it("renders the realtime price card with close-price semantics", () => {
    mockUseTokenChartData.mockReturnValue({
      data: baseChartData,
      interval: "hour",
      isLoading: false,
      source: "chronik",
    })

    render(<RealtimePrice tokenId="token-id" />)

    expect(screen.getByText("Price")).toBeInTheDocument()
    expect(screen.getByText("Chronik fallback")).toBeInTheDocument()
    expect(screen.getByTestId("line-series")).toHaveTextContent("closePriceXec")
    expect(screen.getAllByTestId("bar-series")[0]).toHaveTextContent("volumeXec")
    expect(screen.queryByText("Average Price")).not.toBeInTheDocument()
    expect(screen.queryByText("Latest Price")).not.toBeInTheDocument()
  })
})
