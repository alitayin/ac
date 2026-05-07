"use client"
import Header from "@/components/ui/header";
import { useParams } from "next/navigation"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import RealtimePrice from "@/components/ui/realtimeprice"
import VolumeChart from "@/components/ui/VolumeChart";
import PriceChart from "@/components/ui/PriceChart";
import Piechart from "@/components/ui/Piechart";
import TokenTx from "@/components/ui/TokenTx";
import { Button } from "@/components/ui/button"
import { tokens } from "@/config/tokens";
import { useEffect, useState, useRef } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import OrderBook from "@/components/ui/OrderBook"
import { ErrorBoundary } from "@/components/ui/ErrorBoundary"
import AddressDistribution from "@/components/ui/AddressDistribution"
import TokenCommentsPanel from "@/components/ui/TokenCommentsPanel"
import TokenProjectInfoCard from "@/components/ui/TokenProjectInfoCard"
import { useWallet } from "@/lib/context/WalletContext"
import { useToast } from "@/hooks/use-toast"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { formatNumber } from "@/lib/formatters"
import { getTokenSupply } from "@/lib/tokenSupply"
import { fetchTokenDetails, getTokenDecimalsFromDetails } from "@/lib/chronik"
import { fetchAgoraOrderBook } from "@/lib/agora-orders"
import { isEtokenDbAvailable } from "@/lib/etokendb"
import {
  DEFAULT_BASE_NETWORK_FEE_XEC,
  estimateNetworkFeeXecFromAddress,
} from "@/lib/networkFee"
import {
  calculateAgoraFeeSummary,
  estimateAgoraTokenCostFromBudget,
} from "@/lib/agora-swap-fee"
import {
  getCachedTokenSummary,
  SUMMARY_CACHE_TTL_MS,
} from "@/lib/token-stats"
import { watchAgoraTokens } from "@/lib/agora-ws"
import { loadTokenPageStats } from "@/lib/token-page-stats"
import { queueOrdersSync } from "@/lib/Auto.js"
import {
  createSwapOrderKey,
  dispatchOrdersUpdated,
  writeSwapOrders,
} from "@/lib/swap-order-utils"
import { cn } from "@/lib/utils"

const MIN_ORDER_TOTAL_XEC = 100;

interface TokenData {
  tokenId: string;
  name: string;
  symbol: string;
  telegramUrl?: string;
  feature?: string;
  description?: {
    title?: string;
    content?: string;
  }
}

type TokenPageStatTone = "positive" | "negative" | "neutral"

type TokenPageStat = {
  label: string
  value: string
  detail?: string | null
  detailTone?: TokenPageStatTone
}

function TokenStatsCard({ stats }: { stats: TokenPageStat[] }) {
  return (
    <Card className="rounded-3xl">
      <CardHeader className="p-4 pb-3">
        <CardTitle className="text-base">Stats</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="grid grid-cols-2 gap-2">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="min-w-0 rounded-2xl border border-border/60 bg-muted/10 px-3 py-2.5"
            >
              <p className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {stat.label}
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">
                {stat.value}
              </p>
              {stat.detail ? (
                <p
                  className={cn(
                    "mt-1 truncate text-xs",
                    stat.detailTone === "positive" && "text-primary",
                    stat.detailTone === "negative" && "text-destructive",
                    (!stat.detailTone || stat.detailTone === "neutral") &&
                      "text-muted-foreground",
                  )}
                >
                  {stat.detail}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function TokenPage() {
  const params = useParams()
  const { toast } = useToast()
  const { isWalletConnected, ecashAddress, balance } = useWallet()
  const [stats, setStats] = useState<any>(null)
  const [chainTipHeight, setChainTipHeight] = useState<number | null>(null)
  const [selectedChart, setSelectedChart] = useState("realtimeprice")
  const [supply, setSupply] = useState<string>('0')
  const [orderBook, setOrderBook] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'trading' | 'orderbook' | 'address' | 'comments'>('trading');
  const [showOrderCheckDialog, setShowOrderCheckDialog] = useState<boolean>(false)
  const [orderCheckInfo, setOrderCheckInfo] = useState<{
    insufficientCount: number;
    insufficientOrders: string[];
  }>({
    insufficientCount: 0,
    insufficientOrders: []
  })
  const [chronikTokenInfo, setChronikTokenInfo] = useState<any>(null)
  const [networkFee, setNetworkFee] = useState<number>(DEFAULT_BASE_NETWORK_FEE_XEC)
  
  const isLoadingStats = useRef<boolean>(false)

  const calculateNetworkFeeFromUtxos = async (): Promise<number> => {
    try {
      if (!isWalletConnected || !ecashAddress) {
        setNetworkFee(DEFAULT_BASE_NETWORK_FEE_XEC)
        return DEFAULT_BASE_NETWORK_FEE_XEC
      }

      const { fee } = await estimateNetworkFeeXecFromAddress(ecashAddress)
      setNetworkFee(fee)
      return fee
    } catch (error) {
      console.error(
        "Failed to calculate network fee from UTXOs, fallback to base fee:",
        error
      )
      setNetworkFee(DEFAULT_BASE_NETWORK_FEE_XEC)
      return DEFAULT_BASE_NETWORK_FEE_XEC
    }
  }

  useEffect(() => {
    const checkLocalOrders = () => {
      if (!ecashAddress) return;
      
      const existingOrders = JSON.parse(localStorage.getItem('swap_orders') || '{}');
      let insufficientCount = 0;
      const insufficientOrderKeys: string[] = [];

      Object.entries(existingOrders).forEach(([key, order]: [string, any]) => {
        const parts = key.split('|');
        const address = parts[1];
        if (address !== ecashAddress) return;

        const budget = order.remainingAmount * order.maxPrice;
        const totalRequired = calculateAgoraFeeSummary(budget, networkFee).totalCostXec;
        if (totalRequired < MIN_ORDER_TOTAL_XEC && order.maxPrice <= 1 && order.status !== 'completed' && order.remainingAmount !== 0) {
          insufficientCount++;
          insufficientOrderKeys.push(key);
        }
      });

      if (insufficientCount > 0) {
        setOrderCheckInfo({
          insufficientCount,
          insufficientOrders: insufficientOrderKeys
        });
        setShowOrderCheckDialog(true);
      }
    };

    const timer = setTimeout(checkLocalOrders, 1000);
    return () => clearTimeout(timer);
  }, [ecashAddress, networkFee]);

  useEffect(() => {
    void calculateNetworkFeeFromUtxos();
  }, [isWalletConnected, ecashAddress]);

  const rawName = params.name.toString();
  let decodedName: string;
  if (rawName.includes(' ') || !rawName.includes('%')) {
    decodedName = rawName;
  } else {
    try {
      decodedName = decodeURIComponent(rawName);
    } catch (e) {
      decodedName = rawName;
    }
  }
  const normalizeString = (str: string) => str.toLowerCase().trim().replace(/\s+/g, ' ');
  const routeParam = decodedName.trim();
  const normalizedRouteParam = normalizeString(routeParam);
  const isValidTokenId = /^[a-f0-9]{64}$/i.test(routeParam);

  const tokenEntries = Object.entries(tokens);
  const matchedTokenById = tokenEntries.find(
    ([, value]) => value.tokenId.toLowerCase() === routeParam.toLowerCase(),
  )?.[1];
  const matchedTokenByNameOrKey = !matchedTokenById
    ? tokenEntries.find(([key, value]) => {
        const normalizedKey = normalizeString(key);
        const normalizedName = normalizeString(value.name);
        return normalizedKey === normalizedRouteParam || normalizedName === normalizedRouteParam;
      })?.[1]
    : undefined;
  const matchedToken = matchedTokenById ?? matchedTokenByNameOrKey;

  const isCustomToken = !matchedToken && isValidTokenId;
  const hasValidRoute = Boolean(matchedToken || isValidTokenId);

  const configuredTokenDecimals =
    typeof (matchedToken as any)?.decimals === "number" ? (matchedToken as any).decimals : undefined
  const resolvedChronikTokenDecimals =
    chronikTokenInfo
      ? getTokenDecimalsFromDetails(chronikTokenInfo, 0)
      : undefined
  const tokenDecimals = resolvedChronikTokenDecimals ?? configuredTokenDecimals ?? 0
  const knownTokenDecimals = resolvedChronikTokenDecimals ?? configuredTokenDecimals
  const authPubkey = chronikTokenInfo?.genesisInfo?.authPubkey ?? null
  const createdBlockHeight =
    typeof chronikTokenInfo?.block?.height === "number"
      ? chronikTokenInfo.block.height
      : null
  const createdTimestamp =
    typeof chronikTokenInfo?.block?.timestamp === "number"
      ? chronikTokenInfo.block.timestamp
      : typeof chronikTokenInfo?.timeFirstSeen === "number" &&
          chronikTokenInfo.timeFirstSeen > 0
        ? chronikTokenInfo.timeFirstSeen
        : null
  const websiteUrl =
    typeof chronikTokenInfo?.genesisInfo?.url === "string" &&
    chronikTokenInfo.genesisInfo.url.trim()
      ? chronikTokenInfo.genesisInfo.url
      : stats?.url

  let tokenData: TokenData;

  if (matchedToken) {
    tokenData = matchedToken;
  } else if (isValidTokenId) {
    const chronikName = chronikTokenInfo?.genesisInfo?.tokenName;
    const chronikTicker = chronikTokenInfo?.genesisInfo?.tokenTicker;
    
    tokenData = {
      tokenId: routeParam,
      name: chronikName || (stats ? (stats.tokenName || routeParam) : "loading"),
      symbol: chronikTicker || (stats ? (stats.tokenTicker || routeParam) : "loading"),
    };
  } else {
    tokenData = {
      tokenId: "",
      name: decodedName,
      symbol: "",
    };
  }

  if (tokenData.name === "TridentbyHodlWars") {
    tokenData = {
      ...tokenData,
      name: "Trident by Hodl Wars"
    };
  }

  useEffect(() => {
    const fetchChronikTokenInfo = async () => {
      if (!hasValidRoute || !tokenData.tokenId) {
        setChronikTokenInfo(null);
        return;
      }

      try {
        const tokenDetails = await fetchTokenDetails(tokenData.tokenId);
        setChronikTokenInfo(tokenDetails);
      } catch (error) {
        setChronikTokenInfo(null);
      }
    };

    fetchChronikTokenInfo();
  }, [hasValidRoute, tokenData.tokenId]);

  const fetchOrderBook = async () => {
    try {
      const data = await fetchAgoraOrderBook(tokenData.tokenId)
      if (data.success && data.data) {
        setOrderBook(data.data)
      } else {
        setOrderBook(null)
      }
    } catch (error) {
      setOrderBook(null)
    }
  }

  const loadTokenStats = async (
    tokenId: string,
    name: string,
    options?: { etokenDbAvailable?: boolean },
  ) => {
    if (isLoadingStats.current) {
      return
    }
    
    isLoadingStats.current = true
    
    try {
      const etokenDbAvailable = options?.etokenDbAvailable ?? (await isEtokenDbAvailable())
      const result = await loadTokenPageStats({
        tokenId,
        tokenName: name,
        chainTipHeight,
        etokenDbAvailable,
        tokenDecimals: knownTokenDecimals,
      })

      setStats(result.stats)
      if (typeof result.nextChainTipHeight === "number") {
        setChainTipHeight(result.nextChainTipHeight)
      }
    } finally {
      isLoadingStats.current = false
    }
  }

  const loadTokenStatsRef = useRef(loadTokenStats)
  useEffect(() => {
    loadTokenStatsRef.current = loadTokenStats
  }, [loadTokenStats])

  useEffect(() => {
    const fetchData = async () => {
      if (!hasValidRoute || !tokenData.tokenId) {
        return
      }

      try {
        const etokenDbAvailable = await isEtokenDbAvailable()
        const cachedSummary = getCachedTokenSummary(tokenData.tokenId)
        const summaryValid =
          !etokenDbAvailable &&
          cachedSummary && Date.now() - cachedSummary.computedAt < SUMMARY_CACHE_TTL_MS
        
        if (summaryValid) {
          setStats(cachedSummary!.data)
        }

        await Promise.all([
          (async () => {
            if (!summaryValid) {
              await loadTokenStats(tokenData.tokenId, tokenData.name, {
                etokenDbAvailable,
              })
            }
          })(),
          (async () => {
            const result = await getTokenSupply(tokenData.tokenId)
            setSupply(result)
          })(),
          fetchOrderBook()
        ])
      } catch {
      }
    }
    
    fetchData()
    const interval = setInterval(fetchData, 30000)
    
    return () => clearInterval(interval)
  }, [hasValidRoute, tokenData.tokenId, tokenData.name])

  useEffect(() => {
    if (!hasValidRoute || !tokenData.tokenId) {
      return
    }

    const unsubscribe = watchAgoraTokens([tokenData.tokenId], (id) => {
      if (id === tokenData.tokenId) {
        loadTokenStatsRef.current?.(tokenData.tokenId, tokenData.name)
      }
    })

    return () => unsubscribe()
  }, [hasValidRoute, tokenData.tokenId, tokenData.name])

  const marketCap = stats && supply && !isNaN(stats.latestPrice) && !isNaN(Number(supply)) 
    ? (stats.latestPrice * Number(supply)) 
    : 0

  const rawLatestPrice = typeof stats?.latestPrice === 'number' ? stats.latestPrice : 0
  const displayLatestPrice = rawLatestPrice

  const rawChange = typeof stats?.priceChange24h === 'number' ? stats.priceChange24h : 0
  const isDrop = rawChange < 0
  const displayChange = isDrop ? Math.min(Math.abs(rawChange), 10) : rawChange
  const supplyNote =
    tokenData.tokenId === 'd1131675cb62b65909fb45ba53b022da0bd0f34aaa71fc61770115472b186ffb'
      ? "74M SS frozed(belongs to GNC)"
      : null
  const tokenPageStats = [
    {
      label: "MCAP",
      value: `${formatNumber(marketCap)} XEC`,
    },
    {
      label: "Price",
      value: displayLatestPrice ? displayLatestPrice.toFixed(4) : "0.0000",
      detail: `${rawChange >= 0 ? "+" : ""}${displayChange.toFixed(2)}%`,
      detailTone: rawChange >= 0 ? "positive" as const : "negative" as const,
    },
    {
      label: "1D VOL",
      value: `${formatNumber(stats?.last24HoursXECAmount || 0)} XEC`,
    },
    {
      label: "Supply",
      value: formatNumber(Number(supply)),
      detail: supplyNote,
      detailTone: "neutral" as const,
    },
    {
      label: "Sales 30D",
      value: formatNumber(stats?.totalTransactions || 0, true),
    },
    {
      label: "30D VOL",
      value: `${formatNumber(stats?.last30DaysXECAmount || 0)} XEC`,
    },
  ]

  const handleAdjustInsufficientOrders = async () => {
    const existingOrders = JSON.parse(localStorage.getItem('swap_orders') || '{}');
    const currentBalance = parseFloat(balance);
    let adjustedCount = 0;

    if (orderCheckInfo.insufficientOrders.length > 0) {
      const actualSpendAmount = estimateAgoraTokenCostFromBudget(
        MIN_ORDER_TOTAL_XEC,
        networkFee,
      );
      const actualTotalRequired = calculateAgoraFeeSummary(
        actualSpendAmount,
        networkFee,
      ).totalCostXec;

      if (currentBalance < actualTotalRequired) {
        toast({
          title: "Cannot adjust orders",
          description: `Insufficient balance. Required: ${actualTotalRequired.toFixed(2)} XEC, Available: ${currentBalance.toFixed(2)} XEC`,
          variant: "destructive",
        });
        setShowOrderCheckDialog(false);
        return;
      }

      for (const orderKey of orderCheckInfo.insufficientOrders) {
        const parts = orderKey.split('|');
        const tokenId = parts[0];
        const address = parts[1];
        const priceStr = parts[2];

        try {
          const data = await fetchAgoraOrderBook(tokenId);
          
          if (!data.success || !data.data?.orders || data.data.orders.length === 0) {
            continue;
          }

          const orderBook = data.data;
          const sortedOrders = [...orderBook.orders].sort((a: any, b: any) => a.price - b.price);
          
          let remainingXec = actualSpendAmount;
          let totalTokens = 0;
          let highestPrice = 0;

          for (const order of sortedOrders) {
            const orderCost = order.price * order.amount;
            if (remainingXec >= orderCost) {
              totalTokens += order.amount;
              remainingXec -= orderCost;
              highestPrice = order.price;
            } else {
              const partialAmount = remainingXec / order.price;
              totalTokens += partialAmount;
              highestPrice = order.price;
              break;
            }
            
            if (remainingXec <= 0) break;
          }

          if (totalTokens > 0 && highestPrice > 0) {
            const existingPrice = Number(priceStr);
            const existingSuffix = parts[3];
            const shouldReuseExistingKey =
              typeof existingSuffix === "string" &&
              existingSuffix.length > 0 &&
              existingPrice === highestPrice;
            const newOrderKey = shouldReuseExistingKey
              ? orderKey
              : createSwapOrderKey(tokenId, address, highestPrice);

            if (newOrderKey !== orderKey) {
              delete existingOrders[orderKey];
            }
            
            existingOrders[newOrderKey] = {
              remainingAmount: totalTokens,
              maxPrice: highestPrice,
              status: "pending",
              orderType: "online",
              transactions: existingOrders[orderKey]?.transactions || [],
              createdAt: existingOrders[orderKey]?.createdAt || new Date().toISOString()
            };
            
            adjustedCount++;
          }
        } catch (error) {
        }
      }
    }

    writeSwapOrders(existingOrders);
    dispatchOrdersUpdated("processed");

    if (ecashAddress) {
      void queueOrdersSync(existingOrders, ecashAddress).then((synced) => {
        if (synced) {
          return;
        }

        console.error('❌ Failed to push adjusted orders to server');
      });
    }

    if (adjustedCount > 0) {
      toast({
        title: "✅ Orders updated",
        description: `${adjustedCount} order(s) adjusted`,
      });
    }

    setShowOrderCheckDialog(false);
  };

  if (!hasValidRoute) {
    return (
      <>
        <Header />
        <div className="container mx-auto max-w-7xl p-4">
          <Card>
            <CardHeader>
              <CardTitle>Token Not Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No token matches <span className="font-medium text-foreground">{decodedName}</span>.
              </p>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  return (
    <>
      <Header />
      <div className="container mx-auto max-w-7xl p-1 pt-0 sm:p-4 sm:pt-0">
        <div className="flex flex-col lg:flex-row gap-10 mt-10">
        <div className="w-full lg:hidden">
          <div className="p-4">
            <TokenProjectInfoCard
              tokenId={tokenData.tokenId}
              tokenName={tokenData.name}
              authPubkey={authPubkey}
              tokenTicker={tokenData.symbol}
              createdBlockHeight={createdBlockHeight}
              createdTimestamp={createdTimestamp}
              fallbackWebsiteUrl={websiteUrl}
              fallbackTelegramUrl={!isCustomToken ? tokenData.telegramUrl : null}
            />
          </div>
          <div className="p-4 pt-0">
            <TokenStatsCard stats={tokenPageStats} />
          </div>
        </div>

        <div className="w-full lg:basis-2/3 flex flex-col">
          <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-8 w-8">
                <AvatarImage 
                  src={`https://icons.etokens.cash/32/${tokenData.tokenId}.png`} 
                  alt={tokenData.name} 
                />
                <AvatarFallback>{tokenData.name.substring(0, 2)}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-lg">
                  {tokenData.name}
                  <span className="ml-2 text-gray-500">({tokenData.symbol})</span>
                </h3>
              </div>
            </div>
          </div>

          <div className="p-4">
            <div className="flex flex-col">
              {selectedChart === "realtimeprice" ? <RealtimePrice tokenId={tokenData.tokenId} /> :
               selectedChart === "piechart" ? <Piechart tokenId={tokenData.tokenId} /> :
               selectedChart === "volumechart" ? <ErrorBoundary><VolumeChart tokenIds={[tokenData.tokenId]} /></ErrorBoundary> :
               selectedChart === "pricechart" ? <ErrorBoundary><PriceChart tokenIds={[tokenData.tokenId]} /></ErrorBoundary> : null}
              <div className="self-end mt-4">
                <Select
                  value={selectedChart}
                  onValueChange={setSelectedChart}
                >
                  <SelectTrigger className="w-[180px] rounded-lg">
                    <SelectValue placeholder="Select chart" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="realtimeprice">Price</SelectItem>
                    <SelectItem value="piechart">Holdings Distribution</SelectItem>
                    <SelectItem value="volumechart">Trading Volume</SelectItem>
                    <SelectItem value="pricechart">Trade Count</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          


          <div className="p-4">
            <div className="flex gap-6 mb-6">
              <h2 
                onClick={() => setActiveTab('trading')}
                className={`text-lg font-bold cursor-pointer transition-colors ${
                  activeTab === 'trading' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Agora Trading
              </h2>
              <h2
                onClick={() => setActiveTab('orderbook')}
                className={`text-lg font-bold cursor-pointer transition-colors ${
                  activeTab === 'orderbook' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Order Book
              </h2>
              <h2
                onClick={() => setActiveTab('address')}
                className={`text-lg font-bold cursor-pointer transition-colors ${
                  activeTab === 'address' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Address
              </h2>
              <h2
                onClick={() => setActiveTab('comments')}
                className={`text-lg font-bold cursor-pointer transition-colors ${
                  activeTab === 'comments' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Comments
              </h2>
            </div>

            <div className={activeTab === 'trading' ? 'block' : 'hidden'}>
              <TokenTx tokenId={tokenData.tokenId}/>
            </div>
            {activeTab === 'orderbook' ? (
              <ErrorBoundary>
              <OrderBook orderBook={orderBook} tokenId={tokenData.tokenId} latestPrice={stats?.latestPrice || 0} />
              </ErrorBoundary>
            ) : activeTab === 'address' ? (
              <AddressDistribution tokenId={tokenData.tokenId} decimals={tokenDecimals} />
            ) : activeTab === 'comments' ? (
              <TokenCommentsPanel
                tokenId={tokenData.tokenId}
                tokenName={tokenData.name}
                variant="main"
              />
            ) : null}
          </div>
        </div>


        <div className="w-full lg:basis-1/3 grid gap-4 auto-rows-min">
          <div className="hidden lg:block h-16" aria-hidden="true" />
          <div className="hidden lg:block">
            <TokenProjectInfoCard
              tokenId={tokenData.tokenId}
              tokenName={tokenData.name}
              authPubkey={authPubkey}
              tokenTicker={tokenData.symbol}
              createdBlockHeight={createdBlockHeight}
              createdTimestamp={createdTimestamp}
              fallbackWebsiteUrl={websiteUrl}
              fallbackTelegramUrl={!isCustomToken ? tokenData.telegramUrl : null}
              className="lg:max-h-[410px] lg:overflow-hidden"
              contentClassName="lg:max-h-[300px] lg:overflow-y-auto"
            />
          </div>

          <div className="hidden lg:block">
            <TokenStatsCard stats={tokenPageStats} />
          </div>

          {tokenData.tokenId && activeTab !== 'comments' && (
            <div className="hidden lg:block">
              <TokenCommentsPanel
                tokenId={tokenData.tokenId}
                tokenName={tokenData.name}
                variant="sidebar"
              />
            </div>
          )}

          {activeTab !== 'orderbook' && (
            <div className="hidden lg:block">
              <ErrorBoundary>
                <OrderBook orderBook={orderBook} tokenId={tokenData.tokenId} latestPrice={stats?.latestPrice || 0} />
              </ErrorBoundary>
            </div>
          )}

        </div>
      </div>
     
    </div>

      <AlertDialog open={showOrderCheckDialog} onOpenChange={setShowOrderCheckDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">Order Status Check 📋</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-base">
              <p className="leading-relaxed text-foreground">
                ✅ You have <span className="font-semibold text-orange-600">{orderCheckInfo.insufficientCount}</span> order(s) with insufficient total value (less than {MIN_ORDER_TOTAL_XEC.toLocaleString()} XEC including swap and network fees).
              </p>
              <p className="leading-relaxed text-muted-foreground">
                These orders will be automatically adjusted to the minimum valid total.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="flex flex-col sm:flex-row gap-2">
            <AlertDialogCancel
              onClick={() => {
                setShowOrderCheckDialog(false);
              }}
              className="flex-1 sm:flex-initial"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              variant="default"
              onClick={handleAdjustInsufficientOrders}
              className="flex-1 sm:flex-initial"
            >
              Confirm
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
