"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useFirmaBid } from "@/hooks/use-firma-bid"
import { useXECPrice } from "@/lib/price"

const STORAGE_KEY = "firma-depeg-alert-last-shown"
const PEG_USD = 1

type FirmaDepegAlertDialogProps = {
  /** Current Agora sell price in XEC per Firma. */
  sellPriceXec: number | null
  sellPriceLabel?: string
}

const getLocalDateKey = () => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

const isPositiveFinite = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0

const formatUsd = (value: number) => `$${value.toFixed(3)}`

const formatDifference = (value: number) => {
  const difference = value - PEG_USD
  const percentage = Math.abs(difference) * 100
  const sign = difference >= 0 ? "+" : "-"
  const direction = difference > 0 ? "above" : difference < 0 ? "below" : "at"
  return `${sign}$${Math.abs(difference).toFixed(3)} (${sign}${percentage.toFixed(2)}%) ${direction} $1`
}

export default function FirmaDepegAlertDialog({
  sellPriceXec,
  sellPriceLabel = "Agora lowest sell price",
}: FirmaDepegAlertDialogProps) {
  const xecPrice = useXECPrice()
  const { bid: firmaBidXec } = useFirmaBid()
  const [open, setOpen] = useState(false)

  const sellPriceUsd = useMemo(
    () => (isPositiveFinite(sellPriceXec) && isPositiveFinite(xecPrice)
      ? sellPriceXec * xecPrice
      : null),
    [sellPriceXec, xecPrice],
  )
  const buybackPriceUsd = useMemo(
    () => (isPositiveFinite(firmaBidXec) && isPositiveFinite(xecPrice)
      ? firmaBidXec * xecPrice
      : null),
    [firmaBidXec, xecPrice],
  )
  const hasLivePrices = isPositiveFinite(sellPriceUsd) && isPositiveFinite(buybackPriceUsd)
  const isDepegged = hasLivePrices && buybackPriceUsd !== null && buybackPriceUsd < PEG_USD

  useEffect(() => {
    if (!isDepegged || typeof window === "undefined") {
      return
    }

    try {
      if (window.localStorage.getItem(STORAGE_KEY) === getLocalDateKey()) {
        return
      }

      window.localStorage.setItem(STORAGE_KEY, getLocalDateKey())
      setOpen(true)
    } catch {
      // Showing the warning should not depend on storage access being available.
      setOpen(true)
    }
  }, [isDepegged])

  if (!isDepegged || sellPriceUsd === null || buybackPriceUsd === null) {
    return null
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="gap-4 sm:max-w-lg">
        <AlertDialogHeader className="gap-3 text-left">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10">
              <AlertTriangle className="size-5 text-destructive" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <AlertDialogTitle>Firma depeg alert</AlertDialogTitle>
              <AlertDialogDescription>
                Firma is trading away from its $1 peg. Check the live sell and buyback prices before trading.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{sellPriceLabel}</span>
            <span className="flex shrink-0 flex-col items-end text-right font-semibold tabular-nums text-foreground">
              <span>{formatUsd(sellPriceUsd)}</span>
              <span className={`text-xs font-medium ${sellPriceUsd >= PEG_USD ? "text-primary" : "text-destructive"}`}>
                {formatDifference(sellPriceUsd)}
              </span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Firma buyback price</span>
            <span className="flex shrink-0 flex-col items-end text-right font-semibold tabular-nums text-foreground">
              <span>{formatUsd(buybackPriceUsd)}</span>
              <span className="text-xs font-medium text-destructive">
                {formatDifference(buybackPriceUsd)}
              </span>
            </span>
          </div>
        </div>

        <AlertDialogDescription className="text-xs">
          Prices are live references and can change. This reminder is shown once per day.
        </AlertDialogDescription>

        <AlertDialogFooter>
          <AlertDialogAction>Got it</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
