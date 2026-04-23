"use client"

import dynamic from "next/dynamic"
import { Suspense, useState } from "react"

import Header from "@/components/ui/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import AgoraStats from "@/components/ui/AgoraStats"
import { ErrorBoundary } from "@/components/ui/ErrorBoundary"

const TokenTable = dynamic(() => import("@/components/ui/TokenTable"), {
  loading: () => <SectionLoading label="Loading token table..." />,
})

const RealTimeEtokenFlow = dynamic(
  () => import("@/components/ui/RealTimeEtokenFlow"),
  {
    loading: () => <SectionLoading label="Loading eToken flow..." />,
  },
)

function SectionLoading({ label }: { label: string }) {
  return (
    <div className="rounded-xl border bg-background p-6 text-sm text-muted-foreground">
      {label}
    </div>
  )
}

export default function Home() {
  const [view, setView] = useState<"table" | "flow">("table")
  const [flowCount, setFlowCount] = useState(0)

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 p-0 sm:p-8">
        <div className="flex flex-col mx-auto md:max-w-6xl space-y-0">
          <Suspense fallback={<SectionLoading label="Loading Agora stats..." />}>
            <AgoraStats />
          </Suspense>

          <div className="p-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={view === "table" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("table")}
                className="font-normal tracking-tight"
              >
                Token Table
              </Button>
              <Button
                variant={view === "flow" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("flow")}
                className="font-normal tracking-tight flex items-center gap-2"
              >
                Real-time eToken Flow
                {flowCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 h-5 min-w-[20px] rounded-full px-1.5 text-xs font-semibold"
                  >
                    {flowCount}
                  </Badge>
                )}
              </Button>
            </div>

            {view === "table" ? (
              <ErrorBoundary>
                <TokenTable />
              </ErrorBoundary>
            ) : (
              <RealTimeEtokenFlow onCountChange={setFlowCount} />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
