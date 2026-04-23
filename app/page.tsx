"use client"
import { Suspense, useState } from "react";
import Header from "@/components/ui/header";
import TokenTable from "@/components/ui/TokenTable";
import PromotionalDialog from "@/components/ui/PromotionalDialog";
import AgoraStats from "@/components/ui/AgoraStats";
import RealTimeEtokenFlow from "@/components/ui/RealTimeEtokenFlow";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AnnouncementBanner from "@/components/ui/AnnouncementBanner"
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export default function Home() {
  const [view, setView] = useState<"table" | "flow" | "swap">("table");
  const [flowCount, setFlowCount] = useState(0);

  return (
    <div className="min-h-screen flex flex-col">
            {/* 
      <PromotionalDialog />
      */}
      

        {/*
    <AnnouncementBanner 
      message="AgoraCash ownership token is live, be the new owner of agoracash" 
      link="/"
    />
    */}

      
      <Header />
      
      <main className="flex-1 p-0 sm:p-8">
        <div className="flex flex-col mx-auto md:max-w-6xl space-y-0">
          <Suspense fallback={<div>loading...</div>}>
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

            <div className={view === "table" ? "block" : "hidden"}>
              <ErrorBoundary>
                <Suspense fallback={<div>loading...</div>}>
                  <TokenTable />
                </Suspense>
              </ErrorBoundary>
            </div>

            <div className={view === "flow" ? "block" : "hidden"}>
              <Suspense fallback={<div>loading...</div>}>
                <RealTimeEtokenFlow onCountChange={setFlowCount} />
              </Suspense>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
