import AnalyticsDashboard from "@/components/ui/AnalyticsDashboard"
import Header from "@/components/ui/header"

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/40 via-background to-background" />
        <div className="relative mx-auto flex max-w-5xl flex-col gap-8 p-4 pb-12 sm:p-8">
          <AnalyticsDashboard />
        </div>
      </main>
    </div>
  )
}
