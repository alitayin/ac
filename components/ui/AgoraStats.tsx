"use client"

import { useEffect, useState } from "react";

import {
  type AgoraStatsApiResponse,
  type AgoraStatsViewModel,
  EMPTY_AGORA_STATS,
  buildAgoraStatsViewModel,
} from "@/lib/agora-stats"

interface StatCardProps {
  title: string;
  value: string;
  change: number;
  isPositive?: boolean;
}

function StatCard({ title, value, change, isPositive = true }: StatCardProps) {
  const changeColor = change > 0 ? "text-green-500" : change < 0 ? "text-red-500" : "text-gray-500";
  const arrow = change > 0 ? "▲" : change < 0 ? "▼" : "";

  return (
    <div className="flex flex-col space-y-1.5">
      <div className="text-sm text-gray-400 font-normal tracking-tight">{title}</div>
      <div className="text-2xl font-semibold tracking-tight leading-tight">{value}</div>
      <div className={`text-xs ${changeColor} flex items-center gap-1 font-normal tracking-tight`}>
        {arrow} {Math.abs(change).toFixed(2)}% today
      </div>
    </div>
  );
}

export default function AgoraStats() {
  const [stats, setStats] = useState<AgoraStatsViewModel | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAgoraStats() {
      try {
        const response = await fetch("/api/agora-stats", {
          cache: "no-store",
        });
        const payload = (await response.json()) as AgoraStatsApiResponse

        if (!response.ok) {
          throw new Error(payload.error || "Failed to fetch stats");
        }

        setStats(buildAgoraStatsViewModel(payload));
        setError(payload.warnings?.length ? payload.warnings.join("; ") : null);
      } catch (error) {
        console.error("Failed to fetch Agora stats:", error);
        setError(error instanceof Error ? error.message : "Failed to load stats");
        setStats(EMPTY_AGORA_STATS);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAgoraStats();
  }, []);

  if (isLoading) {
    return (
      <div className="w-full py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4">
          <div className="flex flex-col space-y-2 animate-pulse">
            <div className="h-4 bg-muted rounded w-20"></div>
            <div className="h-8 bg-muted rounded w-24"></div>
            <div className="h-3 bg-muted rounded w-16"></div>
          </div>
          <div className="flex flex-col space-y-2 animate-pulse">
            <div className="h-4 bg-muted rounded w-20"></div>
            <div className="h-8 bg-muted rounded w-24"></div>
            <div className="h-3 bg-muted rounded w-16"></div>
          </div>
          <div className="flex flex-col space-y-2 animate-pulse">
            <div className="h-4 bg-muted rounded w-20"></div>
            <div className="h-8 bg-muted rounded w-24"></div>
            <div className="h-3 bg-muted rounded w-16"></div>
          </div>
          <div className="flex flex-col space-y-2 animate-pulse">
            <div className="h-4 bg-muted rounded w-20"></div>
            <div className="h-8 bg-muted rounded w-24"></div>
            <div className="h-3 bg-muted rounded w-16"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="w-full py-6">
      {error && (
        <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-lg text-sm font-normal tracking-tight">
          ⚠️ Failed to load real-time data: {error}
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4">
        <StatCard
          title="1D Volume"
          value={stats.dailyVolume}
          change={stats.dailyVolumeChange}
        />
        <StatCard
          title="Total Agora Volume"
          value={stats.totalVolume}
          change={stats.totalVolumeChange}
        />
        <StatCard
          title="New eTokens Created"
          value={stats.newTokens}
          change={stats.newTokensChange}
        />
        <StatCard
          title="1D Volume USD"
          value={stats.volumeUSD}
          change={stats.volumeUSDChange}
        />
      </div>
    </div>
  );
}
