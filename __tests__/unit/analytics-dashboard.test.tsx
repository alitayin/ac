import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import AnalyticsDashboard from "@/components/ui/AnalyticsDashboard"

const TOKEN_ID_A = "c67bf5c2b6d91cfb46a5c1772582eff80d88686887be10aa63b0945479cf4ed4"
const TOKEN_ID_B = "0387947fd575db4fb19a3e322f635dec37fd192b5941625b66bc4b2c3008cbf0"

const { fetchTokenDetailsMock, getCachedTokenDetailsMock } = vi.hoisted(() => ({
  fetchTokenDetailsMock: vi.fn(),
  getCachedTokenDetailsMock: vi.fn(),
}))

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : href?.pathname} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("recharts", () => {
  const Container = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  const SvgContainer = ({ children }: { children?: React.ReactNode }) => <svg>{children}</svg>

  return {
    ResponsiveContainer: Container,
    Tooltip: () => <div />,
    Legend: () => <g />,
    AreaChart: SvgContainer,
    Area: () => <path />,
    CartesianGrid: () => <g />,
    XAxis: () => <g />,
  }
})

vi.mock("@/lib/chronik", () => ({
  fetchTokenDetails: fetchTokenDetailsMock,
  getCachedTokenDetails: getCachedTokenDetailsMock,
}))

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  })
}

function createDashboard(hours: 168 | 720) {
  const isThirtyDays = hours === 720

  return {
    status: null,
    overview: {
      hours,
      windowStart: 1_700_000_000_000,
      windowEnd: 1_700_000_600_000,
      apiAccessCountTotal: isThirtyDays ? 8_000 : 1_500,
      apiAccessCountWindow: isThirtyDays ? 2_300 : 120,
      tokenVisitCountTotal: isThirtyDays ? 1_100 : 320,
      tokenVisitCountWindow: isThirtyDays ? 260 : 48,
      successRate: 95,
      activeEndpointCount: 2,
    },
    apiAccessBuckets: [],
    tokenVisitBuckets: [
      {
        bucketStart: 1_700_000_000_000,
        bucketEnd: 1_700_000_030_000,
        visitCount: isThirtyDays ? 60 : 8,
      },
      {
        bucketStart: 1_700_000_030_000,
        bucketEnd: 1_700_000_060_000,
        visitCount: isThirtyDays ? 40 : 6,
      },
    ],
    endpoints: [],
    tokens: [
      {
        tokenId: TOKEN_ID_A,
        visitCountTotal: isThirtyDays ? 250 : 80,
        visitCount24h: 12,
        lastVisitedAt: 1_700_000_420_000,
      },
      {
        tokenId: TOKEN_ID_B,
        visitCountTotal: isThirtyDays ? 180 : 60,
        visitCount24h: 8,
        lastVisitedAt: 1_700_000_300_000,
      },
    ],
    warnings: [],
    generatedAt: "2026-04-21T00:10:00.000Z",
  }
}

function createHomeEndpoint(hours: 168 | 720) {
  const isThirtyDays = hours === 720

  return {
    routeKey: "tokens.list",
    routeLabel: "Home / Token Table",
    hours,
    windowStart: 1_700_000_000_000,
    windowEnd: 1_700_000_600_000,
    accessCountTotal: 1_600,
    accessCountWindow: isThirtyDays ? 1_500 : 110,
    successCountTotal: 1_500,
    successCountWindow: isThirtyDays ? 1_450 : 108,
    clientErrorCountTotal: 80,
    clientErrorCountWindow: isThirtyDays ? 30 : 1,
    serverErrorCountTotal: 20,
    serverErrorCountWindow: isThirtyDays ? 20 : 1,
    lastAccessedAt: 1_700_000_550_000,
    successRate: isThirtyDays ? 96.7 : 98.2,
    buckets: [
      {
        bucketStart: 1_700_000_000_000,
        bucketEnd: 1_700_000_030_000,
        accessCount: isThirtyDays ? 55 : 12,
        successCount: isThirtyDays ? 50 : 11,
        clientErrorCount: isThirtyDays ? 3 : 1,
        serverErrorCount: isThirtyDays ? 2 : 0,
      },
      {
        bucketStart: 1_700_000_030_000,
        bucketEnd: 1_700_000_060_000,
        accessCount: isThirtyDays ? 35 : 9,
        successCount: isThirtyDays ? 32 : 8,
        clientErrorCount: isThirtyDays ? 2 : 1,
        serverErrorCount: isThirtyDays ? 1 : 0,
      },
    ],
  }
}

describe("AnalyticsDashboard", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )

    getCachedTokenDetailsMock.mockImplementation((tokenId: string) => {
      if (tokenId === TOKEN_ID_A) {
        return {
          genesisInfo: {
            tokenName: "XECX",
            tokenTicker: "XECX",
          },
        }
      }

      return null
    })

    fetchTokenDetailsMock.mockImplementation(async (tokenId: string) => {
      if (tokenId === TOKEN_ID_B) {
        return {
          genesisInfo: {
            tokenName: "Firma",
            tokenTicker: "FIRMA",
          },
        }
      }

      return null
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("renders the minimalist visitor dashboard and switches to 30d", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes("/api/etokendb/analytics/dashboard?hours=168")) {
        return jsonResponse({
          ok: true,
          data: createDashboard(168),
        })
      }

      if (url.includes("/api/etokendb/analytics/endpoints/tokens.list?hours=168")) {
        return jsonResponse({
          ok: true,
          data: createHomeEndpoint(168),
        })
      }

      if (url.includes("/api/etokendb/analytics/dashboard?hours=720")) {
        return jsonResponse({
          ok: true,
          data: createDashboard(720),
        })
      }

      if (url.includes("/api/etokendb/analytics/endpoints/tokens.list?hours=720")) {
        return jsonResponse({
          ok: true,
          data: createHomeEndpoint(720),
        })
      }

      throw new Error(`Unexpected fetch url: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const user = userEvent.setup()
    render(<AnalyticsDashboard />)

    expect(await screen.findByText("Visitors")).toBeInTheDocument()
    expect(await screen.findByText("158")).toBeInTheDocument()
    expect(screen.getByText("Top Pages")).toBeInTheDocument()
    expect((await screen.findAllByText("Home")).length).toBeGreaterThan(0)
    expect(await screen.findByText("Token table")).toBeInTheDocument()
    expect((await screen.findAllByText("XECX")).length).toBeGreaterThan(0)
    expect((await screen.findAllByText("Firma")).length).toBeGreaterThan(0)

    await waitFor(() => {
      expect(fetchTokenDetailsMock).toHaveBeenCalledWith(TOKEN_ID_B)
      expect(fetchTokenDetailsMock).not.toHaveBeenCalledWith(TOKEN_ID_A)
    })

    await user.click(screen.getByRole("radio", { name: "30D" }))

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes("dashboard?hours=720"))).toBe(true)
      expect(screen.getByText("1,760")).toBeInTheDocument()
    })
  })
})
