import * as React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { tokenTableRenderSpy, flowRenderSpy } = vi.hoisted(() => ({
  tokenTableRenderSpy: vi.fn(),
  flowRenderSpy: vi.fn(),
}))

vi.mock("next/dynamic", async () => {
  const React = await import("react")

  return {
    default: (
      loader: () => Promise<{ default: React.ComponentType<any> } | React.ComponentType<any>>,
      options?: { loading?: () => React.ReactNode },
    ) => {
      return function DynamicComponent(props: Record<string, unknown>) {
        const [LoadedComponent, setLoadedComponent] = React.useState<React.ComponentType<any> | null>(
          null,
        )

        React.useEffect(() => {
          let active = true

          void loader().then((mod) => {
            if (!active) {
              return
            }

            const resolvedComponent =
              typeof mod === "function" ? mod : (mod.default ?? null)
            setLoadedComponent(() => resolvedComponent)
          })

          return () => {
            active = false
          }
        }, [])

        if (!LoadedComponent) {
          return options?.loading ? <>{options.loading()}</> : null
        }

        return <LoadedComponent {...props} />
      }
    },
  }
})

vi.mock("@/components/ui/header", () => ({
  default: () => <div data-testid="header" />,
}))

vi.mock("@/components/ui/AgoraStats", () => ({
  default: () => <div data-testid="agora-stats" />,
}))

vi.mock("@/components/ui/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/ui/TokenTable", () => ({
  default: () => {
    tokenTableRenderSpy()
    return <div data-testid="token-table">Token table content</div>
  },
}))

vi.mock("@/components/ui/RealTimeEtokenFlow", () => ({
  default: ({ onCountChange }: { onCountChange?: (count: number) => void }) => {
    flowRenderSpy()

    React.useEffect(() => {
      onCountChange?.(3)
    }, [onCountChange])

    return <div data-testid="flow-panel">Flow content</div>
  },
}))

import Home from "@/app/page"

describe("Home page", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders the token table by default without mounting the flow panel", async () => {
    render(<Home />)

    expect(screen.getByText("Loading token table...")).toBeInTheDocument()
    expect(screen.queryByText("Loading eToken flow...")).not.toBeInTheDocument()
    expect(flowRenderSpy).not.toHaveBeenCalled()

    expect(await screen.findByTestId("token-table")).toBeInTheDocument()
    expect(screen.queryByTestId("flow-panel")).not.toBeInTheDocument()
    expect(tokenTableRenderSpy).toHaveBeenCalled()
    expect(flowRenderSpy).not.toHaveBeenCalled()
  })

  it("loads the flow panel only after switching views and updates the badge count", async () => {
    render(<Home />)

    await screen.findByTestId("token-table")
    expect(flowRenderSpy).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: /real-time etoken flow/i }))

    expect(screen.getByText("Loading eToken flow...")).toBeInTheDocument()

    expect(await screen.findByTestId("flow-panel")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument()
    })

    expect(screen.queryByTestId("token-table")).not.toBeInTheDocument()
    expect(flowRenderSpy).toHaveBeenCalled()
  })
})
