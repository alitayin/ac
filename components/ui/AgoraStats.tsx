"use client"

import { useEffect, useState } from "react";

interface DailyVolumeData {
  date: string;
  xecx: number;
  firma: number;
  other: number;
  total: number;
}

interface CumulativeVolumeData {
  date: string;
  xecx: number;
  firma: number;
  other: number;
  total: number;
}

interface GenesisData {
  date: string;
  genesis_alp_standard: number;
  genesis_slp_fungible: number;
  genesis_slp_mint_vault: number;
  genesis_slp_nft1_group: number;
  genesis_slp_nft1_child: number;
}

interface VolumeUSDData {
  date: string;
  usd: number;
  xecx_usd: number;
  firma_usd: number;
  other_usd: number;
}

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
    <div className="flex flex-col space-y-1">
      <div className="text-sm text-gray-400">{title}</div>
      <div className="text-lg font-semibold">{value}</div>
      <div className={`text-xs ${changeColor} flex items-center text-xs gap-1`}>
        {arrow} {Math.abs(change).toFixed(2)}% today
      </div>
    </div>
  );
}

function calculateChange(today: number, yesterday: number): number {
  if (yesterday === 0) return 0;
  return ((today - yesterday) / yesterday) * 100;
}

function formatNumber(num: number, decimals: number = 2): string {
  if (num >= 1e9) {
    return `${(num / 1e9).toFixed(decimals)}B`;
  } else if (num >= 1e6) {
    return `${(num / 1e6).toFixed(decimals)}M`;
  } else if (num >= 1e3) {
    return `${(num / 1e3).toFixed(decimals)}K`;
  }
  return num.toFixed(decimals);
}

export default function AgoraStats() {
  const [stats, setStats] = useState<{
    dailyVolume: string;
    dailyVolumeChange: number;
    totalVolume: string;
    totalVolumeChange: number;
    newTokens: string;
    newTokensChange: number;
    volumeUSD: string;
    volumeUSDChange: number;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAgoraStats() {
      try {
        const response = await fetch('/api/agora-stats');
        
        if (!response.ok) {
          throw new Error('Failed to fetch stats');
        }
        
        const { dailyVolume, cumulativeVolume, genesisData, volumeUSD } = await response.json();

        const todayVolume = dailyVolume[dailyVolume.length - 1];
        const yesterdayVolume = dailyVolume[dailyVolume.length - 2];

        const todayCumulative = cumulativeVolume[cumulativeVolume.length - 1];
        const yesterdayCumulative = cumulativeVolume[cumulativeVolume.length - 2];

        const todayGenesis = genesisData[genesisData.length - 1];
        const yesterdayGenesis = genesisData[genesisData.length - 2];

        const todayUSD = volumeUSD[volumeUSD.length - 1];
        const yesterdayUSD = volumeUSD[volumeUSD.length - 2];

        const volumeChange = calculateChange(
          todayVolume?.total || 0,
          yesterdayVolume?.total || 0
        );

        const cumulativeChange = calculateChange(
          todayCumulative?.total || 0,
          yesterdayCumulative?.total || 0
        );

        const todayTotalGenesis = todayGenesis 
          ? todayGenesis.genesis_alp_standard + 
            todayGenesis.genesis_slp_fungible + 
            todayGenesis.genesis_slp_mint_vault + 
            todayGenesis.genesis_slp_nft1_group + 
            todayGenesis.genesis_slp_nft1_child
          : 0;

        const yesterdayTotalGenesis = yesterdayGenesis
          ? yesterdayGenesis.genesis_alp_standard + 
            yesterdayGenesis.genesis_slp_fungible + 
            yesterdayGenesis.genesis_slp_mint_vault + 
            yesterdayGenesis.genesis_slp_nft1_group + 
            yesterdayGenesis.genesis_slp_nft1_child
          : 0;

        const genesisChange = calculateChange(todayTotalGenesis, yesterdayTotalGenesis);

        const usdChange = calculateChange(
          todayUSD?.usd || 0,
          yesterdayUSD?.usd || 0
        );

        setStats({
          dailyVolume: formatNumber((todayVolume?.total || 0) / 100, 2),
          dailyVolumeChange: volumeChange,
          totalVolume: formatNumber((todayCumulative?.total || 0) / 100, 2),
          totalVolumeChange: cumulativeChange,
          newTokens: todayTotalGenesis.toString(),
          newTokensChange: genesisChange,
          volumeUSD: `$${formatNumber(todayUSD?.usd || 0, 2)}`,
          volumeUSDChange: usdChange
        });
        setError(null);
      } catch (error) {
        console.error('Failed to fetch Agora stats:', error);
        setError(error instanceof Error ? error.message : 'Failed to load stats');
        setStats({
          dailyVolume: "0",
          dailyVolumeChange: 0,
          totalVolume: "0",
          totalVolumeChange: 0,
          newTokens: "0",
          newTokensChange: 0,
          volumeUSD: "$0",
          volumeUSDChange: 0
        });
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
        <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded text-sm">
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

