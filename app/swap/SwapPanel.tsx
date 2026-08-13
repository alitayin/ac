"use client"
import type React from "react";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import * as ecashLib from "ecash-lib";
import * as bip39 from "bip39";
import { debounce } from "lodash";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { createAgoraOffer } from "ecash-quicksend";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { Power, CircleAlert, ArrowDownUp, ShieldAlert, Layout } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { OrderList } from "@/components/ui/orderlist";
import { ListingList } from "@/components/ui/listinglist";
import { queueOrdersSync } from '@/lib/Auto.js';
import Image from "next/image";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useXECPrice } from '@/lib/price';
import { useFirmaBid } from '@/hooks/use-firma-bid';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AuroraText } from "@/components/magicui/aurora-text";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useWallet } from "@/lib/context/WalletContext";
import OrderBook from "@/components/ui/OrderBook";
import { fetchAgoraOrderBook } from "@/lib/agora-orders";
import {
  DEFAULT_BASE_NETWORK_FEE_XEC,
  estimateNetworkFeeXecFromAddress,
} from "@/lib/networkFee";
import {
  AGORA_SWAP_FEE_DESCRIPTION,
  calculateAgoraFeeSummary,
  estimateAgoraTokenCostFromBudget,
  getMinimumAgoraBuyFeesXec,
  xecToSats,
} from "@/lib/agora-swap-fee";
import {
  creditSatsToXec,
  getServiceCreditQuote,
  type ServiceCreditQuote,
} from "@/lib/service-token-credit";
import { calculateAgoraSweepBuy } from "@/lib/agora-sweep-buy";
import WalletConnectDrawerInner from "@/components/swap/WalletConnectDrawerInner";
import PriceCard from "@/components/swap/PriceCard";
import SpendCard from "@/components/swap/SpendCard";
import BuyCard from "@/components/swap/BuyCard";
import ConfirmOrderDialog from "@/components/swap/ConfirmOrderDialog";
import { fetchAgoraTransactionsFromChronik } from "@/lib/chronik-transactions";
import { Transaction } from "@/lib/types";
import { useAutoExecution } from "@/lib/context/AutoExecutionContext";
import {
  createSwapOrderKey,
  saveSwapOrder,
} from "@/lib/swap-order-utils";
import { fetchTokenDetails, getCachedTokenDetails } from "@/lib/chronik";
import { isBlockedTokenId } from "@/lib/blocked-tokens";
import { tokens } from "@/config/tokens";
import { parseDecimalToAtoms } from "@/lib/decimal";
import {
  calculateFirmaXecQuote,
  formatFirmaPriceInput,
  formatFirmaUsd,
  formatUsdPerXec,
} from "@/lib/firma";

const MIN_ORDER_TOTAL_XEC = 100;
const FIRMA_TOKEN_ID = tokens.firma.tokenId;
const FIRMA_DECIMALS = tokens.firma.decimals ?? 0;
const POLLING_INTERVAL_MS = 30000;
const EMPTY_SELECTED_TOKEN = {
  id: "",
  name: "Select token",
};
type BuyMode = "limit" | "sweep";
type SwapTab = "swap" | "sell" | "firma-xec" | "orders";

type SwapPanelProps = {
  initialTokenId?: string;
  initialTokenName?: string;
};

function shortenTokenId(tokenId: string): string {
  return `${tokenId.slice(0, 6)}...${tokenId.slice(-4)}`;
}

function getTokenNameFromDetail(detail: any, tokenId: string): string {
  const tokenName = detail?.genesisInfo?.tokenName?.trim();
  if (tokenName) {
    return tokenName;
  }

  const tokenTicker = detail?.genesisInfo?.tokenTicker?.trim();
  if (tokenTicker) {
    return tokenTicker;
  }

  return shortenTokenId(tokenId);
}

export function SwapPanel({
  initialTokenId = "",
  initialTokenName = "",
}: SwapPanelProps = {}) {
  const { toast } = useToast();
  const {
    isWalletConnected,
    ecashAddress,
    balance,
    userTokens,
    connectWallet,
    disconnectWallet,
    mnemonic
  } = useWallet();
  const [spendAmount, setSpendAmount] = useState<string>('');
  const [receiveAmount, setReceiveAmount] = useState<string>('');
  const [avgExecutionPrice, setAvgExecutionPrice] = useState<number>(0);
  const [slippage, setSlippage] = useState<number>(0);
  const [mnemonicError, setMnemonicError] = useState<string>('');
  const [mnemonicWords, setMnemonicWords] = useState<string[]>(new Array(12).fill(''));
  const [selectedToken, setSelectedToken] = useState<{
    id: string;
    name: string;
  }>(EMPTY_SELECTED_TOKEN);
  const [tokenPrice, setTokenPrice] = useState<number>(0);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false);
  const [tokenPriceInput, setTokenPriceInput] = useState<string>('');
  const [buyMode, setBuyMode] = useState<BuyMode>("limit");
  const [buyErrorMessage, setBuyErrorMessage] = useState<string>('');
  const [showOrdersRainbow, setShowOrdersRainbow] = useState<boolean>(false);
  const [ordersRainbowTimer, setOrdersRainbowTimer] = useState<NodeJS.Timeout | null>(null);
  const [showUsdPrice, setShowUsdPrice] = useState<boolean>(false);
  const [useBestOrderPrice, setUseBestOrderPrice] = useState<boolean>(true);
  const xecPrice = useXECPrice();
  const {
    bid: firmaBidXec,
    isLoading: isFirmaBidLoading,
    error: firmaBidError,
  } = useFirmaBid();
  const [marketPrice, setMarketPrice] = useState<number>(0);
  const [sweepMarketPrice, setSweepMarketPrice] = useState<number>(0);
  const [sweepMaxPrice, setSweepMaxPrice] = useState<number>(0);
  const [sweepTokenCostXec, setSweepTokenCostXec] = useState<number>(0);
  const [sweepQuoteVersion, setSweepQuoteVersion] = useState<number>(0);
  const [totalTokensBought, setTotalTokensBought] = useState<number>(0);
  const [showProPanel, setShowProPanel] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<SwapTab>("swap");
  const [orderBook, setOrderBook] = useState<{ orders: any[] }>({ orders: [] });
  const [firmaOrderBook, setFirmaOrderBook] = useState<{
    orders: any[];
    stats?: { min_price?: number };
  }>({ orders: [] });
  const [isFirmaOrderBookLoading, setIsFirmaOrderBookLoading] = useState(false);
  const [firmaOrderBookError, setFirmaOrderBookError] = useState<string | null>(null);
  const [selectedTokenDecimals, setSelectedTokenDecimals] = useState<number>(0);
  const [ordersView, setOrdersView] = useState<'buy' | 'sell'>('buy');
  const [networkFee, setNetworkFee] = useState<number>(DEFAULT_BASE_NETWORK_FEE_XEC); // Network fee estimated from wallet UTXO count
  const [useServiceCredit, setUseServiceCredit] = useState<boolean>(false);
  const [sellAmount, setSellAmount] = useState<string>('');
  const [sellPrice, setSellPrice] = useState<string>('');
  const [isCreatingListing, setIsCreatingListing] = useState<boolean>(false);
  const [xecTargetPriceUSD, setXecTargetPriceUSD] = useState<string>('');
  const [firmaSpendAmount, setFirmaSpendAmount] = useState<string>('');
  const { executeOrders } = useAutoExecution();
  const initialQueryTokenAppliedRef = useRef(false);
  const hasInitialQueryToken =
    /^[a-f0-9]{64}$/i.test(initialTokenId.trim()) && !isBlockedTokenId(initialTokenId);

  // Order book cache with 10 second TTL
  const orderBookCacheRef = useRef<Map<string, { data: any; timestamp: number }>>(new Map());
  const pendingOrderBookRequestsRef = useRef<Map<string, Promise<any>>>(new Map());
  const sweepCalculationRequestRef = useRef(0);
  const ORDERBOOK_CACHE_TTL_MS = 10000;

  const handleGenerateMnemonic = () => {
    try {
      const generatedMnemonic = bip39.generateMnemonic();
      const words = generatedMnemonic.trim().split(/\s+/);
      setMnemonicWords(new Array(12).fill('').map((_, i) => words[i] || ''));
      setMnemonicError('');
    } catch (error) {
      toast({
        title: "Failed to generate recovery phrase",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  // Cached order book fetch with 10 second TTL
  const fetchOrderBookCached = useCallback(async (
    tokenId: string,
    forceRefresh = false,
  ) => {
    if (!tokenId || isBlockedTokenId(tokenId)) {
      return { orders: [] };
    }

    const cached = orderBookCacheRef.current.get(tokenId);
    const now = Date.now();

    // Return cached data if still valid
    if (!forceRefresh && cached && now - cached.timestamp < ORDERBOOK_CACHE_TTL_MS) {
      return cached.data;
    }

    const pendingRequest = pendingOrderBookRequestsRef.current.get(tokenId);
    if (pendingRequest) {
      return pendingRequest;
    }

    // Fetch fresh data
    const requestPromise = (async () => {
      try {
        const data = await fetchAgoraOrderBook(tokenId);
        if (data.success && data.data) {
          orderBookCacheRef.current.set(tokenId, {
            data: data.data,
            timestamp: Date.now(),
          });
          return data.data;
        } else {
          console.warn('Invalid order book data received');
          return { orders: [] };
        }
      } catch (error) {
        console.error('Error fetching order book:', error);
        return { orders: [] };
      } finally {
        pendingOrderBookRequestsRef.current.delete(tokenId);
      }
    })();

    pendingOrderBookRequestsRef.current.set(tokenId, requestPromise);
    return requestPromise;
  }, []);

  // Fetch order book for the selected token
  const fetchOrderBook = useCallback(async () => {
    try {
      const data = await fetchOrderBookCached(selectedToken.id);
      setOrderBook(data);
    } catch (error) {
      console.error('Error fetching order book:', error);
      setOrderBook({ orders: [] });
    }
  }, [selectedToken.id, fetchOrderBookCached]);

  const fetchFirmaOrderBook = useCallback(async () => {
    setIsFirmaOrderBookLoading(true);

    try {
      const data = await fetchOrderBookCached(FIRMA_TOKEN_ID);
      const minPrice = Number(data?.stats?.min_price);

      if (!Number.isFinite(minPrice) || minPrice <= 0) {
        throw new Error("No active Firma sell orders are available");
      }

      setFirmaOrderBook(data);
      setFirmaOrderBookError(null);
    } catch (error) {
      setFirmaOrderBook({ orders: [] });
      setFirmaOrderBookError(
        error instanceof Error ? error.message : "Failed to load the Firma order book",
      );
    } finally {
      setIsFirmaOrderBookLoading(false);
    }
  }, [fetchOrderBookCached]);

  // Fetch order book when token changes or PRO panel is shown
  useEffect(() => {
    if (showProPanel && activeTab !== "firma-xec" && selectedToken.id) {
      fetchOrderBook();
      const interval = setInterval(fetchOrderBook, POLLING_INTERVAL_MS);
      return () => clearInterval(interval);
    }
  }, [activeTab, fetchOrderBook, showProPanel, selectedToken.id]);

  useEffect(() => {
    if (activeTab !== "firma-xec") {
      return;
    }

    void fetchFirmaOrderBook();
    const intervalId = setInterval(fetchFirmaOrderBook, POLLING_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [activeTab, fetchFirmaOrderBook]);

  const handleSaveMnemonic = async () => {
    const fullMnemonic = mnemonicWords.join(' ').trim();
    const success = await connectWallet(fullMnemonic);
    
    if (success) {
      setMnemonicError('');
      toast({
        title: "Wallet Connected Successfully",
        description: "Your wallet has been successfully connected",
      });
    } else {
      setMnemonicError('Invalid recovery phrase. Please check your input.');
    }
  };

  // Core calculation function (not debounced)
  const calculateAverageExecutionPriceCore = useCallback(async (buyAmount: number, spendAmount: number, tokenId: string) => {
    try {

      const data = await fetchOrderBookCached(tokenId);

      if (!data || !data.orders) {
        return { avgPrice: 0, actualAmount: 0, slippagePercent: 0 };
      }

      let remainingSpend = spendAmount;
      let totalTokensBought = 0;

      // Iterate through sell orders until budget or target amount is reached
      const sortedOrders = [...data.orders].sort((a: any, b: any) => a.price - b.price);
      for (const order of sortedOrders) {
        if (order.price > tokenPrice) {
          break;
        }

        if (remainingSpend <= 0) {
          break;
        }

        const maxTokensAtThisPrice = remainingSpend / order.price;
        const remainingToBuy = buyAmount - totalTokensBought;
        const tokensFromThisOrder = Math.min(maxTokensAtThisPrice, order.amount, remainingToBuy);

        const costForThisOrder = tokensFromThisOrder * order.price;
        remainingSpend -= costForThisOrder;
        totalTokensBought += tokensFromThisOrder;

        // Stop when the target purchase amount is reached
        if (totalTokensBought >= buyAmount) {
          break;
        }
      }

      const totalCost = spendAmount - remainingSpend;
      const avgPrice = totalTokensBought > 0 ? totalCost / totalTokensBought : 0;

      const lowestPrice = sortedOrders[0].price;
      const slippagePercent = ((avgPrice - lowestPrice) / lowestPrice) * 100;

      setAvgExecutionPrice(avgPrice);
      setSlippage(slippagePercent);
      setTotalTokensBought(totalTokensBought);

      return {
        avgPrice,
        actualAmount: totalTokensBought,
        slippagePercent
      };
    } catch (error) {
      console.error('Calculation failed:', error);
      return { avgPrice: 0, actualAmount: 0, slippagePercent: 0 };
    }
  }, [fetchOrderBookCached, tokenPrice]);

  const calculateAverageExecutionPriceCoreRef = useRef(calculateAverageExecutionPriceCore);
  useEffect(() => {
    calculateAverageExecutionPriceCoreRef.current = calculateAverageExecutionPriceCore;
  }, [calculateAverageExecutionPriceCore]);

  // Debounced version with 300ms delay
  const debouncedCalculateRef = useRef<ReturnType<typeof debounce>>();

  const calculateAverageExecutionPrice = useCallback((buyAmount: number, spendAmount: number, tokenId: string) => {
    if (!debouncedCalculateRef.current) {
      debouncedCalculateRef.current = debounce(
        (amount: number, spend: number, token: string) => {
          calculateAverageExecutionPriceCoreRef.current(amount, spend, token);
        },
        300
      );
    }
    debouncedCalculateRef.current(buyAmount, spendAmount, tokenId);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debouncedCalculateRef.current) {
        debouncedCalculateRef.current.cancel();
      }
    };
  }, []);

  const resetBuyEstimateState = useCallback((nextReceiveAmount = '') => {
    setReceiveAmount(nextReceiveAmount);
    setAvgExecutionPrice(0);
    setSlippage(0);
    setTotalTokensBought(0);
    setSweepMarketPrice(0);
    setSweepMaxPrice(0);
    setSweepTokenCostXec(0);
    setBuyErrorMessage('');
  }, []);

  const calculateLimitReceiveAmount = (
    inputAmount: string,
    feeXec: number = networkFee,
  ) => {
    if (!inputAmount || isNaN(Number(inputAmount))) {
      resetBuyEstimateState('');
      return { ok: false as const };
    }

    if (!selectedToken.id || tokenPrice <= 0) {
      resetBuyEstimateState('0');
      return { ok: false as const };
    }

    let spend = parseFloat(inputAmount);
    if (isNaN(spend)) {
      resetBuyEstimateState('');
      return { ok: false as const };
    }

    const maxSpend = parseFloat(balance);
    if (spend > maxSpend) {
      spend = maxSpend;
      setSpendAmount(maxSpend.toFixed(2));
    }

    const availableSpend = estimateAgoraTokenCostFromBudget(spend, feeXec);
    if (availableSpend <= 0) {
      resetBuyEstimateState('0');
      return { ok: false as const };
    }

    const receive = availableSpend / tokenPrice;
    const tokenDecimals = selectedTokenDecimals;
    const power = Math.pow(10, tokenDecimals);
    const truncatedReceive = Math.floor(receive * power) / power;

    setBuyErrorMessage('');
    setSweepMaxPrice(0);
    setSweepTokenCostXec(0);
    setReceiveAmount(truncatedReceive.toString());

    calculateAverageExecutionPrice(truncatedReceive, availableSpend, selectedToken.id);

    return {
      ok: true as const,
      availableSpend,
      receiveAmount: truncatedReceive,
      spendAmount: spend,
    };
  };

  const calculateSweepReceiveAmount = useCallback(async (
    inputAmount: string,
    feeXec: number = networkFee,
  ) => {
    const requestId = ++sweepCalculationRequestRef.current;

    if (!inputAmount || isNaN(Number(inputAmount))) {
      resetBuyEstimateState('');
      return null;
    }

    if (!selectedToken.id) {
      resetBuyEstimateState('0');
      return null;
    }

    let spend = parseFloat(inputAmount);
    if (isNaN(spend)) {
      resetBuyEstimateState('');
      return null;
    }

    const maxSpend = parseFloat(balance);
    if (spend > maxSpend) {
      spend = maxSpend;
      setSpendAmount(maxSpend.toFixed(2));
    }

    const latestOrderBook = await fetchOrderBookCached(selectedToken.id);
    if (requestId !== sweepCalculationRequestRef.current) {
      return;
    }

    const sweepResult = calculateAgoraSweepBuy({
      spendAmountXec: spend,
      networkFeeXec: feeXec,
      orderBook: latestOrderBook,
    });

    if (!sweepResult.ok) {
      setAvgExecutionPrice(0);
      setSlippage(0);
      setTotalTokensBought(0);
      setSweepMarketPrice(0);
      setSweepMaxPrice(0);
      setSweepTokenCostXec(0);
      setReceiveAmount('0');

      if (sweepResult.reason === "INSUFFICIENT_BUDGET") {
        setBuyErrorMessage(
          `Amount must be greater than ${getMinimumAgoraBuyFeesXec(feeXec).toFixed(2)} XEC to cover the estimated swap and network fees`,
        );
      } else if (sweepResult.reason === "EXCEEDS_AVAILABLE_AMOUNT") {
        setBuyErrorMessage(
          `Exceeds available amount: ${sweepResult.totalValueXec.toFixed(2)} XEC`,
        );
      } else {
        setBuyErrorMessage("No matching sell orders available");
      }
      return sweepResult;
    }

    setBuyErrorMessage('');
    setReceiveAmount(sweepResult.receiveAmount.toFixed(6));
    setAvgExecutionPrice(sweepResult.avgExecutionPrice);
    setSlippage(sweepResult.slippagePercent);
    setTotalTokensBought(sweepResult.receiveAmount);
    setSweepMarketPrice(sweepResult.marketPrice);
    setSweepMaxPrice(sweepResult.maxPrice);
    setSweepTokenCostXec(sweepResult.totalCostXec);
    setSweepQuoteVersion((currentVersion) => currentVersion + 1);
    return sweepResult;
  }, [balance, fetchOrderBookCached, networkFee, resetBuyEstimateState, selectedToken.id]);

  const calculateReceiveAmount = (inputAmount: string) => {
    if (buyMode === "sweep") {
      void calculateSweepReceiveAmount(inputAmount);
      return;
    }

    calculateLimitReceiveAmount(inputAmount);
  };

  const calculateSpendAmount = (inputAmount: string) => {
    if (buyMode === "sweep") {
      return;
    }

    if (!inputAmount || isNaN(Number(inputAmount))) {
      setSpendAmount('');
      return;
    }

    if (!selectedToken.id || tokenPrice <= 0) {
      setSpendAmount('');
      return;
    }
    
    let receive = parseFloat(inputAmount);
    if (isNaN(receive)) {
      setSpendAmount('');
      return;
    }
    
    const tokenCost = receive * tokenPrice;
    const totalSpend = calculateAgoraFeeSummary(tokenCost, networkFee).totalCostXec;
    const maxSpend = parseFloat(balance);
    
    if (totalSpend > maxSpend) {
      const maxAvailable = estimateAgoraTokenCostFromBudget(maxSpend, networkFee);
      const maxReceive = maxAvailable / tokenPrice;
      
      const tokenDecimals = selectedTokenDecimals;
      const power = Math.pow(10, tokenDecimals);
      const truncatedMaxReceive = Math.floor(maxReceive * power) / power;
      
      setReceiveAmount(truncatedMaxReceive.toString());
      setSpendAmount(maxSpend.toFixed(2));
      
      calculateAverageExecutionPrice(truncatedMaxReceive, maxAvailable, selectedToken.id);
      return;
    }
    
    setSpendAmount(totalSpend.toFixed(2));
    
    calculateAverageExecutionPrice(receive, tokenCost, selectedToken.id);
  };

  const handlePaste = (e: React.ClipboardEvent, index: number) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const words = pastedText.trim().split(/\s+/);

    if (words.length === 12) {
      setMnemonicWords(words);
    } else {
      const newWords = [...mnemonicWords];
      newWords[index] = words[0].toLowerCase();
      setMnemonicWords(newWords);
    }
  };

  const calculateNetworkFeeFromUtxos = useCallback(async (): Promise<number> => {
    try {
      if (!isWalletConnected || !ecashAddress) {
        return DEFAULT_BASE_NETWORK_FEE_XEC;
      }

      const { fee } = await estimateNetworkFeeXecFromAddress(ecashAddress);
      setNetworkFee(fee);
      return fee;
    } catch (error) {
      console.error(
        "Failed to calculate network fee from UTXOs, fallback to base fee:",
        error
      );
      setNetworkFee(DEFAULT_BASE_NETWORK_FEE_XEC);
      return DEFAULT_BASE_NETWORK_FEE_XEC;
    }
  }, [ecashAddress, isWalletConnected]);

  useEffect(() => {
    if (!isWalletConnected || !ecashAddress) {
      setNetworkFee(DEFAULT_BASE_NETWORK_FEE_XEC);
      return;
    }

    void calculateNetworkFeeFromUtxos();
  }, [calculateNetworkFeeFromUtxos, ecashAddress, isWalletConnected]);

  const fetchTokenPrice = useCallback(async (tokenId: string) => {
    if (!tokenId) {
      setTokenPrice(0);
      setMarketPrice(0);
      return 0;
    }

    try {
      let latestTx: Transaction[] = [];
      try {
        latestTx = await fetchAgoraTransactionsFromChronik(
          tokenId,
          undefined,
          {
            targetCount: 1,
            pageSize: 50,
            failOnError: false,
          },
        );
      } catch (err) {
        console.error("Failed to fetch latest transaction for price:", err);
      }

      const latestPrice = latestTx[0]?.price || 0;

      setTokenPrice(latestPrice);
      setMarketPrice(latestPrice);
      return latestPrice;
    } catch (error) {
      console.error('Failed to compute token price:', error);
      setTokenPrice(0);
      setMarketPrice(0);
      return 0;
    }
  }, []);

  const getTokenPrice = useCallback(async (tokenId: string) => {
    if (!tokenId) {
      setTokenPrice(0);
      setMarketPrice(0);
      return 0;
    }

    if (useBestOrderPrice) {
      try {
        const data = await fetchOrderBookCached(tokenId);

        if (data && data.stats && data.stats.min_price) {
          return data.stats.min_price;
        } else {
          return fetchTokenPrice(tokenId);
        }
      } catch (error) {
        console.error('Failed to fetch order book price:', error);
        return fetchTokenPrice(tokenId);
      }
    } else {
      return fetchTokenPrice(tokenId);
    }
  }, [fetchOrderBookCached, fetchTokenPrice, useBestOrderPrice]);

  const calculateTokenUsdPrice = useCallback((): string => {
    if (!tokenPrice || !xecPrice) return '';
    return (tokenPrice * xecPrice).toFixed(4);
  }, [tokenPrice, xecPrice]);

  const formatTokenPrice = useCallback((price: number): string => {
    if (price === 0) return '0.00';

    if (price % 1 === 0) {
      return price.toFixed(2);
    }

    const priceStr = price.toString();

    if (priceStr.includes('e')) {
      return price.toFixed(8);
    }

    const parts = priceStr.split('.');
    if (parts.length === 2) {
      const decimalPart = parts[1];
      const decimalPlaces = Math.max(2, Math.min(decimalPart.length, 8));

      let formatted = price.toFixed(decimalPlaces);
      formatted = formatted.replace(/(\.\d*?)0+$/, '$1');

      const currentParts = formatted.split('.');
      if (currentParts.length === 1 || (currentParts[1] && currentParts[1].length < 2)) {
        return price.toFixed(2);
      }

      return formatted;
    }

    return price.toFixed(2);
  }, []);

  // Memoize formatted token price
  const formattedTokenPrice = useMemo(() =>
    formatTokenPrice(tokenPrice),
    [tokenPrice, formatTokenPrice]
  );

  // Memoize USD price calculation
  const tokenUsdPrice = useMemo(() =>
    calculateTokenUsdPrice(),
    [calculateTokenUsdPrice]
  );

  const effectiveBuyMaxPrice = useMemo(
    () => (buyMode === "sweep" ? sweepMaxPrice : tokenPrice),
    [buyMode, sweepMaxPrice, tokenPrice],
  );
  const sweepQuoteText = useMemo(() => {
    if (
      buyMode !== "sweep" ||
      sweepMarketPrice <= 0 ||
      sweepMaxPrice <= 0 ||
      avgExecutionPrice <= 0 ||
      !receiveAmount ||
      parseFloat(receiveAmount) <= 0
    ) {
      return "";
    }

    return `Best ask ${formatTokenPrice(sweepMarketPrice)} XEC | Avg execution ${avgExecutionPrice.toFixed(4)} XEC | Slippage +${slippage.toFixed(2)}% | Max matched ${formatTokenPrice(sweepMaxPrice)} XEC`;
  }, [
    avgExecutionPrice,
    buyMode,
    formatTokenPrice,
    receiveAmount,
    slippage,
    sweepMarketPrice,
    sweepMaxPrice,
  ]);

  // Memoize price comparison for warning
  const priceWarningData = useMemo(() => {
    if (buyMode === "limit" && marketPrice > 0 && tokenPrice > 0) {
      const percentDiff = ((tokenPrice - marketPrice) / marketPrice) * 100;
      return {
        shouldShow: percentDiff > 100,
        percent: Math.round(percentDiff)
      };
    }
    return { shouldShow: false, percent: 0 };
  }, [buyMode, tokenPrice, marketPrice]);

  // Memoize order validation
  const isOrderValid = useMemo(() => {
    const validPrice = effectiveBuyMaxPrice > 0;
    const validSpend = spendAmount && parseFloat(spendAmount) > 0;
    const validReceive = receiveAmount && parseFloat(receiveAmount) > 0;
    return validPrice && validSpend && validReceive;
  }, [effectiveBuyMaxPrice, spendAmount, receiveAmount]);

  const estimatedTokenCost = useMemo(() => {
    if (buyMode === "sweep") {
      return sweepTokenCostXec;
    }

    const receive = parseFloat(receiveAmount || "0");
    if (!Number.isFinite(receive) || receive <= 0 || effectiveBuyMaxPrice <= 0) {
      return 0;
    }

    return receive * effectiveBuyMaxPrice;
  }, [buyMode, effectiveBuyMaxPrice, receiveAmount, sweepTokenCostXec]);

  const serviceCreditQuote = useMemo<ServiceCreditQuote>(
    () => getServiceCreditQuote(
      xecToSats(calculateAgoraFeeSummary(estimatedTokenCost, networkFee).swapFeeXec),
      userTokens,
    ),
    [estimatedTokenCost, networkFee, userTokens],
  );

  const estimatedServiceCreditXec = useMemo(
    () =>
      serviceCreditQuote.canCover
        ? Math.min(
            creditSatsToXec(serviceCreditQuote.creditSats),
            calculateAgoraFeeSummary(estimatedTokenCost, networkFee).swapFeeXec,
          )
        : 0,
    [estimatedTokenCost, networkFee, serviceCreditQuote],
  );

  const serviceCreditOverpayXec = useMemo(
    () => creditSatsToXec(serviceCreditQuote.overpaySats),
    [serviceCreditQuote],
  );

  useEffect(() => {
    if (useServiceCredit && !serviceCreditQuote.canCover) {
      setUseServiceCredit(false);
    }
  }, [serviceCreditQuote.canCover, useServiceCredit]);

  const serviceCreditLabel = useMemo(() => {
    if (!serviceCreditQuote.redemptions.length) {
      return "Use SS/SC credit";
    }

    const tokenText = serviceCreditQuote.redemptions
      .map((item) => `${item.amountAtoms} ${item.symbol}`)
      .join(" + ");

    return `Use ${tokenText}`;
  }, [serviceCreditQuote]);

  const estimatedFeeSummary = useMemo(
    () => calculateAgoraFeeSummary(
      estimatedTokenCost,
      networkFee,
      useServiceCredit ? estimatedServiceCreditXec : 0,
    ),
    [estimatedTokenCost, estimatedServiceCreditXec, networkFee, useServiceCredit],
  );

  const minimumBuyFees = useMemo(
    () => Math.max(0, getMinimumAgoraBuyFeesXec(networkFee) - (useServiceCredit ? estimatedServiceCreditXec : 0)),
    [estimatedServiceCreditXec, networkFee, useServiceCredit],
  );

  const handleTokenSelect = useCallback((tokenId: string, tokenName: string) => {
    if (!tokenId || isBlockedTokenId(tokenId)) {
      setSelectedToken(EMPTY_SELECTED_TOKEN);
      setTokenPrice(0);
      setTokenPriceInput('0.00');
      setMarketPrice(0);
      setSpendAmount('');
      resetBuyEstimateState('');
      return;
    }

    setSelectedToken({ id: tokenId, name: tokenName });
    getTokenPrice(tokenId).then(price => {
      setTokenPrice(price);
      setTokenPriceInput(formatTokenPrice(price));
      setMarketPrice(price);
    });
    setSpendAmount('');
    resetBuyEstimateState('');
  }, [formatTokenPrice, getTokenPrice, resetBuyEstimateState]);

  useEffect(() => {
    if (initialQueryTokenAppliedRef.current) {
      return;
    }

    const queryTokenId = initialTokenId.trim();
    if (!hasInitialQueryToken) {
      initialQueryTokenAppliedRef.current = true;
      return;
    }

    initialQueryTokenAppliedRef.current = true;
    const queryTokenName = initialTokenName.trim();
    handleTokenSelect(queryTokenId, queryTokenName || shortenTokenId(queryTokenId));
  }, [handleTokenSelect, hasInitialQueryToken, initialTokenId, initialTokenName]);

  useEffect(() => {
    if (!selectedToken.id) {
      setTokenPrice(0);
      setTokenPriceInput('0.00');
      setMarketPrice(0);
      return;
    }

    getTokenPrice(selectedToken.id).then(price => {
      setTokenPrice(price);
      setTokenPriceInput(formatTokenPrice(price));
      setMarketPrice(price);
    });
  }, [formatTokenPrice, getTokenPrice, selectedToken.id, useBestOrderPrice]);

  useEffect(() => {
    if (buyMode === "sweep" && spendAmount) {
      void calculateSweepReceiveAmount(spendAmount);
    }
  }, [buyMode, calculateSweepReceiveAmount, networkFee, selectedToken.id, spendAmount]);

  useEffect(() => {
    return () => {
      if (ordersRainbowTimer) {
        clearTimeout(ordersRainbowTimer);
      }
    };
  }, [ordersRainbowTimer]);

  const startOrdersRainbowEffect = () => {
    if (ordersRainbowTimer) {
      clearTimeout(ordersRainbowTimer);
    }
    
    setShowOrdersRainbow(true);
    
    const timer = setTimeout(() => {
      setShowOrdersRainbow(false);
      setOrdersRainbowTimer(null);
    }, 5000);
    
    setOrdersRainbowTimer(timer);
  };

  const handleSweepModeToggle = () => {
    setBuyMode((currentMode) => currentMode === "sweep" ? "limit" : "sweep");
    setSpendAmount('');
    resetBuyEstimateState('');
  };

  const createOrder = async () => {
    const orderMaxPrice = effectiveBuyMaxPrice;

    if (
      !isWalletConnected ||
      !ecashAddress ||
      !selectedToken.id ||
      isBlockedTokenId(selectedToken.id) ||
      !orderMaxPrice ||
      !receiveAmount
    ) {
      return;
    }
    
    const exactReceiveAmount = parseFloat(receiveAmount);

    const orderKey = createSwapOrderKey(selectedToken.id, ecashAddress, orderMaxPrice);
    
    const orderData: {
      remainingAmount: number;
      maxPrice: number;
      status: string;
      orderType: string;
      transactions: any[];
      createdAt: string;
      tokenCostCapXec?: number;
      serviceCreditEnabled?: boolean;
    } = {
      remainingAmount: exactReceiveAmount,
      maxPrice: orderMaxPrice,
      status: "pending",
      orderType: "online",
      transactions: [],
      createdAt: new Date().toISOString()
    };

    if (buyMode === "sweep" && estimatedFeeSummary.tokenCostXec > 0) {
      orderData.tokenCostCapXec = estimatedFeeSummary.tokenCostXec;
    }

    if (useServiceCredit && serviceCreditQuote.canCover) {
      orderData.serviceCreditEnabled = true;
    }

    const existingOrders = saveSwapOrder(orderKey, orderData, "created");

    executeOrders().catch(() => {});
    
    void queueOrdersSync(existingOrders, ecashAddress).then((synced) => {
      if (synced) {
        return;
      }

      console.error('❌ Failed to push orders to server');
      toast({
        title: "Warning",
        description: "Order saved locally but failed to sync with server. It will sync later.",
        variant: "destructive",
      });
    });
    
    setSpendAmount('');
    resetBuyEstimateState('');
    
    setIsConfirmDialogOpen(false);
    
    startOrdersRainbowEffect();
    
    toast({
      title: "✅ Order created successfully",
      description: `You have successfully created a purchase order for ${exactReceiveAmount} ${selectedToken.name}. Agora will check current sell orders immediately.`,
    });
  };

  const handleConfirmClick = async () => {
    if (!isWalletConnected) {
      return;
    }
    
    const currentFee = await calculateNetworkFeeFromUtxos();
    let latestReceiveAmount = parseFloat(receiveAmount || '0');
    let latestMaxPrice = effectiveBuyMaxPrice;
    let latestTokenCost = estimatedTokenCost;

    if (spendAmount && parseFloat(spendAmount) > 0) {
      if (buyMode === "sweep") {
        const refreshedSweepQuote = await calculateSweepReceiveAmount(
          spendAmount,
          currentFee,
        );

        if (!refreshedSweepQuote?.ok) {
          toast({
            title: "Quote updated",
            description: "The latest network fee changed your available buy amount. Please review the updated quote.",
            variant: "destructive",
          });
          return;
        }

        latestReceiveAmount = refreshedSweepQuote.receiveAmount;
        latestMaxPrice = refreshedSweepQuote.maxPrice;
        latestTokenCost = refreshedSweepQuote.totalCostXec;
      } else {
        const refreshedLimitQuote = calculateLimitReceiveAmount(
          spendAmount,
          currentFee,
        );

        if (!refreshedLimitQuote?.ok) {
          toast({
            title: "Quote updated",
            description: "The latest network fee changed your available buy amount. Please review the updated quote.",
            variant: "destructive",
          });
          return;
        }

        latestReceiveAmount = refreshedLimitQuote.receiveAmount;
        latestTokenCost = latestMaxPrice * latestReceiveAmount;
      }
    }
    
    if (!isOrderValid) {
      toast({
        title: "Invalid input",
        description: buyMode === "sweep"
          ? "Please ensure you have entered a valid spend amount and there is enough sell-side liquidity"
          : "Please ensure you have entered a valid price, spend amount and buy amount",
        variant: "destructive",
      });
      return;
    }
    
    const latestGrossFeeSummary = calculateAgoraFeeSummary(latestTokenCost, currentFee);
    const latestServiceCreditQuote = getServiceCreditQuote(
      xecToSats(latestGrossFeeSummary.swapFeeXec),
      userTokens,
    );
    const latestServiceCreditXec =
      useServiceCredit && latestServiceCreditQuote.canCover
        ? Math.min(
            creditSatsToXec(latestServiceCreditQuote.creditSats),
            latestGrossFeeSummary.swapFeeXec,
          )
        : 0;
    if (useServiceCredit && !latestServiceCreditQuote.canCover) {
      toast({
        title: "SS/SC credit unavailable",
        description: "Your current SS/SC balance no longer covers this swap fee.",
        variant: "destructive",
      });
      setUseServiceCredit(false);
      return;
    }
    const latestFeeSummary = calculateAgoraFeeSummary(
      latestTokenCost,
      currentFee,
      latestServiceCreditXec,
    );
    const totalAmount = latestFeeSummary.totalCostXec;
    const currentBalance = parseFloat(balance || '0');
    if (Number.isFinite(currentBalance) && totalAmount > currentBalance) {
      toast({
        title: "Insufficient balance",
        description: `Required: ${totalAmount.toFixed(2)} XEC, Available: ${currentBalance.toFixed(2)} XEC`,
        variant: "destructive",
      });
      return;
    }
    if (totalAmount < MIN_ORDER_TOTAL_XEC) {
      toast({
        title: "Order amount too small",
        description: `Orders require a minimum total value of ${MIN_ORDER_TOTAL_XEC.toLocaleString()} XEC (including swap and network fees). Current total: ${totalAmount.toFixed(2)} XEC`,
        variant: "destructive",
      });
      return;
    }
    
    setIsConfirmDialogOpen(true);
  };

  const handleTokenPriceInputChange = (value: string) => {
    if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
      setTokenPriceInput(value);

      const newPrice = parseFloat(value);
      if (!isNaN(newPrice)) {
        setTokenPrice(newPrice);
        setSpendAmount('');
        resetBuyEstimateState('');
      }
    }
  };

  const handleTokenPriceBlur = () => {
    let newPrice = parseFloat(tokenPriceInput);

    if (isNaN(newPrice)) {
      newPrice = 0;
      setTokenPriceInput('0.00');
    } else {
      setTokenPriceInput(formatTokenPrice(newPrice));
    }

    setTokenPrice(newPrice);
    setSpendAmount('');
    resetBuyEstimateState('');
  };

  const handleMarketClick = () => {
    getTokenPrice(selectedToken.id).then(price => {
      if (price) {
        setTokenPrice(price);
        setTokenPriceInput(formatTokenPrice(price));
        setMarketPrice(price);
        if (buyMode === "sweep" && spendAmount) {
          void calculateSweepReceiveAmount(spendAmount);
        }
      }
    });
    if (buyMode === "limit") {
      setSpendAmount('');
      resetBuyEstimateState('');
    }
  };

  const handleOneDollarClick = () => {
    if (xecPrice && xecPrice > 0) {
      const xecPerDollar = 1 / xecPrice;
      setTokenPrice(xecPerDollar);
      setTokenPriceInput(formatTokenPrice(xecPerDollar));
      setSpendAmount('');
      resetBuyEstimateState('');
    } else {
      toast({
        title: "Unable to get XEC price",
        description: "Please try again later",
        variant: "destructive",
      });
    }
  };


  // Auto-pick a wallet token only when there is no active selection yet.
  useEffect(() => {
    let cancelled = false;

    const syncSelectedToken = async () => {
      if (hasInitialQueryToken) {
        return;
      }

      if (selectedToken.id) {
        return;
      }

      const ownedTokens = Object.entries(userTokens).filter(
        ([tokenId, amount]) => amount !== "0" && !isBlockedTokenId(tokenId),
      );

      if (!isWalletConnected || ownedTokens.length === 0) {
        setSelectedToken(EMPTY_SELECTED_TOKEN);
        setTokenPrice(0);
        setTokenPriceInput('0.00');
        setMarketPrice(0);
        setSelectedTokenDecimals(0);
        setOrderBook({ orders: [] });
        setSpendAmount('');
        resetBuyEstimateState('');
        return;
      }

      const [firstTokenId] = ownedTokens[0];
      const cachedDetail = getCachedTokenDetails(firstTokenId);
      if (cachedDetail) {
        if (!cancelled) {
          handleTokenSelect(firstTokenId, getTokenNameFromDetail(cachedDetail, firstTokenId));
        }
        return;
      }

      try {
        const detail = await fetchTokenDetails(firstTokenId);
        if (!cancelled) {
          handleTokenSelect(firstTokenId, getTokenNameFromDetail(detail, firstTokenId));
        }
      } catch {
        if (!cancelled) {
          handleTokenSelect(firstTokenId, shortenTokenId(firstTokenId));
        }
      }
    };

    void syncSelectedToken();

    return () => {
      cancelled = true;
    };
  }, [
    handleTokenSelect,
    hasInitialQueryToken,
    isWalletConnected,
    resetBuyEstimateState,
    selectedToken.id,
    userTokens,
  ]);


  const handleCreateListing = async () => {
    if (!isWalletConnected || !mnemonic) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet with recovery phrase",
        variant: "destructive",
      });
      return;
    }

    if (!selectedToken.id) {
      toast({
        title: "No token selected",
        description: "Select a wallet token first",
        variant: "destructive",
      });
      return;
    }

    if (!sellAmount || parseFloat(sellAmount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid token amount to sell",
        variant: "destructive",
      });
      return;
    }

    if (!sellPrice || parseFloat(sellPrice) <= 0) {
      toast({
        title: "Invalid price",
        description: "Please enter a valid price per token",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingListing(true);

    try {
      const amount = parseFloat(sellAmount);
      const pricePerToken = parseFloat(sellPrice);

      // Convert amount to bigint with proper decimals
      const tokenAmountBigInt = BigInt(Math.floor(amount * Math.pow(10, selectedTokenDecimals)));

      // Convert price from "per token" to "per atom"
      // If token has 2 decimals, 1 token = 100 atoms
      // So if price is 0.01 XEC per token, it's 0.01/100 = 0.0001 XEC per atom
      const pricePerAtom = pricePerToken / Math.pow(10, selectedTokenDecimals);

      const result = await createAgoraOffer({
        tokenId: selectedToken.id,
        tokenAmount: tokenAmountBigInt,
        pricePerToken: pricePerAtom,
        mnemonic: mnemonic,
        offerType: 'PARTIAL'
      });

      if (result.success) {
        toast({
          title: "✅ Listing created successfully",
          description: `Successfully listed ${amount} ${selectedToken.name} at ${pricePerToken} XEC per token`,
        });

        setSellAmount('');
        setSellPrice('');

        window.dispatchEvent(new Event('listings-updated'));
      } else {
        toast({
          title: "Failed to create listing",
          description: result.message || "Unknown error occurred",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error creating listing:', error);
      toast({
        title: "Error creating listing",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsCreatingListing(false);
    }
  };

  const firmaBalance = parseFloat(userTokens[FIRMA_TOKEN_ID] || '0') / Math.pow(10, FIRMA_DECIMALS);
  const firmaLowestAskXecPerFirma = Number(firmaOrderBook.stats?.min_price || 0);
  const firmaQuote = useMemo(
    () => calculateFirmaXecQuote({
      firmaAmount: parseFloat(firmaSpendAmount),
      requestedXecUsd: parseFloat(xecTargetPriceUSD),
      marketXecUsd: xecPrice,
      firmaBidXec,
      agoraLowestAskXecPerFirma: firmaLowestAskXecPerFirma,
    }),
    [
      firmaBidXec,
      firmaLowestAskXecPerFirma,
      firmaSpendAmount,
      xecPrice,
      xecTargetPriceUSD,
    ],
  );
  const firmaXecReceive = firmaQuote ? firmaQuote.xecReceive.toFixed(2) : '0';
  const firmaBuybackUsd = firmaBidXec > 0 && xecPrice > 0
    ? firmaBidXec * xecPrice
    : 0;
  const firmaLowestAskUsd = firmaLowestAskXecPerFirma > 0 && xecPrice > 0
    ? firmaLowestAskXecPerFirma * xecPrice
    : 0;
  const firmaAgoraXecUsd = firmaLowestAskXecPerFirma > 0
    ? 1 / firmaLowestAskXecPerFirma
    : 0;
  const requestedFirmaXecUsd = parseFloat(xecTargetPriceUSD);
  const firmaBidXecUsd = firmaBidXec > 0 ? 1 / firmaBidXec : 0;
  const firmaMaximumXecUsd = firmaBidXecUsd > 0 && firmaAgoraXecUsd > 0
    ? Math.min(firmaBidXecUsd, firmaAgoraXecUsd)
    : 0;
  const isFirmaPriceCapped =
    Number.isFinite(requestedFirmaXecUsd) &&
    requestedFirmaXecUsd > 0 &&
    firmaMaximumXecUsd > 0 &&
    requestedFirmaXecUsd > firmaMaximumXecUsd;

  const handleXecPriceInputChange = (value: string) => {
    if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
      setXecTargetPriceUSD(value);
    }
  };

  const handleXecPriceBlur = () => {
    const newPrice = parseFloat(xecTargetPriceUSD);
    if (isNaN(newPrice)) {
      setXecTargetPriceUSD('');
    } else {
      setXecTargetPriceUSD(newPrice.toString());
    }
  };

  const handleFirmaBinancePriceClick = () => {
    if (xecPrice <= 0) {
      toast({
        title: "Market price unavailable",
        description: "Unable to load the latest XEC market price. Please try again later.",
        variant: "destructive",
      });
      return;
    }

    setXecTargetPriceUSD(xecPrice.toFixed(8));
  };

  const handleFirmaAgoraPriceClick = () => {
    if (firmaAgoraXecUsd <= 0) {
      toast({
        title: "Agora price unavailable",
        description: "Unable to load the lowest Firma sell price. Please try again later.",
        variant: "destructive",
      });
      return;
    }

    setXecTargetPriceUSD(formatFirmaPriceInput(firmaAgoraXecUsd));
  };

  const handleFirmaXecConfirm = async () => {
    if (!isWalletConnected || !mnemonic) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet with recovery phrase",
        variant: "destructive",
      });
      return;
    }

    if (firmaBidError) {
      toast({
        title: "Firma buyback price unavailable",
        description: "Please wait for the live buyback price to refresh before creating an order",
        variant: "destructive",
      });
      return;
    }

    const priceNum = parseFloat(xecTargetPriceUSD);
    const spendNum = parseFloat(firmaSpendAmount);

    if (isNaN(priceNum) || priceNum <= 0) {
      toast({
        title: "Invalid XEC price",
        description: "Please enter a valid XEC target price",
        variant: "destructive",
      });
      return;
    }

    if (isNaN(spendNum) || spendNum <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid Firma amount",
        variant: "destructive",
      });
      return;
    }

    const tokenAmountBigInt = parseDecimalToAtoms(firmaSpendAmount, FIRMA_DECIMALS);
    const rawFirmaBalance = BigInt(userTokens[FIRMA_TOKEN_ID] || '0');

    if (tokenAmountBigInt === null || tokenAmountBigInt <= 0n) {
      toast({
        title: "Invalid amount precision",
        description: `Firma supports up to ${FIRMA_DECIMALS} decimal places`,
        variant: "destructive",
      });
      return;
    }

    if (tokenAmountBigInt > rawFirmaBalance) {
      toast({
        title: "Insufficient balance",
        description: `You only have ${firmaBalance.toLocaleString()} Firma`,
        variant: "destructive",
      });
      return;
    }

    setIsCreatingListing(true);

    try {
      const latestFirmaOrderBook = await fetchOrderBookCached(FIRMA_TOKEN_ID, true);
      const latestLowestAskXecPerFirma = Number(
        latestFirmaOrderBook?.stats?.min_price,
      );

      if (!Number.isFinite(latestLowestAskXecPerFirma) || latestLowestAskXecPerFirma <= 0) {
        toast({
          title: "Agora price unavailable",
          description: "Unable to confirm the latest Firma sell price. No order was created.",
          variant: "destructive",
        });
        return;
      }

      setFirmaOrderBook(latestFirmaOrderBook);
      setFirmaOrderBookError(null);

      const latestQuote = calculateFirmaXecQuote({
        firmaAmount: spendNum,
        requestedXecUsd: priceNum,
        marketXecUsd: xecPrice,
        firmaBidXec,
        agoraLowestAskXecPerFirma: latestLowestAskXecPerFirma,
      });

      if (!latestQuote) {
        toast({
          title: "Price unavailable",
          description: "The latest XEC market, Firma bid, or Agora price is unavailable",
          variant: "destructive",
        });
        return;
      }

      const pricePerAtom = latestQuote.xecPerFirma / Math.pow(10, FIRMA_DECIMALS);

      const result = await createAgoraOffer({
        tokenId: FIRMA_TOKEN_ID,
        tokenAmount: tokenAmountBigInt,
        pricePerToken: pricePerAtom,
        mnemonic: mnemonic,
        offerType: 'PARTIAL'
      });

      if (result.success) {
        toast({
          title: "✅ Firma sell order created",
          description: `Listed ${spendNum} Firma to buy ${latestQuote.xecReceive.toLocaleString(undefined, { maximumFractionDigits: 2 })} XEC at up to $${formatUsdPerXec(latestQuote.effectiveXecUsd)}/XEC`,
        });

        setFirmaSpendAmount('');
        setXecTargetPriceUSD('');

        window.dispatchEvent(new Event('listings-updated'));
      } else {
        toast({
          title: "Failed to create order",
          description: result.message || "Unknown error occurred",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error creating Firma/XEC order:', error);
      toast({
        title: "Error creating order",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsCreatingListing(false);
    }
  };


  return (
    <>
      <div className="flex-1 flex justify-center px-4">
        <div className={`flex gap-6 pt-2 sm:p-8 transition-all duration-300 ${showProPanel ? 'lg:max-w-[1400px] w-full' : 'max-w-xl w-full mx-auto'}`}>
          <main className={`${showProPanel ? 'lg:w-[600px] w-full' : 'w-full'} transition-all duration-300`}>
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as SwapTab)}
            className="w-full"
          >
          <TabsList className="flex justify-between px-4 bg-transparent">
            <div className="flex space-x-2">
              <TabsTrigger
                value="swap"
                className="rounded-full px-3 py-1.5 text-xs data-[state=active]:bg-muted data-[state=active]:text-muted-foreground data-[state=active]:shadow-none shadow-none"
              >
                Buy
              </TabsTrigger>
              <TabsTrigger
                value="sell"
                className="rounded-full px-3 py-1.5 text-xs data-[state=active]:bg-muted data-[state=active]:text-muted-foreground data-[state=active]:shadow-none shadow-none"
              >
                Sell
              </TabsTrigger>
              <TabsTrigger
                value="firma-xec"
                className="rounded-full px-3 py-1.5 text-xs data-[state=active]:bg-muted data-[state=active]:text-muted-foreground data-[state=active]:shadow-none shadow-none"
              >
                Firma/XEC
              </TabsTrigger>
              <TabsTrigger
                value="orders"
                className="relative rounded-full px-3 py-1.5 text-xs data-[state=active]:bg-muted data-[state=active]:text-muted-foreground data-[state=active]:shadow-none shadow-none"
              >
                                  <span className="flex items-center gap-2">
                    Orders
                    {showOrdersRainbow && (
                      <Badge variant="secondary" className="h-5 min-w-5 animate-rainbow bg-gradient-to-r from-pink-500 via-red-500 via-yellow-500 via-green-500 via-blue-500 via-indigo-500 to-purple-500 bg-[length:200%] rounded-full px-1 font-mono tabular-nums text-white">
                        +1
                      </Badge>
                    )}
                  </span>
              </TabsTrigger>
            </div>
            <div className="flex items-center space-x-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Toggle order book panel"
                      className={`h-8 w-8 hidden lg:flex ${showProPanel ? 'text-blue-500' : 'text-muted-foreground'}`}
                      onClick={() => setShowProPanel(!showProPanel)}
                    >
                      <Layout size={16} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{showProPanel ? "Hide OrderBook" : "Show OrderBook"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {isWalletConnected && (
                <TooltipProvider>
                  <Tooltip>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                        >
                          <Power size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            disconnectWallet();
                            setSpendAmount('');
                            resetBuyEstimateState('');
                            setMnemonicWords(new Array(12).fill(''));

                            toast({
                              title: "✅ Wallet disconnected",
                              description: "Your wallet has been successfully disconnected",
                            });
                          }}
                        >
                          <Power className=" h-4 w-4 text-muted-foreground" /> Disconnect
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <TooltipTrigger asChild>
                      <div className="sr-only">Disconnect wallet</div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Disconnect wallet</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </TabsList>

          <TabsContent value="swap" className="mt-0">
            <div className="p-4 pt-2">
              <div className="space-y-2 max-w-xl mx-auto">

                <PriceCard
                  selectedToken={selectedToken}
                  userTokens={userTokens}
                  tokenPriceInput={tokenPriceInput}
                  onTokenPriceInputChange={handleTokenPriceInputChange}
                  onTokenPriceBlur={handleTokenPriceBlur}
                  useBestOrderPrice={useBestOrderPrice}
                  setUseBestOrderPrice={setUseBestOrderPrice}
                  showUsdPrice={showUsdPrice}
                  setShowUsdPrice={setShowUsdPrice}
                  onMarketClick={handleMarketClick}
                  showUsdPriceValue={showUsdPrice && buyMode === "limit" && tokenPrice > 0}
                  usdPriceText={calculateTokenUsdPrice()}
                  onTokenSelect={handleTokenSelect}
                  onTokenMetaChange={(meta) => setSelectedTokenDecimals(meta.decimals)}
                  showTokenSelector={false}
                  title={buyMode === "sweep" ? `Sweep ${selectedToken.name} from current asks` : undefined}
                  showPriceInput={buyMode === "limit"}
                  staticPriceLabel={
                    sweepMarketPrice > 0
                      ? `Current best ask ${formatTokenPrice(sweepMarketPrice)} XEC`
                      : "Sweep current sell book"
                  }
                  staticPriceHint={
                    sweepMaxPrice > 0
                      ? `Estimated max matched price: ${formatTokenPrice(sweepMaxPrice)} XEC`
                      : "Enter the XEC you want to spend and we will quote from the live sell order book."
                  }
                  showOneDollarButton={false}
                  sweepModeEnabled={buyMode === "sweep"}
                  onSweepModeToggle={handleSweepModeToggle}
                  disablePriceBasisToggle={buyMode === "sweep"}
                  transientHintText={sweepQuoteText || undefined}
                  transientHintKey={sweepQuoteVersion}
                  transientHintDurationMs={10000}
                />

                <SpendCard
                  spendAmount={spendAmount}
                  setSpendAmount={setSpendAmount}
                  calculateReceiveAmount={calculateReceiveAmount}
                  isWalletConnected={isWalletConnected}
                  balance={balance}
                  networkFee={networkFee}
                  swapFee={estimatedFeeSummary.swapFeeXec}
                  swapFeeCredit={estimatedFeeSummary.swapFeeCreditXec}
                  serviceCreditLabel={serviceCreditLabel}
                  serviceCreditEnabled={useServiceCredit}
                  setServiceCreditEnabled={setUseServiceCredit}
                  serviceCreditAvailable={serviceCreditQuote.canCover}
                  serviceCreditOverpay={serviceCreditOverpayXec}
                  totalFees={estimatedFeeSummary.totalFeesXec}
                  minimumTotalFees={minimumBuyFees}
                  toast={toast}
                />

                <BuyCard
                  receiveAmount={receiveAmount}
                  setReceiveAmount={setReceiveAmount}
                  calculateSpendAmount={calculateSpendAmount}
                  selectedToken={selectedToken}
                  userTokens={userTokens}
                  onTokenSelect={handleTokenSelect}
                  onTokenMetaChange={(meta) => setSelectedTokenDecimals(meta.decimals)}
                  selectedTokenDecimals={selectedTokenDecimals}
                  label={buyMode === "sweep" ? "Estimated buy" : "Buy"}
                  readOnly={buyMode === "sweep"}
                />

                <div className="space-y-2 mt-2">
                  <Drawer>
                    <DrawerTrigger asChild>
                      <Button
                        className="w-full text-md rounded-xl h-12"
                        variant="default"
                        onClick={handleConfirmClick}
                      >
                        {isWalletConnected ? "Confirm" : "Connect wallet"}
                      </Button>
                    </DrawerTrigger>
                    {!isWalletConnected && (
                      <DrawerContent>
                        <WalletConnectDrawerInner
                          mnemonicWords={mnemonicWords}
                          setMnemonicWords={setMnemonicWords}
                          mnemonicError={mnemonicError}
                          setMnemonicError={setMnemonicError}
                          handlePaste={handlePaste}
                          handleGenerateMnemonic={handleGenerateMnemonic}
                          handleSaveMnemonic={handleSaveMnemonic}
                        />
                      </DrawerContent>
                    )}
                  </Drawer>

                  <ConfirmOrderDialog
                    open={isConfirmDialogOpen}
                    onOpenChange={setIsConfirmDialogOpen}
                    selectedToken={selectedToken}
                    receiveAmount={receiveAmount}
                    spendAmount={spendAmount}
                    tokenPrice={effectiveBuyMaxPrice}
                    networkFee={networkFee}
                    swapFee={estimatedFeeSummary.swapFeeXec}
                    swapFeeCredit={estimatedFeeSummary.swapFeeCreditXec}
                    serviceCreditLabel={serviceCreditLabel}
                    serviceCreditOverpay={useServiceCredit ? serviceCreditOverpayXec : 0}
                    totalFees={estimatedFeeSummary.totalFeesXec}
                    tokenCost={estimatedFeeSummary.tokenCostXec}
                    feeDescription={AGORA_SWAP_FEE_DESCRIPTION}
                    formatTokenPrice={formatTokenPrice}
                    priceLabel={buyMode === "sweep" ? "Max matched price" : "Price per token"}
                    onClose={() => setIsConfirmDialogOpen(false)}
                    onConfirm={createOrder}
                  />

                  <Accordion type="single" collapsible className="w-full rounded-xl border px-4">
                    <AccordionItem value="buy-tip" className="border-b-0">
                      <AccordionTrigger className="py-3 text-left text-sm text-muted-foreground hover:no-underline">
                        Do you know what&apos;s special about Agora.cash Buy?
                      </AccordionTrigger>
                      <AccordionContent className="pb-3 text-sm text-muted-foreground">
                        Agora.cash Buy supports automated trading, allowing you to place a buy order at any
                        price. You only need to keep your browser online, and when a matching sell order
                        appears, it can complete automatically.
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  {buyMode === "limit" && tokenPrice > marketPrice && tokenPrice > 0 && marketPrice > 0 && receiveAmount && parseFloat(receiveAmount) > 0 && (
                    <div className="mt-2 space-y-1 text-sm">
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="market-details" className="border-b-0">
                          <AccordionTrigger className="py-1 text-muted-foreground hover:no-underline">
                            <div className="flex items-center justify-between w-full">
                            <span>Current market supply:</span>
                            <span>≈ {receiveAmount ? ((totalTokensBought / parseFloat(receiveAmount)) * 100).toFixed(0) : '0'}%</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-2 pt-1">
                              <div className="flex items-center justify-between text-muted-foreground">
                                <span>Average execution price:</span>
                                <span>{avgExecutionPrice.toFixed(4)} XEC</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Price impact:</span>
                                <span className={slippage > 0 ? 'text-destructive' : 'text-green-500'}>
                                  Market Price + {slippage.toFixed(2)}%
                                </span>
                              </div>
                              {receiveAmount && ((totalTokensBought/parseFloat(receiveAmount))*100) < 100 && (
                                <div className="text-sm text-muted-foreground mt-2">
                                  👋 At the price range of {formatTokenPrice(tokenPrice)} XEC, the market can immediately fulfill {((totalTokensBought/parseFloat(receiveAmount))*100).toFixed(0)}% of your order demand, the remaining part will continue to wait for sell orders.
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  )}

                  {buyErrorMessage && (
                    <Alert className="relative mt-2">
                      <div className="flex items-center">
                        <div className="p-2 bg-orange-100 dark:bg-orange-400 rounded-md">
                          <CircleAlert className="h-5 w-5" />
                        </div>
                        <AlertDescription className="flex items-center justify-between flex-1">
                          <div className="ml-2 flex items-center leading-7 tracking-tight">
                            {buyErrorMessage}
                          </div>
                        </AlertDescription>
                      </div>
                    </Alert>
                  )}

                  {priceWarningData.shouldShow && (
                    <Alert className="relative mt-2 dark:bg-dark-400/50 bg-pink-">
                      <div className="flex items-center">
                        <div className="p-2 dark:bg-pink-400 bg-pink-100 rounded-md">
                          <ShieldAlert className="h-5 w-5" />
                        </div>
                        <AlertDescription className="flex items-center justify-between flex-1">
                          <div className="ml-2 flex items-center leading-7 tracking-tight">
                            Price is {priceWarningData.percent}% higher than market price
                          </div>
                        </AlertDescription>
                      </div>
                    </Alert>
                  )}
                  
                  {receiveAmount && effectiveBuyMaxPrice && (estimatedFeeSummary.totalCostXec < MIN_ORDER_TOTAL_XEC) && (
                    <Alert className="relative mt-2">
                      <div className="flex items-center">
                        <div className="p-2 bg-orange-100 dark:bg-orange-400 rounded-md">
                          <CircleAlert className="h-5 w-5" />
                        </div>
                        <AlertDescription className="flex items-center justify-between flex-1">
                          <div className="ml-2 flex items-center leading-7 tracking-tight">
                            Orders require minimum {MIN_ORDER_TOTAL_XEC.toLocaleString()} XEC. Current: {estimatedFeeSummary.totalCostXec.toFixed(2)} XEC
                          </div>
                        </AlertDescription>
                      </div>
                    </Alert>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="sell" className="mt-0">
            <div className="p-4 pt-2">
              <div className="space-y-2 max-w-xl mx-auto">
                <PriceCard
                  selectedToken={selectedToken}
                  userTokens={userTokens}
                  tokenPriceInput={sellPrice}
                  onTokenPriceInputChange={(value) => {
                    if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
                      setSellPrice(value);
                    }
                  }}
                  onTokenPriceBlur={() => {
                    let newPrice = parseFloat(sellPrice);
                    if (isNaN(newPrice)) {
                      newPrice = 0;
                      setSellPrice('0.00');
                    } else {
                      setSellPrice(formatTokenPrice(newPrice));
                    }
                  }}
                  useBestOrderPrice={useBestOrderPrice}
                  setUseBestOrderPrice={setUseBestOrderPrice}
                  showUsdPrice={showUsdPrice}
                  setShowUsdPrice={setShowUsdPrice}
                  onMarketClick={() => {
                    getTokenPrice(selectedToken.id).then(price => {
                      if (price) {
                        setSellPrice(formatTokenPrice(price));
                      }
                    });
                  }}
                  onOneDollarClick={handleOneDollarClick}
                  showUsdPriceValue={showUsdPrice && parseFloat(sellPrice) > 0}
                  usdPriceText={sellPrice && parseFloat(sellPrice) > 0 && xecPrice ? (parseFloat(sellPrice) * xecPrice).toFixed(4) : ''}
                  onTokenSelect={handleTokenSelect}
                  onTokenMetaChange={(meta) => setSelectedTokenDecimals(meta.decimals)}
                  showTokenSelector={false}
                />

                <BuyCard
                  receiveAmount={sellAmount}
                  setReceiveAmount={setSellAmount}
                  calculateSpendAmount={() => {}}
                  selectedToken={selectedToken}
                  userTokens={userTokens}
                  onTokenSelect={handleTokenSelect}
                  onTokenMetaChange={(meta) => setSelectedTokenDecimals(meta.decimals)}
                  selectedTokenDecimals={selectedTokenDecimals}
                  label="Sell"
                  showTokenSelector={true}
                  showMaxBalance={true}
                />

                <div className="space-y-2 mt-2">
                  <Button
                    className="w-full text-md rounded-xl h-12"
                    variant="default"
                    onClick={handleCreateListing}
                    disabled={isCreatingListing || !isWalletConnected}
                  >
                    {isCreatingListing ? "Creating..." : isWalletConnected ? "Create Listing" : "Connect wallet"}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="firma-xec" className="mt-0">
            <div className="p-4 pt-2">
              <div className="space-y-2 max-w-xl mx-auto">
                <PriceCard
                  selectedToken={{ id: FIRMA_TOKEN_ID, name: "Firma" }}
                  userTokens={userTokens}
                  tokenPriceInput={xecTargetPriceUSD}
                  onTokenPriceInputChange={handleXecPriceInputChange}
                  onTokenPriceBlur={handleXecPriceBlur}
                  useBestOrderPrice={useBestOrderPrice}
                  setUseBestOrderPrice={setUseBestOrderPrice}
                  showUsdPrice={showUsdPrice}
                  setShowUsdPrice={setShowUsdPrice}
                  onMarketClick={handleFirmaBinancePriceClick}
                  onTokenSelect={() => {}}
                  onTokenMetaChange={() => {}}
                  showTokenSelector={false}
                  title="Set max price for 1 XEC"
                  showMarketButton={true}
                  showOneDollarButton={false}
                  showSettings={false}
                  marketButtonDisabled={xecPrice <= 0}
                  marketButtonLabel="Binance Price"
                  onSecondaryMarketClick={handleFirmaAgoraPriceClick}
                  secondaryMarketButtonLabel="Agora Price"
                  secondaryMarketButtonDisabled={isFirmaOrderBookLoading || firmaAgoraXecUsd <= 0}
                  inputUnitLabel="$/XEC"
                  showUsdPriceValue={false}
                  usdPriceText=""
                  referencePrices={[
                    {
                      label: "Binance XEC:",
                      value: xecPrice > 0 ? `$${formatUsdPerXec(xecPrice)}/XEC` : "--",
                    },
                    {
                      label: "Firma buyback:",
                      value: firmaBuybackUsd > 0
                        ? `$${formatFirmaUsd(firmaBuybackUsd)}`
                        : isFirmaBidLoading ? "Loading..." : "--",
                      title: firmaBidXec > 0
                        ? `Based on 1 Firma = ${firmaBidXec.toLocaleString(undefined, { maximumFractionDigits: 2 })} XEC from stakedxec.com`
                        : "Firma buyback price from stakedxec.com",
                    },
                    {
                      label: "Agora lowest ask:",
                      value: firmaLowestAskUsd > 0
                        ? `$${formatFirmaUsd(firmaLowestAskUsd)}/Firma`
                        : isFirmaOrderBookLoading ? "Loading..." : "--",
                      title: firmaLowestAskXecPerFirma > 0
                        ? `${firmaLowestAskXecPerFirma.toLocaleString(undefined, { maximumFractionDigits: 6 })} XEC/Firma`
                        : "Lowest active Firma sell order on Agora",
                    },
                  ]}
                />

                {isFirmaPriceCapped && firmaQuote ? (
                  <Alert>
                    <CircleAlert className="h-4 w-4" />
                    <AlertDescription>
                      Your limit is above the available Firma market. This order uses
                      ${formatUsdPerXec(firmaQuote.effectiveXecUsd)}/XEC, capped by the
                      {firmaQuote.limitSource === "agora" ? " lowest Agora ask" : " Firma buyback bid"}.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {firmaBidError ? (
                  <Alert variant="destructive">
                    <CircleAlert className="h-4 w-4" />
                    <AlertDescription>
                      Firma buyback price is unavailable. Order creation is disabled until it refreshes.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {firmaOrderBookError ? (
                  <Alert variant="destructive">
                    <CircleAlert className="h-4 w-4" />
                    <AlertDescription>
                      Firma order book is unavailable. Order creation is disabled until it refreshes.
                    </AlertDescription>
                  </Alert>
                ) : null}

                <BuyCard
                  receiveAmount={firmaSpendAmount}
                  setReceiveAmount={setFirmaSpendAmount}
                  calculateSpendAmount={() => {}}
                  selectedToken={{ id: FIRMA_TOKEN_ID, name: "Firma" }}
                  userTokens={userTokens}
                  onTokenSelect={() => {}}
                  onTokenMetaChange={() => {}}
                  selectedTokenDecimals={FIRMA_DECIMALS}
                  label="Spend"
                  showTokenSelector={false}
                  showMaxBalance={true}
                  showExplorerLink={false}
                  staticTokenLabel="FIRMA"
                  staticTokenIconSrc={`https://icons.etokens.cash/32/${FIRMA_TOKEN_ID}.png`}
                />

                <BuyCard
                  receiveAmount={firmaXecReceive}
                  setReceiveAmount={() => {}}
                  calculateSpendAmount={() => {}}
                  selectedToken={{ id: "", name: "XEC" }}
                  userTokens={userTokens}
                  onTokenSelect={() => {}}
                  onTokenMetaChange={() => {}}
                  selectedTokenDecimals={2}
                  label="Buy"
                  showTokenSelector={false}
                  readOnly={true}
                  showExplorerLink={false}
                  staticTokenLabel="XEC"
                  staticTokenIconSrc="/ecash.svg"
                />

                <div className="space-y-2 mt-2">
                  <Button
                    className="w-full text-md rounded-xl h-12"
                    variant="default"
                    onClick={handleFirmaXecConfirm}
                    disabled={isCreatingListing || !isWalletConnected || !firmaQuote || !!firmaBidError || !!firmaOrderBookError}
                  >
                    {isCreatingListing ? "Creating..." : isWalletConnected ? "Create Firma/XEC Order" : "Connect wallet"}
                  </Button>

                  <Accordion type="single" collapsible className="w-full rounded-xl border px-4">
                    <AccordionItem value="firma-xec-tip" className="border-b-0">
                      <AccordionTrigger className="py-3 text-left text-sm text-muted-foreground hover:no-underline">
                        How does Firma/XEC work?
                      </AccordionTrigger>
                      <AccordionContent className="pb-3 text-sm text-muted-foreground">
                        The live Firma bid is {firmaBidXec > 0
                          ? `${firmaBidXec.toLocaleString(undefined, { maximumFractionDigits: 2 })} XEC/Firma`
                          : "unavailable"}. Your USD limit is converted to an Agora Firma sell price;
                        the final price cannot exceed either the Firma buyback bid or the lowest
                        active Firma ask on Agora.
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="orders" className="mt-0">
            {isWalletConnected ? (
              <div>
                <div className="flex gap-2 p-4 pb-2">
                  <Button
                    variant={ordersView === 'buy' ? 'default' : 'outline'}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setOrdersView('buy')}
                    aria-pressed={ordersView === 'buy'}
                    aria-label="View buy orders"
                  >
                    Buy Orders
                  </Button>
                  <Button
                    variant={ordersView === 'sell' ? 'default' : 'outline'}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setOrdersView('sell')}
                    aria-pressed={ordersView === 'sell'}
                    aria-label="View my listings"
                  >
                    My Listings
                  </Button>
                </div>
                {ordersView === 'buy' ? (
                  <OrderList ecashAddress={ecashAddress || ''} balance={parseFloat(balance) || 0} />
                ) : (
                  <ListingList ecashAddress={ecashAddress || ''} mnemonic={mnemonic || ''} />
                )}
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="text-muted-foreground mb-4">Please connect your wallet to view your orders</div>
                <Drawer>
                  <DrawerTrigger asChild>
                    <Button>Connect Wallet</Button>
                  </DrawerTrigger>
                  <DrawerContent>
                    <WalletConnectDrawerInner
                      mnemonicWords={mnemonicWords}
                      setMnemonicWords={setMnemonicWords}
                      mnemonicError={mnemonicError}
                      setMnemonicError={setMnemonicError}
                      handlePaste={handlePaste}
                      handleGenerateMnemonic={handleGenerateMnemonic}
                      handleSaveMnemonic={handleSaveMnemonic}
                    />
                  </DrawerContent>
                </Drawer>
              </div>
            )}
          </TabsContent>
          </Tabs>
          </main>

          {/* OrderBook panel - desktop only */}
          {showProPanel && (
            <aside className="hidden lg:block lg:w-[700px] lg:min-w-[700px] transition-all duration-300" style={{ paddingTop: '45px' }}>
              <OrderBook 
                orderBook={activeTab === "firma-xec" ? firmaOrderBook : orderBook}
                tokenId={activeTab === "firma-xec" ? FIRMA_TOKEN_ID : selectedToken.id}
                latestPrice={activeTab === "firma-xec" ? firmaLowestAskXecPerFirma : tokenPrice}
                className="w-full h-fit"
              />
            </aside>
          )}
        </div>
      </div>
    </>
  );
}
