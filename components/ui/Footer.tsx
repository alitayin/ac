"use client"

import { useEffect, useRef } from "react"

declare global {
  interface Window {
    PayButton: any
  }
}

export default function Footer() {
  const ecoRef = useRef<HTMLDivElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const tryRender = () => {
      if (
        typeof window !== "undefined" &&
        window.PayButton &&
        ecoRef.current &&
        tipRef.current
      ) {
        window.PayButton.render(ecoRef.current, {
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
        window.PayButton.render(tipRef.current, {
          to: "ecash:qr6lws9uwmjkkaau4w956lugs9nlg9hudqs26lyxkv",
          text: "Tip Alita Directly ❤",
          hoverText: "She\u2019s volunteering!",
          animation: "invert",
          theme: {
            palette: {
              primary: "#18181b",
              secondary: "#fafafa",
              tertiary: "#3f3f46",
            },
          },
        })
      } else {
        setTimeout(tryRender, 300)
      }
    }
    tryRender()
  }, [])

  return (
    <footer className="w-full border-t border-border mt-12 py-8 px-4">
      <div className="max-w-4xl mx-auto flex flex-col items-center gap-6">

        {/* PayButtons */}
        <div className="flex flex-col sm:flex-row gap-8 items-center justify-center w-full">
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground text-center">Support eCash ecosystem development</p>
            <div ref={ecoRef} />
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground text-center">Tip Alita directly &mdash; she&apos;s volunteering</p>
            <div ref={tipRef} />
          </div>
        </div>

        {/* Copyright */}
        <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
          <span>© eCash Ecosystem Hub</span>
        </div>

      </div>
    </footer>
  )
}
