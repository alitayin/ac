"use client"

import { useEffect, useRef, type RefObject } from "react"
import { usePathname } from "next/navigation"
import { ExternalLink } from "lucide-react"

type PayButtonRenderer = {
  render: (_target: HTMLElement, _options: Record<string, unknown>) => void
}

export default function Footer() {
  const ecoRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const isHomePage = pathname === "/"

  useEffect(() => {
    let retryId: ReturnType<typeof setTimeout> | undefined
    let cancelled = false

    const tryRender = () => {
      const payButton =
        typeof window !== "undefined"
          ? (window as Window & { PayButton?: PayButtonRenderer }).PayButton
          : undefined

      if (payButton && ecoRef.current) {
        payButton.render(ecoRef.current, {
          to: "ecash:qpaw7v7sfvlsm4px33saggr63jgsalsx4q49m7n6v4",
          text: "Support eCash Ecosystem",
          hoverText: "Support eCash Development",
          animation: "invert",
          theme: {
            palette: {
              primary: "#18181b",
              secondary: "#fafafa",
              tertiary: "#3f3f46",
            },
          },
        })
      } else if (!cancelled) {
        retryId = setTimeout(tryRender, 300)
      }
    }

    tryRender()

    return () => {
      cancelled = true
      if (retryId) {
        clearTimeout(retryId)
      }
    }
  }, [])

  const openHiddenPayButton = (ref: RefObject<HTMLDivElement>) => {
    ref.current?.querySelector("button")?.click()
  }

  const textButtonClass =
    "cursor-pointer text-center text-sm font-normal tracking-tight text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"

  return (
    <>
      {isHomePage ? <div aria-hidden className="h-56 sm:h-32" /> : null}
      <footer
        className={
          isHomePage
            ? "fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 rounded-2xl border border-border/40 bg-background/95 px-4 py-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:w-[calc(100%-3rem)] sm:px-6"
            : "w-full mt-12 py-8 px-4"
        }
      >
        <div
          className={
            isHomePage
              ? "mx-auto flex flex-col items-center gap-4 md:flex-row md:justify-between"
              : "mx-auto flex max-w-4xl flex-col items-center gap-6"
          }
        >
          <div
            className={
              isHomePage
                ? "flex w-full flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6 md:w-auto"
                : "flex w-full flex-col items-center justify-center gap-8 sm:flex-row"
            }
          >
            <a
              href="https://awt.alitayin.com/"
              target="_blank"
              rel="noopener noreferrer"
              className={textButtonClass}
            >
              Hire Alita by AWT
            </a>
          </div>

          <div
            className={
              isHomePage
                ? "inline-flex shrink-0 items-center gap-3"
                : "inline-flex items-center gap-3"
            }
          >
            <a
              href="https://ecashecosystem.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-normal tracking-tight text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              © eCash Ecosystem Hub
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
            <button
              type="button"
              className={textButtonClass}
              onClick={() => openHiddenPayButton(ecoRef)}
            >
              Support Us
            </button>
          </div>
        </div>
      </footer>
      <div aria-hidden className="sr-only">
        <div ref={ecoRef} />
      </div>
    </>
  )
}
