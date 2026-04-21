"use client"

import * as React from "react"
import { MoonStar, SunMedium } from "lucide-react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && resolvedTheme === "dark"
  const nextTheme = isDark ? "light" : "dark"

  return (
    <button
      type="button"
      aria-label={mounted ? `Switch to ${nextTheme} mode` : "Toggle color mode"}
      title={mounted ? `Switch to ${nextTheme} mode` : "Toggle color mode"}
      onClick={() => setTheme(nextTheme)}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-foreground/10 bg-background/80 text-foreground shadow-none backdrop-blur transition-[background-color,border-color,box-shadow,opacity] duration-200 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 dark:shadow-sm",
        !mounted && "pointer-events-none opacity-0",
        className,
      )}
    >
      {isDark ? (
        <MoonStar className="size-4 text-sky-300 transition-colors duration-200" />
      ) : (
        <SunMedium className="size-4 text-amber-500 transition-colors duration-200" />
      )}
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
