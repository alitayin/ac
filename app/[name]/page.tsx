"use client"
import Header from "@/components/ui/header";
import { useParams, useRouter } from "next/navigation"
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
import { BarChart3, Globe, Share2, Lock, Coins, X } from "lucide-react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { TokenSelector } from "@/components/ui/token-selector"
import { SwapPanel } from "@/components/ui/SwapPanel"
import {
  AlertDialog,
  AlertDialogAction,
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
import { Transaction } from "@/lib/types"
import { fetchAgoraTransactionsFromChronik } from "@/lib/chronik-transactions"
import { fetchBlockchainInfo, fetchTokenDetails, getTokenDecimalsFromDetails } from "@/lib/chronik"
import { TOKEN_IDS, PRICE_CONSTANTS } from "@/lib/constants"
import { fetchAgoraOrderBook } from "@/lib/agora-orders"
import {
  applyStarShardFloor,
  getCachedTokenData,
  getCachedTokenSummary,
  setCachedTokenData,
  setCachedTokenSummary,
  CACHE_TTL_MS,
  SUMMARY_CACHE_TTL_MS,
  BLOCKS_PER_MONTH,
  BLOCKS_PER_DAY,
  compute24hStats,
} from "@/lib/token-stats"
import { watchAgoraTokens } from "@/lib/agora-ws"

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
  const router = useRouter()
  const { toast } = useToast()
  const { isWalletConnected, ecashAddress, isGuestMode, balance, userTokens } = useWallet()
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
  const [riskAcknowledged, setRiskAcknowledged] = useState<boolean>(false)
  const [selectedBuyToken, setSelectedBuyToken] = useState<{
    id: string;
    name: string;
  } | null>(null)
  const [buyTokenOrderBook, setBuyTokenOrderBook] = useState<any>(null)
  const [showOrderCheckDialog, setShowOrderCheckDialog] = useState<boolean>(false)
  const [orderCheckInfo, setOrderCheckInfo] = useState<{
    hasCompleted: boolean;
    hasInsufficientBudget: boolean;
    completedCount: number;
    insufficientCount: number;
    insufficientOrders: string[];
  }>({
    hasCompleted: false,
    hasInsufficientBudget: false,
    completedCount: 0,
    insufficientCount: 0,
    insufficientOrders: []
  })
  const [orderCheckAcknowledged, setOrderCheckAcknowledged] = useState<boolean>(false)
  const [chronikTokenInfo, setChronikTokenInfo] = useState<any>(null)
  
  const isLoadingStats = useRef<boolean>(false)

  const AGORA_FEE = 20
  const STAR_SHARD_TOKEN_ID = TOKEN_IDS.STAR_SHARD
  const REQUIRED_STAR_SHARD_BALANCE = 500_000n

  const hasStarShardBalance = (() => {
    try {
      const balanceStr = userTokens?.[STAR_SHARD_TOKEN_ID] ?? "0"
      return BigInt(balanceStr) >= REQUIRED_STAR_SHARD_BALANCE
    } catch {
      return false
    }
  })()

  useEffect(() => {
    const hasAcknowledged = localStorage.getItem('risk_acknowledged') === 'true';
    if (hasAcknowledged) {
      setRiskAcknowledged(true);
    }
  }, []);

  useEffect(() => {
    const checkLocalOrders = () => {
      if (!ecashAddress) return;
      
      const existingOrders = JSON.parse(localStorage.getItem('swap_orders') || '{}');
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      let completedCount = 0;
      let insufficientCount = 0;
      const insufficientOrderKeys: string[] = [];

      Object.entries(existingOrders).forEach(([key, order]: [string, any]) => {
        const [tokenId, address, priceStr] = key.split('|');
        if (address !== ecashAddress) return;
        
        if (order.status === 'completed' || order.remainingAmount === 0) {
          let shouldCount = false;
          
          if (!order.createdAt) {
            shouldCount = true;
          } else {
            const createdDate = new Date(order.createdAt);
            if (createdDate < sevenDaysAgo) {
              shouldCount = true;
            }
          }
          
          if (shouldCount) {
            completedCount++;
          }
        }
        
        const budget = order.remainingAmount * order.maxPrice;
        if (budget < 1000 && order.maxPrice <= 1 && order.status !== 'completed' && order.remainingAmount !== 0) {
          insufficientCount++;
          insufficientOrderKeys.push(key);
        }
      });

      if (completedCount > 0 || insufficientCount > 0) {
        setOrderCheckInfo({
          hasCompleted: completedCount > 0,
          hasInsufficientBudget: insufficientCount > 0,
          completedCount,
          insufficientCount,
          insufficientOrders: insufficientOrderKeys
        });
        setShowOrderCheckDialog(true);
      }
    };

    const timer = setTimeout(checkLocalOrders, 1000);
    return () => clearTimeout(timer);
  }, [ecashAddress]);

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
  const name = normalizeString(decodedName);

  const isValidTokenId = name.length >= 50 && name.length <= 70;

  const matchedToken = Object.entries(tokens).find(
    ([key, value]) => {
      const normalizedKey = normalizeString(key);
      const normalizedTokenId = normalizeString(value.tokenId);
      const normalizedSymbol = normalizeString(value.symbol);
      const normalizedName = normalizeString(value.name);
      
      return normalizedKey === name ||
        normalizedTokenId === name ||
        normalizedSymbol === name ||
        normalizedName === name;
    }
  )?.[1];

  const isCustomToken = !matchedToken && isValidTokenId;

  const tokenDecimals = isCustomToken && chronikTokenInfo 
    ? getTokenDecimalsFromDetails(chronikTokenInfo, 0)
    : (matchedToken as any)?.decimals ?? 0;

  let tokenData: TokenData;

  if (!matchedToken && !isValidTokenId) {
    tokenData = tokens["starcrystal"];
  } else if (matchedToken) {
    tokenData = matchedToken;
  } else {
    const chronikName = chronikTokenInfo?.genesisInfo?.tokenName;
    const chronikTicker = chronikTokenInfo?.genesisInfo?.tokenTicker;
    
    tokenData = {
      tokenId: name,
      name: chronikName || (stats ? (stats.tokenName || name) : "loading"),
      symbol: chronikTicker || (stats ? (stats.tokenTicker || name) : "loading"),
    };
  }

  if (tokenData.name === "TridentbyHodlWars") {
    tokenData = {
      ...tokenData,
      name: "Trident by Hodl Wars"
    };
  }

  const isSwapActivated =
    !!TOKENS[tokenData.tokenId as keyof typeof TOKENS];

  useEffect(() => {
    const fetchChronikTokenInfo = async () => {
      if (isCustomToken && isValidTokenId) {
        try {
          const tokenDetails = await fetchTokenDetails(name);
          setChronikTokenInfo(tokenDetails);
        } catch (error) {
          setChronikTokenInfo(null);
        }
      }
    };

    fetchChronikTokenInfo();
  }, [isCustomToken, isValidTokenId, name]);

  useEffect(() => {
    if (tokenData && tokenData.tokenId) {
      setSelectedBuyToken({
        id: tokenData.tokenId,
        name: tokenData.name
      });
    }
  }, [tokenData.tokenId, tokenData.name]);

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

  const loadTokenStats = async (tokenId: string, name: string) => {
    if (isLoadingStats.current) {
      return
    }
    
    isLoadingStats.current = true
    
    try {
      const now = Date.now()
      const cached = getCachedTokenData(tokenId)
      const cacheValid = !!cached && now - cached.computedAt < CACHE_TTL_MS

      let effectiveTipHeight = chainTipHeight
      if (typeof effectiveTipHeight !== "number") {
        try {
          const info = await fetchBlockchainInfo()
          if (typeof info?.tipHeight === "number") {
            effectiveTipHeight = info.tipHeight
            setChainTipHeight(info.tipHeight)
          }
        } catch {
        }
      }

      let last30DaysXECAmount = cacheValid ? cached!.last30DaysXECAmount : 0
      let totalTransactions30d = cacheValid ? cached!.totalTransactions : 0
      let latestProcessedHeight: number | null =
        typeof cached?.latestProcessedHeight === "number" ? cached.latestProcessedHeight : null
      let fetchError = false
      const tx24h: Transaction[] = []

      try {
        await fetchAgoraTransactionsFromChronik(
          tokenId,
          (batch) => {
            tx24h.push(...batch)
          },
          {
            targetCount: 400,
            pageSize: 200,
            maxBlocksBack: BLOCKS_PER_DAY,
            stopBelowHeight:
              typeof effectiveTipHeight === "number"
                ? Math.max(effectiveTipHeight - BLOCKS_PER_DAY, 0)
                : undefined,
            failOnError: true,
          },
        )
      } catch (err) {
        fetchError = true
      }

      const {
        latestPrice: rawLatestPrice,
        priceChange24h,
        last24HoursXECAmount,
        latestBlockHeight,
      } = compute24hStats(tx24h, effectiveTipHeight ?? chainTipHeight, null)

      if (cacheValid && typeof latestProcessedHeight === "number") {
        const deltaTx = tx24h.filter(
          (tx) => typeof tx.blockHeight === "number" && tx.blockHeight > latestProcessedHeight!,
        )
        const deltaVolume = deltaTx.reduce(
          (sum, tx) => sum + (tx.price || 0) * (tx.amount || 0),
          0,
        )
        last30DaysXECAmount += deltaVolume
        totalTransactions30d += deltaTx.length
      }

      if (!cacheValid) {
        try {
          const tx30d = await fetchAgoraTransactionsFromChronik(tokenId, undefined, {
            targetCount: 800,
            pageSize: 200,
            maxBlocksBack: BLOCKS_PER_MONTH,
            stopBelowHeight:
              typeof effectiveTipHeight === "number"
                ? Math.max(effectiveTipHeight - BLOCKS_PER_MONTH, 0)
                : undefined,
            failOnError: false,
          })
          const confirmed30d = tx30d.filter((tx) => typeof tx.blockHeight === "number")
          last30DaysXECAmount = confirmed30d.reduce(
            (sum, tx) => sum + (tx.price || 0) * (tx.amount || 0),
            0,
          )
          totalTransactions30d = confirmed30d.length
          const maxHeight = confirmed30d.reduce<number | null>((max, tx) => {
            if (typeof tx.blockHeight !== "number") return max
            if (max === null) return tx.blockHeight
            return Math.max(max, tx.blockHeight)
          }, null)
          if (typeof maxHeight === "number") {
            latestProcessedHeight = maxHeight
          }
        } catch {
        }
      }

      if (typeof latestBlockHeight === "number") {
        latestProcessedHeight =
          typeof latestProcessedHeight === "number"
            ? Math.max(latestProcessedHeight, latestBlockHeight)
            : latestBlockHeight
      }

      const latestPrice = applyStarShardFloor(rawLatestPrice, tokenId)
      const finalData = {
        latestPrice,
        priceChange24h,
        last24HoursXECAmount,
        last30DaysXECAmount,
        totalTransactions: totalTransactions30d,
        totalXECAmount: last30DaysXECAmount,
        tokenId,
        tokenName: name,
      }
      setStats(finalData)

      if (!fetchError) {
        setCachedTokenData(tokenId, {
          computedAt: Date.now(),
          latestProcessedHeight: latestProcessedHeight || 0,
          last30DaysXECAmount,
          totalTransactions: totalTransactions30d,
        })

        setCachedTokenSummary(tokenId, {
          computedAt: Date.now(),
          data: finalData,
        })
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
      try {
        const info = await fetchBlockchainInfo().catch(() => null)
        setChainTipHeight(typeof info?.tipHeight === "number" ? info.tipHeight : null)

        const cachedSummary = getCachedTokenSummary(tokenData.tokenId)
        const summaryValid =
          cachedSummary && Date.now() - cachedSummary.computedAt < SUMMARY_CACHE_TTL_MS
        
        if (summaryValid) {
          setStats(cachedSummary!.data)
        }

        await Promise.all([
          (async () => {
            if (!summaryValid) {
              await loadTokenStats(tokenData.tokenId, tokenData.name)
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
  }, [tokenData.tokenId])

  useEffect(() => {
    const unsubscribe = watchAgoraTokens([tokenData.tokenId], (id) => {
      if (id === tokenData.tokenId) {
        loadTokenStatsRef.current?.(tokenData.tokenId, tokenData.name)
      }
    })

    return () => unsubscribe()
  }, [tokenData.tokenId, tokenData.name])

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
  }, [buyTokenOrderBook])

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

    const sortedOrders = [...buyTokenOrderBook.orders].sort((a, b) => a.price - b.price)
    const marketPrice = sortedOrders[0]?.price || 0

    let xecAmount = Number(inputAmount)
    const totalValue = buyTokenOrderBook.stats.total_value

    const currentBalance = parseFloat(balance || '0')
    if (isWalletConnected && !isNaN(currentBalance) && currentBalance > 0) {
      if (xecAmount > currentBalance) {
        xecAmount = currentBalance
        setSpendAmount(currentBalance.toString())
      }
    }

    const availableXec = Math.max(0, xecAmount - AGORA_FEE)
    if (availableXec <= 0) {
      setReceiveAmount('0')
      setAvgExecutionPrice(0)
      setSlippage(0)
      setErrorMessage(`Amount must be greater than ${AGORA_FEE} XEC to cover network fee`)
      setMaxPrice(0)
      return
    }

    if (availableXec > totalValue) {
      setReceiveAmount('0')
      setAvgExecutionPrice(0)
      setSlippage(0)
      setErrorMessage(`Exceeds available amount: ${formatNumber(totalValue)} XEC`)
      setMaxPrice(0)
      return
    }

    setErrorMessage('')

    let remainingXec = availableXec
    let totalTokens = 0
    let totalCost = 0
    let highestPrice = 0

    for (const order of sortedOrders) {
      const orderCost = order.price * order.amount
      if (remainingXec >= orderCost) {
        totalTokens += order.amount
        totalCost += orderCost
        remainingXec -= orderCost
        highestPrice = order.price
      } else {
        const partialAmount = remainingXec / order.price
        totalTokens += partialAmount
        totalCost += remainingXec
        highestPrice = order.price
        break
      }
      
      if (remainingXec <= 0) break
    }

    if (totalTokens > 0) {
      const avgPrice = totalCost / totalTokens
      const slippagePercent = ((marketPrice - avgPrice) / marketPrice) * 100

      setReceiveAmount(totalTokens.toFixed(6))
      setAvgExecutionPrice(avgPrice)
      setSlippage(slippagePercent)
      setMaxPrice(highestPrice)
    } else {
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

    let deletedCount = 0;
    let adjustedCount = 0;

    if (orderCheckInfo.hasCompleted) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      Object.entries(existingOrders).forEach(([key, order]: [string, any]) => {
        const [tokenId, address, priceStr] = key.split('|');
        if (address !== ecashAddress) return;
        
        if (order.status === 'completed' || order.remainingAmount === 0) {
          let shouldDelete = false;
          
          if (!order.createdAt) {
            shouldDelete = true;
          } else {
            const createdDate = new Date(order.createdAt);
            if (createdDate < sevenDaysAgo) {
              shouldDelete = true;
            }
          }
          
          if (shouldDelete) {
            delete existingOrders[key];
            deletedCount++;
          }
        }
      });
    }

    if (orderCheckInfo.hasInsufficientBudget && orderCheckInfo.insufficientOrders.length > 0) {
      const actualSpendAmount = 1000;

      if (currentBalance < actualSpendAmount) {
        toast({
          title: "Cannot adjust orders",
          description: `Insufficient balance. Required: ${actualSpendAmount.toFixed(2)} XEC, Available: ${currentBalance.toFixed(2)} XEC`,
          variant: "destructive",
        });
        setShowOrderCheckDialog(false);
        setOrderCheckAcknowledged(false);
        return;
      }

      for (const orderKey of orderCheckInfo.insufficientOrders) {
        const [tokenId, address, priceStr] = orderKey.split('|');
        
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
            const newOrderKey = `${tokenId}|${address}|${highestPrice}`;

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

    localStorage.setItem('swap_orders', JSON.stringify(existingOrders));

    const messages = [];
    if (deletedCount > 0) {
      messages.push(`${deletedCount} completed order(s) deleted`);
    }
    if (adjustedCount > 0) {
      messages.push(`${adjustedCount} order(s) adjusted`);
    }

    if (messages.length > 0) {
      toast({
        title: "✅ Orders updated",
        description: messages.join(', '),
      });
    }

    setShowOrderCheckDialog(false);
    setOrderCheckAcknowledged(false);
  };

  const createSwapOrder = () => {
    if (!selectedBuyToken) {
      toast({
        title: "No token selected",
        description: "Please select a token to purchase",
        variant: "destructive",
      });
      return;
    }

    if (!riskAcknowledged) {
      toast({
        title: "Please acknowledge the risks",
        description: "You must acknowledge the risks before creating an order",
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

    const totalCost = parseFloat(receiveAmount) * maxPrice;
    if (totalCost < 1000) {
      toast({
        title: "Order amount too small",
        description: `Orders require a minimum total value of 1,000 XEC. Current total: ${totalCost.toFixed(2)} XEC`,
        variant: "destructive",
      });
      return;
    }

    const orderKey = `${selectedBuyToken.id}|${ecashAddress}|${maxPrice}`;
    
    const orderData = {
      remainingAmount: parseFloat(receiveAmount),
      maxPrice: maxPrice,
      status: "pending",
      orderType: "online",
      transactions: [],
      createdAt: new Date().toISOString()
    };

    const existingOrders = JSON.parse(localStorage.getItem('swap_orders') || '{}');
    
    existingOrders[orderKey] = orderData;
    
    localStorage.setItem('swap_orders', JSON.stringify(existingOrders));
    
    toast({
      title: "✅ Order created successfully",
      description: "Your order has been created. Please visit /swap page to manage your orders",
    });

    setSpendAmount('');
    setReceiveAmount('');
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
              riskAcknowledged={riskAcknowledged}
              setRiskAcknowledged={setRiskAcknowledged}
              checkboxId="risk-acknowledgement-mobile"
              onMaxClick={() => {
                if (isWalletConnected) {
                  const maxBalance = parseFloat(balance);
                  if (maxBalance > 0) {
                    setSpendAmount(balance);
                    calculateReceiveAmount(balance);
                  } else {
                    toast({ title: "Insufficient balance", description: "Your wallet balance is empty", variant: "destructive" });
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
                    <SelectItem value="realtimeprice">Real-time Price</SelectItem>
                    <SelectItem value="piechart">Holdings Distribution</SelectItem>
                    <SelectItem value="volumechart">Trading Volume</SelectItem>
                    <SelectItem value="pricechart">Trading Frequency</SelectItem>
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
              riskAcknowledged={riskAcknowledged}
              setRiskAcknowledged={setRiskAcknowledged}
              checkboxId="risk-acknowledgement-desktop"
              onMaxClick={() => {
                if (isWalletConnected) {
                  const maxBalance = parseFloat(balance);
                  if (maxBalance > 0) {
                    setSpendAmount(balance);
                    calculateReceiveAmount(balance);
                  } else {
                    toast({ title: "Insufficient balance", description: "Your wallet balance is empty", variant: "destructive" });
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
          <button
            onClick={() => {
              setShowOrderCheckDialog(false);
              setOrderCheckAcknowledged(false);
            }}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">Order Status Check 📋</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-base">
              {orderCheckInfo.hasCompleted && (
                <p className="leading-relaxed text-foreground">
                  ✅ You have <span className="font-semibold text-green-600">{orderCheckInfo.completedCount}</span> completed order(s) that can be cleaned up.
                </p>
              )}
              {orderCheckInfo.hasInsufficientBudget && (
                <p className="leading-relaxed text-foreground">
                  ✅ You have <span className="font-semibold text-orange-600">{orderCheckInfo.insufficientCount}</span> order(s) with insufficient budget (less than 1,000 XEC).
                </p>
              )}
              {orderCheckInfo.hasInsufficientBudget && (
                <p className="leading-relaxed text-muted-foreground">
                  These orders will be automatically adjusted to 1,000 XEC.
                </p>
              )}
              {orderCheckInfo.hasCompleted && !orderCheckInfo.hasInsufficientBudget && (
                <p className="leading-relaxed text-muted-foreground">
                  You can manually clean up completed orders in the <a href="/swap" className="text-primary hover:underline font-semibold">Swap page</a>.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="flex items-start space-x-2 p-3 bg-muted/50 rounded-lg">
            <Checkbox 
              id="order-check-acknowledgement" 
              checked={orderCheckAcknowledged}
              onCheckedChange={(checked) => {
                setOrderCheckAcknowledged(checked as boolean);
              }}
            />
            <label
              htmlFor="order-check-acknowledgement"
              className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
            >
              This is an experimental feature. I understand and accept all risks associated with using this functionality.
            </label>
          </div>

          <AlertDialogFooter className="flex flex-col sm:flex-row gap-2">
            <AlertDialogCancel
              onClick={() => {
                setShowOrderCheckDialog(false);
                setOrderCheckAcknowledged(false);
              }}
              className="flex-1 sm:flex-initial"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              variant="default"
              onClick={handleAdjustInsufficientOrders}
              className="flex-1 sm:flex-initial"
              disabled={!orderCheckAcknowledged}
            >
              Confirm
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}