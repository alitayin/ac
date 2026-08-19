import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/price", () => ({
  useXECPrice: () => 0.00000681,
}))

vi.mock("@/hooks/use-firma-bid", () => ({
  useFirmaBid: () => ({
    bid: 142437.591777,
    isLoading: false,
    error: null,
  }),
}))

import FirmaDepegAlertDialog from "@/components/ui/FirmaDepegAlertDialog"

const getLocalDateKey = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

describe("FirmaDepegAlertDialog", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it("shows live sell and buyback differences from the $1 peg", async () => {
    render(<FirmaDepegAlertDialog sellPriceXec={160000} />)

    await waitFor(() => {
      expect(screen.getByText("Firma depeg alert")).toBeInTheDocument()
    })

    expect(screen.getByText("$1.090")).toBeInTheDocument()
    expect(screen.getByText("+$0.090 (+8.96%) above $1")).toBeInTheDocument()
    expect(screen.getByText("$0.970")).toBeInTheDocument()
    expect(screen.getByText("-$0.030 (-3.00%) below $1")).toBeInTheDocument()
  })

  it("does not show again after it has been shown today", () => {
    localStorage.setItem("firma-depeg-alert-last-shown", getLocalDateKey())

    render(<FirmaDepegAlertDialog sellPriceXec={160000} />)

    expect(screen.queryByText("Firma depeg alert")).not.toBeInTheDocument()
  })
})
