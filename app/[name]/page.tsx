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
import { Badge } from "@/components/ui/badge"
import { tokens } from "@/config/tokens";
import { BarChart3, Globe, Share2, Lock, Coins } from "lucide-react"
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
import { useWallet } from "@/lib/context/WalletContext"
import { useToast } from "@/hooks/use-toast"
import { TokenSelector } from "@/components/ui/token-selector"
import { SwapPanel } from "@/components/ui/SwapPanel"
import { useAutoExecution } from "@/lib/context/AutoExecutionContext"

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
import { TOKENS } from "@/config/tokenconfig";
import { fetchTokenDetails, getTokenDecimalsFromDetails } from "@/lib/chronik"
import { TOKEN_IDS, PRICE_CONSTANTS } from "@/lib/constants"
import { fetchAgoraOrderBook } from "@/lib/agora-orders"
import { isEtokenDbAvailable } from "@/lib/etokendb"
import {
  DEFAULT_BASE_NETWORK_FEE_XEC,
  estimateNetworkFeeXecFromAddress,
} from "@/lib/networkFee"
import {
  calculateAgoraFeeSummary,
  estimateAgoraTokenCostFromBudget,
  getMinimumAgoraBuyFeesXec,
} from "@/lib/agora-swap-fee"
import { calculateAgoraSweepBuy } from "@/lib/agora-sweep-buy"
import {
  getCachedTokenSummary,
  SUMMARY_CACHE_TTL_MS,
} from "@/lib/token-stats"
import { watchAgoraTokens } from "@/lib/agora-ws"
import { loadTokenPageStats } from "@/lib/token-page-stats"
import { pushOrdersToServer } from "@/lib/Auto.js"
import {
  createSwapOrderKey,
  dispatchOrdersUpdated,
  saveSwapOrder,
  writeSwapOrders,
} from "@/lib/swap-order-utils"

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

export default function TokenPage() {
  const params = useParams()
  const { toast } = useToast()
  const { isWalletConnected, ecashAddress, isGuestMode, balance, userTokens } = useWallet()
  const { executeOrders } = useAutoExecution()
  const [stats, setStats] = useState<any>(null)
  const [chainTipHeight, setChainTipHeight] = useState<number | null>(null)
  const [selectedChart, setSelectedChart] = useState("realtimeprice")
  const [spendAmount, setSpendAmount] = useState<string>('')
  const [receiveAmount, setReceiveAmount] = useState<string>('')
  const [supply, setSupply] = useState<string>('0')
  const [orderBook, setOrderBook] = useState<any>(null)
  const [avgExecutionPrice, setAvgExecutionPrice] = useState<number>(0)
  const [slippage, setSlippage] = useState<number>(0)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'trading' | 'orderbook' | 'address'>('trading');
  const [maxPrice, setMaxPrice] = useState<number>(0)
  const [selectedBuyToken, setSelectedBuyToken] = useState<{
    id: string;
    name: string;
  } | null>(null)
  const [buyTokenOrderBook, setBuyTokenOrderBook] = useState<any>(null)
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
  const estimatedBuyTokenCost =
    maxPrice > 0 && parseFloat(receiveAmount || "0") > 0
      ? parseFloat(receiveAmount || "0") * maxPrice
      : 0
  const estimatedBuyFeeSummary = calculateAgoraFeeSummary(
    estimatedBuyTokenCost,
    networkFee,
  )
  const minimumBuyFees = getMinimumAgoraBuyFeesXec(networkFee)

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
    isCustomToken && chronikTokenInfo
      ? getTokenDecimalsFromDetails(chronikTokenInfo, 0)
      : undefined
  const tokenDecimals = resolvedChronikTokenDecimals ?? configuredTokenDecimals ?? 0
  const knownTokenDecimals = resolvedChronikTokenDecimals ?? configuredTokenDecimals

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

  const isSwapActivated = true;

  useEffect(() => {
    const fetchChronikTokenInfo = async () => {
      if (isCustomToken && isValidTokenId) {
        try {
          const tokenDetails = await fetchTokenDetails(routeParam);
          setChronikTokenInfo(tokenDetails);
        } catch (error) {
          setChronikTokenInfo(null);
        }
      }
    };

    fetchChronikTokenInfo();
  }, [isCustomToken, isValidTokenId, routeParam]);

  useEffect(() => {
    if (hasValidRoute && tokenData && tokenData.tokenId) {
      setSelectedBuyToken({
        id: tokenData.tokenId,
        name: tokenData.name
      });
    }
  }, [hasValidRoute, tokenData.tokenId, tokenData.name]);

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

  const fetchBuyTokenData = async () => {
    if (!selectedBuyToken) return;
    
    try {
      const data = await fetchAgoraOrderBook(selectedBuyToken.id)
      if (data.success && data.data) {
        setBuyTokenOrderBook(data.data)
      } else {
        setBuyTokenOrderBook(null)
      }
    } catch (error) {
      setBuyTokenOrderBook(null)
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

  useEffect(() => {
    if (selectedBuyToken) {
      fetchBuyTokenData()
      const interval = setInterval(fetchBuyTokenData, 30000)
      
      return () => clearInterval(interval)
    }
  }, [selectedBuyToken?.id])

  useEffect(() => {
    if (spendAmount && buyTokenOrderBook) {
      calculateReceiveAmount(spendAmount)
    }
  }, [buyTokenOrderBook, networkFee])

  const marketCap = stats && supply && !isNaN(stats.latestPrice) && !isNaN(Number(supply)) 
    ? (stats.latestPrice * Number(supply)) 
    : 0

  const rawLatestPrice = typeof stats?.latestPrice === 'number' ? stats.latestPrice : 0
  const displayLatestPrice = rawLatestPrice

  const rawChange = typeof stats?.priceChange24h === 'number' ? stats.priceChange24h : 0
  const isDrop = rawChange < 0
  const displayChange = isDrop ? Math.min(Math.abs(rawChange), 10) : rawChange

  const calculateReceiveAmount = (inputAmount: string) => {
    if (!buyTokenOrderBook?.orders || !inputAmount || isNaN(Number(inputAmount))) {
      setReceiveAmount('0')
      setAvgExecutionPrice(0)
      setSlippage(0)
      setErrorMessage('')
      setMaxPrice(0)
      return
    }

    let xecAmount = Number(inputAmount)

    const currentBalance = parseFloat(balance || '0')
    if (isWalletConnected && !isNaN(currentBalance) && currentBalance > 0) {
      if (xecAmount > currentBalance) {
        xecAmount = currentBalance
        setSpendAmount(currentBalance.toString())
      }
    }

    const sweepResult = calculateAgoraSweepBuy({
      spendAmountXec: xecAmount,
      networkFeeXec: networkFee,
      orderBook: buyTokenOrderBook,
    })

    if (!sweepResult.ok) {
      setReceiveAmount('0')
      setAvgExecutionPrice(0)
      setSlippage(0)
      setMaxPrice(0)
      if (sweepResult.reason === "INSUFFICIENT_BUDGET") {
        setErrorMessage(`Amount must be greater than ${minimumBuyFees.toFixed(2)} XEC to cover the estimated swap and network fees`)
      } else if (sweepResult.reason === "EXCEEDS_AVAILABLE_AMOUNT") {
        setErrorMessage(`Exceeds available amount: ${formatNumber(sweepResult.totalValueXec)} XEC`)
      } else {
        setErrorMessage('No matching sell orders available')
      }
      return
    }

    setErrorMessage('')
    setReceiveAmount(sweepResult.receiveAmount.toFixed(6))
    setAvgExecutionPrice(sweepResult.avgExecutionPrice)
    setSlippage(sweepResult.slippagePercent)
    setMaxPrice(sweepResult.maxPrice)

    if (!sweepResult.receiveAmount) {
      setReceiveAmount('0')
      setAvgExecutionPrice(0)
      setSlippage(0)
      setMaxPrice(0)
    }
  }

  const handleWebsiteClick = () => {
    if (!stats?.url) return;
    
    let url = stats.url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    window.open(url, '_blank');
  }

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
      try {
        await pushOrdersToServer(existingOrders, ecashAddress);
      } catch (error) {
        console.error('❌ Failed to push adjusted orders to server:', error);
      }
    }

    if (adjustedCount > 0) {
      toast({
        title: "✅ Orders updated",
        description: `${adjustedCount} order(s) adjusted`,
      });
    }

    setShowOrderCheckDialog(false);
  };

  const createSwapOrder = async () => {
    if (!selectedBuyToken) {
      toast({
        title: "No token selected",
        description: "Please select a token to purchase",
        variant: "destructive",
      });
      return;
    }

    if (!isWalletConnected || !ecashAddress) {
      toast({
        title: "Please connect wallet",
        description: "You need to connect your wallet to create orders. Please visit /swap page to connect",
        variant: "destructive",
      });
      return;
    }

    if (isGuestMode) {
      toast({
        title: "Guest Mode Restriction",
        description: "Cannot create orders in guest mode. Please connect wallet with recovery phrase",
        variant: "destructive",
      });
      return;
    }

    if (!receiveAmount || parseFloat(receiveAmount) <= 0 || !maxPrice || maxPrice <= 0) {
      toast({
        title: "Invalid input",
        description: "Please enter a valid amount to purchase",
        variant: "destructive",
      });
      return;
    }

    const currentFee =
      typeof networkFee === "number" && networkFee > 0
        ? networkFee
        : DEFAULT_BASE_NETWORK_FEE_XEC;
    const totalCost = parseFloat(receiveAmount) * maxPrice;
    const totalRequired = calculateAgoraFeeSummary(totalCost, currentFee).totalCostXec;
    if (totalRequired < MIN_ORDER_TOTAL_XEC) {
      toast({
        title: "Order amount too small",
        description: `Orders require a minimum total value of ${MIN_ORDER_TOTAL_XEC.toLocaleString()} XEC (including swap and network fees). Current total: ${totalRequired.toFixed(2)} XEC`,
        variant: "destructive",
      });
      return;
    }

    const orderKey = createSwapOrderKey(selectedBuyToken.id, ecashAddress, maxPrice);
    
    const orderData = {
      remainingAmount: parseFloat(receiveAmount),
      maxPrice: maxPrice,
      status: "pending",
      orderType: "online",
      transactions: [],
      createdAt: new Date().toISOString()
    };

    const existingOrders = saveSwapOrder(orderKey, orderData, "created");

    executeOrders().catch(() => {});

    try {
      await pushOrdersToServer(existingOrders, ecashAddress);
    } catch (error) {
      console.error('❌ Failed to push orders to server:', error);
      toast({
        title: "Warning",
        description: "Order saved locally but failed to sync with server. It will sync later.",
        variant: "destructive",
      });
    }
    
    toast({
      title: "✅ Order created successfully",
      description: "Your order has been created. Agora will check current sell orders immediately.",
    });

    setSpendAmount('');
    setReceiveAmount('');
  }

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
            <SwapPanel
              spendAmount={spendAmount}
              setSpendAmount={setSpendAmount}
              receiveAmount={receiveAmount}
              balance={balance}
              isWalletConnected={isWalletConnected}
              calculateReceiveAmount={calculateReceiveAmount}
              selectedBuyToken={selectedBuyToken}
              setSelectedBuyToken={setSelectedBuyToken}
              userTokens={userTokens}
              setReceiveAmount={setReceiveAmount}
              setAvgExecutionPrice={setAvgExecutionPrice}
              setSlippage={setSlippage}
              setErrorMessage={setErrorMessage}
              setMaxPrice={setMaxPrice}
              errorMessage={errorMessage}
              avgExecutionPrice={avgExecutionPrice}
              slippage={slippage}
              isSwapActivated={isSwapActivated}
              tokenId={tokenData.tokenId}
              createSwapOrder={createSwapOrder}
              totalFees={estimatedBuyFeeSummary.totalFeesXec}
              showCashtabButton={false}
              onMaxClick={() => {
                if (isWalletConnected) {
                  const maxBalance = parseFloat(balance);
                  if (maxBalance > minimumBuyFees) {
                    setSpendAmount(balance);
                    calculateReceiveAmount(balance);
                  } else {
                    toast({
                      title: "Insufficient balance",
                      description: `You need at least ${minimumBuyFees.toFixed(2)} XEC to cover the estimated swap and network fees`,
                      variant: "destructive"
                    });
                  }
                } else {
                  toast({ title: "Wallet not connected", description: "Please connect your wallet first", variant: "destructive" });
                }
              }}
            />
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
          


          <div className=" p-4">
            <h2 className="text-lg font-bold mb-6">Stats</h2>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-x-6 gap-y-2 lg:gap-y-8">
              <div>
                <div className="text-gray-600 text-sm">MCAP(XEC)</div>
                <div className="text-sm font-semibold">{formatNumber(marketCap)}</div>
              </div>
              <div>
                <div className="text-gray-600 text-sm">Price</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    {displayLatestPrice ? displayLatestPrice.toFixed(4) : '0.0000'}
                  </span>
                  <span className={`text-sm ${rawChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {rawChange >= 0 ? '+' : ''}{displayChange.toFixed(2)}%
                  </span>
                </div>
              </div>
              <div>
                <div className="text-gray-600 text-sm">1D VOL</div>
                <div className="text-sm font-semibold">{formatNumber(stats?.last24HoursXECAmount || 0)}</div>
              </div>
              <div>
                <div className="text-gray-600 text-sm">Supply</div>
                <div className="text-sm font-semibold">{formatNumber(Number(supply))}</div>
                {tokenData.tokenId === 'd1131675cb62b65909fb45ba53b022da0bd0f34aaa71fc61770115472b186ffb' && (
                  <div className="text-xs text-gray-500 mt-1">74M SS frozed(belongs to GNC)</div>
                )}
              </div>
              <div>
                <div className="text-gray-600 text-sm">Sales in 30D</div>
                <div className="text-sm font-semibold">{formatNumber(stats?.totalTransactions || 0)}</div>
              </div>
              <div>
                <div className="text-gray-600 text-sm">30D VOL</div>
                <div className="text-sm font-semibold">{formatNumber(stats?.last30DaysXECAmount || 0)}</div>
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
            ) : null}
          </div>
        </div>


        <div className="w-full lg:basis-1/3 grid gap-4 auto-rows-min">
          <div className="p-4 hidden lg:block">
            <SwapPanel
              spendAmount={spendAmount}
              setSpendAmount={setSpendAmount}
              receiveAmount={receiveAmount}
              balance={balance}
              isWalletConnected={isWalletConnected}
              calculateReceiveAmount={calculateReceiveAmount}
              selectedBuyToken={selectedBuyToken}
              setSelectedBuyToken={setSelectedBuyToken}
              userTokens={userTokens}
              setReceiveAmount={setReceiveAmount}
              setAvgExecutionPrice={setAvgExecutionPrice}
              setSlippage={setSlippage}
              setErrorMessage={setErrorMessage}
              setMaxPrice={setMaxPrice}
              errorMessage={errorMessage}
              avgExecutionPrice={avgExecutionPrice}
              slippage={slippage}
              isSwapActivated={isSwapActivated}
              tokenId={tokenData.tokenId}
              createSwapOrder={createSwapOrder}
              totalFees={estimatedBuyFeeSummary.totalFeesXec}
              showCashtabButton={false}
              onMaxClick={() => {
                if (isWalletConnected) {
                  const maxBalance = parseFloat(balance);
                  if (maxBalance > minimumBuyFees) {
                    setSpendAmount(balance);
                    calculateReceiveAmount(balance);
                  } else {
                    toast({
                      title: "Insufficient balance",
                      description: `You need at least ${minimumBuyFees.toFixed(2)} XEC to cover the estimated swap and network fees`,
                      variant: "destructive"
                    });
                  }
                } else {
                  toast({ title: "Wallet not connected", description: "Please connect your wallet first", variant: "destructive" });
                }
              }}
            />
          </div>

          <div className="p-4">
            <h2 className="text-lg font-bold mb-6">Info</h2>
            <div className="grid grid-cols-2 gap-4">
              <Badge 
                variant="secondary" 
                className="h-10 rounded-lg flex items-center justify-center gap-2 cursor-pointer hover:bg-secondary/80"
                onClick={() => {
                  navigator.clipboard.writeText(tokenData.tokenId);
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                {tokenData.tokenId.substring(0, 6)}...{tokenData.tokenId.substring(tokenData.tokenId.length - 4)}
              </Badge>

              <Badge 
                variant="secondary" 
                className="h-10 rounded-lg flex items-center justify-center gap-2 cursor-pointer hover:bg-secondary/80"
                onClick={() => window.open(`https://explorer.e.cash/tx/${tokenData.tokenId}`, '_blank')}
              >
                <Coins className="h-4 w-4" />
                Token ID	
              </Badge>

              {!isCustomToken && tokenData.telegramUrl && (
                <Badge 
                  variant="secondary" 
                  className="h-10 rounded-lg flex items-center justify-center gap-2 cursor-pointer hover:bg-secondary/80"
                  onClick={() => window.open(tokenData.telegramUrl, '_blank')}
                >
                  <Globe className="h-4 w-4" />
                  Telegram
                </Badge>
              )}

              <Badge 
                variant="secondary" 
                className="h-10 rounded-lg flex items-center justify-center gap-2 cursor-pointer hover:bg-secondary/80"
                onClick={handleWebsiteClick}
              >
                <Globe className="h-4 w-4" />
                Website
              </Badge>
            </div>
          </div>

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
