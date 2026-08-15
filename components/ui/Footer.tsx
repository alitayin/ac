"use client"

import { ExternalLink } from "lucide-react"

export default function Footer() {
  const textButtonClass =
    "cursor-pointer text-center text-sm font-normal tracking-tight text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"

  return (
    <>
      <div aria-hidden className="h-56 sm:h-32" />
      <footer className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 rounded-2xl border border-border/40 bg-background/95 px-4 py-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:w-[calc(100%-3rem)] sm:px-6">
        <div className="mx-auto flex flex-col items-center gap-4 md:flex-row md:justify-between">
          <div className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6 md:w-auto">
            <a
              href="https://awt.alitayin.com/"
              target="_blank"
              rel="noopener noreferrer"
              className={textButtonClass}
            >
              Hire Alita by AWT
            </a>
          </div>

          <div className="inline-flex shrink-0 items-center gap-3">
            <a
              href="https://ecashecosystem.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-normal tracking-tight text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              © eCash Ecosystem Hub
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </footer>
    </>
  )
}
