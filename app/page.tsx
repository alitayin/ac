"use client"
import { Suspense, useState } from "react";
import Header from "@/components/ui/header";
import TokenTable from "@/components/ui/TokenTable";
import PromotionalDialog from "@/components/ui/PromotionalDialog";
import AgoraStats from "@/components/ui/AgoraStats";
import RealTimeEtokenFlow from "@/components/ui/RealTimeEtokenFlow";
import { Button } from "@/components/ui/button";
import { SwapPanel } from "@/app/swap/SwapPanel";
import AnnouncementBanner from "@/components/ui/AnnouncementBanner";

export default function Home() {
  const [view, setView] = useState<"table" | "flow" | "swap">("table");

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
              >
                Token Table
              </Button>
              <Button
                variant={view === "flow" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("flow")}
              >
                Real-time eToken Flow
              </Button>
            </div>

            <div className={view === "table" ? "block" : "hidden"}>
              <Suspense fallback={<div>loading...</div>}>
                <TokenTable />
              </Suspense>
            </div>

            <div className={view === "flow" ? "block" : "hidden"}>
              <Suspense fallback={<div>loading...</div>}>
                <RealTimeEtokenFlow />
              </Suspense>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}