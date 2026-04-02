"use client"
import type React from "react";
import { useEffect, useState, useCallback } from "react";
import * as ecashLib from "ecash-lib";
import * as bip39 from "bip39";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrderProcessing } from "@/lib/context/OrderProcessingContext";
import { useAutoExecution } from "@/lib/context/AutoExecutionContext";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { createAgoraOffer } from "ecash-quicksend";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { TOKENS } from '@/config/tokenconfig';
import { Power, Trash2, CircleAlert, Eraser, ArrowDownUp, ShieldAlert, Layout } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { OrderList } from "@/components/ui/orderlist";
import { ListingList } from "@/components/ui/listinglist";
import { pushOrdersToServer } from '@/lib/Auto.js';
import { main as createOfflineBuyTransaction } from '@/lib/offlinebuy.js';
import Image from "next/image";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useXECPrice } from '@/lib/price';
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
import WalletConnectDrawerInner from "@/components/swap/WalletConnectDrawerInner";
import ClearLocalDataDialog from "@/components/swap/ClearLocalDataDialog";
import PriceCard from "@/components/swap/PriceCard";
import SpendCard from "@/components/swap/SpendCard";
import BuyCard from "@/components/swap/BuyCard";
import ConfirmOrderDialog from "@/components/swap/ConfirmOrderDialog";
import { fetchAgoraTransactionsFromChronik } from "@/lib/chronik-transactions";
import { Transaction } from "@/lib/types";

const MIN_ORDER_TOTAL_XEC = 1000;

export function SwapPanel() {
  const { toast } = useToast();
  const {
    isWalletConnected,
    ecashAddress,
    balance,
    userTokens,
    connectWallet,
    connectWithCashtab,
    disconnectWallet,
    isGuestMode,
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
  }>({
    id: 'ac31bb0bccf33de1683efce4da64f1cb6d8e8d6e098bc01c51d5864deb0e783f',
    name: 'StarCrystal'
  });
  const [tokenPrice, setTokenPrice] = useState<number>(0);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false);
  const [tokenPriceInput, setTokenPriceInput] = useState<string>('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const { isAutoProcessing, setIsAutoProcessing } = useOrderProcessing();
  const { executeOrders } = useAutoExecution();
  const [showOrdersRainbow, setShowOrdersRainbow] = useState<boolean>(false);
  const [ordersRainbowTimer, setOrdersRainbowTimer] = useState<NodeJS.Timeout | null>(null);
  const [showUsdPrice, setShowUsdPrice] = useState<boolean>(false);
  const [useBestOrderPrice, setUseBestOrderPrice] = useState<boolean>(true);
  const xecPrice = useXECPrice();
  const [deleteCountdown, setDeleteCountdown] = useState<number>(5);
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false);
  const [showPriceWarning, setShowPriceWarning] = useState<boolean>(false);
  const [priceWarningPercent, setPriceWarningPercent] = useState<number>(0);
  const [marketPrice, setMarketPrice] = useState<number>(0);
  const [totalTokensBought, setTotalTokensBought] = useState<number>(0);
  const [isOfflineOrder, setIsOfflineOrder] = useState<boolean>(false);
  const [showProPanel, setShowProPanel] = useState<boolean>(false);
  const [orderBook, setOrderBook] = useState<{ orders: any[] }>({ orders: [] });
  const [selectedTokenDecimals, setSelectedTokenDecimals] = useState<number>(0);
  const [networkFee, setNetworkFee] = useState<number>(DEFAULT_BASE_NETWORK_FEE_XEC); // Network fee estimated from UTXO count
  const [sellAmount, setSellAmount] = useState<string>('');
  const [sellPrice, setSellPrice] = useState<string>('');
  const [isCreatingListing, setIsCreatingListing] = useState<boolean>(false);

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

  // Fetch order book for the selected token
  const fetchOrderBook = useCallback(async () => {
    try {
      const data = await fetchAgoraOrderBook(selectedToken.id);
      if (data.success && data.data) {
        setOrderBook(data.data);
      } else {
        console.warn('Invalid order book data received');
        setOrderBook({ orders: [] });
      }
    } catch (error) {
      console.error('Error fetching order book:', error);
      setOrderBook({ orders: [] });
    }
  }, [selectedToken.id]);

  // Fetch order book when token changes or PRO panel is shown
  useEffect(() => {
    if (showProPanel && selectedToken.id) {
      fetchOrderBook();
      const interval = setInterval(fetchOrderBook, 10000);
      return () => clearInterval(interval);
    }
  }, [showProPanel, selectedToken.id]);

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

  const handleConnectCashtab = async () => {
    try {
      const success = await connectWithCashtab();
      if (success) {
        toast({
          title: "Cashtab Connected Successfully",
          description: "You are in guest mode. You can view balances but cannot create orders",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: "Unable to connect to Cashtab extension. Please make sure it is installed",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const calculateAverageExecutionPrice = async (buyAmount: number, spendAmount: number, tokenId: string) => {
    try {

      const data = await fetchAgoraOrderBook(tokenId);
      
      if (!data.success || !data.data || !data.data.orders) {
        return { avgPrice: 0, actualAmount: 0, slippagePercent: 0 };
      }

      let remainingSpend = spendAmount;
      let totalTokensBought = 0;
      
      // Iterate through sell orders until budget or target amount is reached
      const sortedOrders = [...data.data.orders].sort((a: any, b: any) => a.price - b.price);
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
  };

  const calculateReceiveAmount = (inputAmount: string) => {
    if (!inputAmount || isNaN(Number(inputAmount))) {
      setReceiveAmount('');
      return;
    }
    
    let spend = parseFloat(inputAmount);
    if (isNaN(spend)) {
      setReceiveAmount('');
      return;
    }
    
    const maxSpend = parseFloat(balance);
    if (spend > maxSpend) {
      spend = maxSpend;
      setSpendAmount(maxSpend.toFixed(2));
    }
    
    const availableSpend = Math.max(0, spend - networkFee);
    if (availableSpend <= 0) {
      setReceiveAmount('0');
      return;
    }
    
    const receive = availableSpend / tokenPrice;
    const tokenDecimals = selectedTokenDecimals;
    const power = Math.pow(10, tokenDecimals);
    const truncatedReceive = Math.floor(receive * power) / power;
    
    setReceiveAmount(truncatedReceive.toString());
    
    calculateAverageExecutionPrice(truncatedReceive, availableSpend, selectedToken.id);
  };

  const calculateSpendAmount = (inputAmount: string) => {
    if (!inputAmount || isNaN(Number(inputAmount))) {
      setSpendAmount('');
      return;
    }
    
    let receive = parseFloat(inputAmount);
    if (isNaN(receive)) {
      setSpendAmount('');
      return;
    }
    
    const tokenCost = receive * tokenPrice;
    const totalSpend = tokenCost + networkFee;
    const maxSpend = parseFloat(balance);
    
    if (totalSpend > maxSpend) {
      const maxAvailable = Math.max(0, maxSpend - networkFee);
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

  const calculateNetworkFeeFromUtxos = async (): Promise<number> => {
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
  };

  const getTokenPrice = async (tokenId: string) => {
    if (useBestOrderPrice) {
      try {
        const data = await fetchAgoraOrderBook(tokenId);
        
        if (data.success && data.data && data.data.stats && data.data.stats.min_price) {
          return data.data.stats.min_price;
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
  };

  const fetchTokenPrice = async (tokenId: string) => {
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
  };

  const handleTokenSelect = (tokenId: string, tokenName: string) => {
    setSelectedToken({ id: tokenId, name: tokenName });
    getTokenPrice(tokenId).then(price => {
      setTokenPrice(price);
      setTokenPriceInput(formatTokenPrice(price));
      setMarketPrice(price);
      checkPriceWarning(price, price);
    });
    setSpendAmount('');
    setReceiveAmount('');
  };

  useEffect(() => {
    getTokenPrice(selectedToken.id).then(price => {
      setTokenPrice(price);
      setTokenPriceInput(formatTokenPrice(price));
      setMarketPrice(price);
    });
  }, [useBestOrderPrice]);

  const checkPriceWarning = (currentPrice: number, marketPriceValue: number) => {
    if (marketPriceValue > 0 && currentPrice > 0) {
      const percentDiff = ((currentPrice - marketPriceValue) / marketPriceValue) * 100;
      if (percentDiff > 100) {
        setShowPriceWarning(true);
        setPriceWarningPercent(Math.round(percentDiff));
      } else {
        setShowPriceWarning(false);
      }
    } else {
      setShowPriceWarning(false);
    }
  };

  useEffect(() => {
    return () => {
      if (ordersRainbowTimer) {
        clearTimeout(ordersRainbowTimer);
      }
    };
  }, [ordersRainbowTimer]);

  const generateRandomString = (): string => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    return result;
  };

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

  const createOrder = async () => {
    if (!isWalletConnected || !ecashAddress || !selectedToken.id || !tokenPrice || !receiveAmount) {
      return;
    }
    
    if (isGuestMode) {
      toast({
        title: "Guest Mode Restriction",
        description: "Cannot create orders in guest mode. Please connect wallet with recovery phrase to create orders",
        variant: "destructive",
      });
      setIsConfirmDialogOpen(false);
      return;
    }

    if (isOfflineOrder) {
      const existingOrders = JSON.parse(localStorage.getItem('swap_orders') || '{}');
      const hasActiveCustodialOrder = Object.keys(existingOrders).some(orderKey => {
        const parts = orderKey.split('|');
        const address = parts[1];
        const order = existingOrders[orderKey];
        return address === ecashAddress && 
               order.orderType === 'offline' && 
               order.status === 'pending';
      });

      if (hasActiveCustodialOrder) {
        toast({
          title: "Custodial order limit reached",
          description: "During beta testing, only one active custodial buy order is allowed per wallet",
          variant: "destructive",
        });
        return;
      }
    }

    const exactReceiveAmount = parseFloat(receiveAmount);

    const orderKey = `${selectedToken.id}|${ecashAddress}|${tokenPrice}|${generateRandomString()}`;
    
    const orderData: {
      remainingAmount: number;
      maxPrice: number;
      status: string;
      orderType: string;
      transactions: any[];
      createdAt: string;
      raw?: string;
      selectedUtxos?: any[];
    } = {
      remainingAmount: exactReceiveAmount,
      maxPrice: tokenPrice,
      status: "pending",
      orderType: isOfflineOrder ? "offline" : "online",
      transactions: [],
      createdAt: new Date().toISOString()
    };

    if (isOfflineOrder) {
      try {
        const walletMnemonic = localStorage.getItem('wallet_mnemonic');
        if (!walletMnemonic) {
          throw new Error('Wallet mnemonic not found');
        }

        const tokenConfig = TOKENS[selectedToken.id as keyof typeof TOKENS];
        if (!tokenConfig) {
          throw new Error('Token configuration not found');
        }

        const proxyBuyAmount = tokenPrice * exactReceiveAmount;
        const config = {
          amount: proxyBuyAmount,
          maxPrice: 1.0000,
          tokenId: 'd047864a5e17cc12fa784704e83d39a69443bf6029acf3afb8babd9379acd7a3',
          tokenDecimals: 2,
          buyerMnemonic: walletMnemonic,
          buyerAddress: ecashAddress
        };

        const transactionResult = await createOfflineBuyTransaction(config);

        if (transactionResult.success && 'rawTxHex' in transactionResult && transactionResult.rawTxHex) {
          orderData.raw = transactionResult.rawTxHex;
          if ('selectedUtxos' in transactionResult && transactionResult.selectedUtxos) {
            orderData.selectedUtxos = transactionResult.selectedUtxos;
          }

          toast({
            title: "✅ Offline transaction created",
            description: `Raw transaction hash generated and saved to order. Check console for details.`,
          });
        } else {
          throw new Error(transactionResult.message || 'Failed to create offline transaction');
        }
             } catch (error) {
         console.error('❌ Failed to create offline transaction:', error);
         const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
         toast({
           title: "Failed to create offline transaction",
           description: errorMessage,
           variant: "destructive",
         });
         return;
       }
    }

    const existingOrders = JSON.parse(localStorage.getItem('swap_orders') || '{}');
    existingOrders[orderKey] = orderData;
    
    localStorage.setItem('swap_orders', JSON.stringify(existingOrders));
    
    window.dispatchEvent(new Event('orders-updated'));
    
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
    
    if (!isAutoProcessing) {
      setIsAutoProcessing(true);
      localStorage.setItem('auto_processing', 'true');
      if (isOfflineOrder) {
        toast({
          title: "✅ Auto sync enabled",
          description: "System will automatically sync order status in real-time via WebSocket",
        });
      } else {
        toast({
          title: "✅ Auto processing enabled",
          description: "System will automatically search and process orders in real-time via WebSocket",
        });
      }
    }

    if (!isOfflineOrder) {
      executeOrders().catch(() => {});
    }
    
    setSpendAmount('');
    setReceiveAmount('');
    
    setIsConfirmDialogOpen(false);
    
    startOrdersRainbowEffect();
    
    if (!isOfflineOrder) {
      toast({
        title: "✅ Order created successfully",
        description: `You have successfully created a purchase order for ${exactReceiveAmount} ${selectedToken.name}`,
      });
    }
  };

  const handleConfirmClick = async () => {
    if (!isWalletConnected) {
      return;
    }
    
    if (isGuestMode) {
      toast({
        title: "Guest Mode Restriction",
        description: "Cannot create orders in guest mode. Please connect wallet with recovery phrase to create orders",
        variant: "destructive",
      });
      return;
    }
    const currentFee = await calculateNetworkFeeFromUtxos();
    
    if (!isInputValid()) {
      toast({
        title: "Invalid input",
        description: "Please ensure you have entered a valid price, spend amount and buy amount",
        variant: "destructive",
      });
      return;
    }
    
    const tokenCost = tokenPrice * parseFloat(receiveAmount || '0');
    const totalAmount = tokenCost + currentFee;
    if (totalAmount < MIN_ORDER_TOTAL_XEC) {
      toast({
        title: "Order amount too small",
        description: `Orders require a minimum total value of ${MIN_ORDER_TOTAL_XEC.toLocaleString()} XEC (including network fee). Current total: ${totalAmount.toFixed(2)} XEC`,
        variant: "destructive",
      });
      return;
    }
    
    setIsOfflineOrder(false);
    
    setIsConfirmDialogOpen(true);
  };

  const isInputValid = () => {
    const validPrice = tokenPrice > 0;
    const validSpend = spendAmount && parseFloat(spendAmount) > 0;
    const validReceive = receiveAmount && parseFloat(receiveAmount) > 0;
    
    return validPrice && validSpend && validReceive;
  };

  const handleClearLocalStorage = () => {
    localStorage.clear();

    setIsAutoProcessing(false);
    disconnectWallet();
    
    setSpendAmount('');
    setReceiveAmount('');
    setMnemonicWords(new Array(12).fill(''));
    
    toast({
      title: "✅ Cache cleared",
      description: "All local data (including orders and wallet information) has been deleted",
    });
    
    setIsDeleteDialogOpen(false);
    setDeleteCountdown(5);
    setIsCountingDown(false);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (isCountingDown && deleteCountdown > 0) {
      timer = setTimeout(() => {
        setDeleteCountdown(prev => prev - 1);
      }, 1000);
    } else if (deleteCountdown === 0) {
      setIsCountingDown(false);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isCountingDown, deleteCountdown]);

  const handleOpenDeleteDialog = () => {
    setIsDeleteDialogOpen(true);
    setDeleteCountdown(5);
    setIsCountingDown(true);
  };

  const hasActiveOrders = () => {
    const orders = JSON.parse(localStorage.getItem('swap_orders') || '{}');
    if (!isWalletConnected || !ecashAddress) return false;
    
    return Object.keys(orders).some(orderKey => {
      const parts = orderKey.split('|');
      const address = parts[1];
      return address === ecashAddress;
    });
  };

  const calculateTokenUsdPrice = (): string => {
    if (!tokenPrice || !xecPrice) return '';
    return (tokenPrice * xecPrice).toFixed(4);
  };

  const formatTokenPrice = (price: number): string => {
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
  };

  // Keep auto-processing state in sync with wallet status and existing orders
  useEffect(() => {
    if (isWalletConnected) {
      const savedAutoProcessing = localStorage.getItem('auto_processing');
      
      if (savedAutoProcessing !== null && hasActiveOrders()) {
        setIsAutoProcessing(savedAutoProcessing === 'true');
      } else if (!hasActiveOrders()) {
        setIsAutoProcessing(false);
        localStorage.setItem('auto_processing', 'false');
      }
    }
  }, [isWalletConnected]);

  const handleTokenPriceInputChange = (value: string) => {
    if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
      setTokenPriceInput(value);

      const newPrice = parseFloat(value);
      if (!isNaN(newPrice)) {
        setTokenPrice(newPrice);
        checkPriceWarning(newPrice, marketPrice);
        setSpendAmount('');
        setReceiveAmount('');
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
    checkPriceWarning(newPrice, marketPrice);
    setSpendAmount('');
    setReceiveAmount('');
  };

  const handleMarketClick = () => {
    getTokenPrice(selectedToken.id).then(price => {
      if (price) {
        setTokenPriceInput(formatTokenPrice(price));
      }
    });
    setSpendAmount('');
    setReceiveAmount('');
  };

  const handleOneDollarClick = () => {
    if (xecPrice && xecPrice > 0) {
      const xecPerDollar = 1 / xecPrice;
      setTokenPrice(xecPerDollar);
      setTokenPriceInput(formatTokenPrice(xecPerDollar));
      setSpendAmount('');
      setReceiveAmount('');
    } else {
      toast({
        title: "Unable to get XEC price",
        description: "Please try again later",
        variant: "destructive",
      });
    }
  };


  // Auto-select first owned token when wallet connects or user has tokens
  useEffect(() => {
    if (isWalletConnected && userTokens && Object.keys(userTokens).length > 0) {
      // Find first token with balance > 0
      const ownedTokens = Object.entries(userTokens).filter(([_, amount]) => amount !== "0");
      if (ownedTokens.length > 0) {
        const [firstTokenId] = ownedTokens[0];
        const tokenConfig = TOKENS[firstTokenId as keyof typeof TOKENS];
        if (tokenConfig && selectedToken.id !== firstTokenId) {
          handleTokenSelect(firstTokenId, tokenConfig.name);
        }
      }
    }
  }, [isWalletConnected, userTokens]);


  const handleCreateListing = async () => {
    if (!isWalletConnected || !mnemonic) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet with recovery phrase",
        variant: "destructive",
      });
      return;
    }

    if (isGuestMode) {
      toast({
        title: "Guest Mode Restriction",
        description: "Cannot create listings in guest mode. Please connect wallet with recovery phrase",
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

      const result = await createAgoraOffer({
        tokenId: selectedToken.id,
        tokenAmount: tokenAmountBigInt,
        pricePerToken: pricePerToken,
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


  return (
    <>
      <div className="flex-1 flex justify-center px-4">
        <div className={`flex gap-6 pt-2 sm:p-8 transition-all duration-300 ${showProPanel ? 'lg:max-w-[1400px] w-full' : 'max-w-xl w-full mx-auto'}`}>
          <main className={`${showProPanel ? 'lg:w-[600px] w-full' : 'w-full'} transition-all duration-300`}>
            <Tabs defaultValue="swap" className="w-full">
          <TabsList className="flex justify-between px-4 bg-transparent">
            <div className="flex space-x-4">
              <TabsTrigger
                value="swap"
                className="data-[state=active]:bg-muted shadow-none data-[state=active]:text-muted-foreground data-[state=active]:shadow-none rounded-full px-4 py-2"
              >
                Buy
              </TabsTrigger>
              <TabsTrigger
                value="sell"
                className="data-[state=active]:bg-muted shadow-none data-[state=active]:text-muted-foreground data-[state=active]:shadow-none rounded-full px-4 py-2"
              >
                Sell
              </TabsTrigger>
              <TabsTrigger
                value="limit"
                className="data-[state=active]:bg-muted shadow-none data-[state=active]:text-muted-foreground data-[state=active]:shadow-none rounded-full px-4 py-2 relative"
              >
                                  <span className="flex items-center gap-2">
                    My orders
                    {showOrdersRainbow && (
                      <Badge variant="secondary" className="h-5 min-w-5 animate-rainbow bg-gradient-to-r from-pink-500 via-red-500 via-yellow-500 via-green-500 via-blue-500 via-indigo-500 to-purple-500 bg-[length:200%] rounded-full px-1 font-mono tabular-nums text-white">
                        +1
                      </Badge>
                    )}
                  </span>
              </TabsTrigger>
              <TabsTrigger
                value="listing"
                className="data-[state=active]:bg-muted shadow-none data-[state=active]:text-muted-foreground data-[state=active]:shadow-none rounded-full px-4 py-2"
              >
                My listing
              </TabsTrigger>
            </div>
            <div className="flex items-center space-x-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
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

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={handleOpenDeleteDialog}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Clear all local data</p>
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
                            setReceiveAmount('');
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
                  onOneDollarClick={handleOneDollarClick}
                  showUsdPriceValue={showUsdPrice && tokenPrice > 0}
                  usdPriceText={calculateTokenUsdPrice()}
                  onTokenSelect={handleTokenSelect}
                  onTokenMetaChange={(meta) => setSelectedTokenDecimals(meta.decimals)}
                />

                <SpendCard
                  spendAmount={spendAmount}
                  setSpendAmount={setSpendAmount}
                  calculateReceiveAmount={calculateReceiveAmount}
                  isWalletConnected={isWalletConnected}
                  balance={balance}
                  networkFee={networkFee}
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
                />

                <div className="space-y-2">
                  <Drawer>
                    <DrawerTrigger asChild>
                      <Button
                        className="w-full text-md rounded-2xl h-12"
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
                          handleConnectCashtab={handleConnectCashtab}
                        />
                      </DrawerContent>
                    )}
                  </Drawer>

                  <ConfirmOrderDialog
                    open={isConfirmDialogOpen}
                    onOpenChange={setIsConfirmDialogOpen}
                    isOfflineOrder={isOfflineOrder}
                    selectedToken={selectedToken}
                    receiveAmount={receiveAmount}
                    spendAmount={spendAmount}
                    tokenPrice={tokenPrice}
                    networkFee={networkFee}
                    formatTokenPrice={formatTokenPrice}
                    onClose={() => setIsConfirmDialogOpen(false)}
                    onConfirm={createOrder}
                  />

                  {tokenPrice > marketPrice && tokenPrice > 0 && marketPrice > 0 && receiveAmount && parseFloat(receiveAmount) > 0 && (
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
                                <span className={slippage > 3 ? 'text-destructive' : 'text-green-500'}>
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

                

                  {showPriceWarning && (
                    <Alert className="relative mt-2 dark:bg-dark-400/50 bg-pink-">
                      <div className="flex items-center">
                        <div className="p-2 dark:bg-pink-400 bg-pink-100 rounded-md">
                          <ShieldAlert className="h-5 w-5" />
                        </div>
                        <AlertDescription className="flex items-center justify-between flex-1">
                          <div className="ml-2 flex items-center leading-7 tracking-tight">
                            Price is {priceWarningPercent}% higher than market price
                          </div>
                        </AlertDescription>
                      </div>
                    </Alert>
                  )}
                  
                  {receiveAmount && tokenPrice && ((parseFloat(receiveAmount) * tokenPrice + networkFee) < MIN_ORDER_TOTAL_XEC) && (
                    <Alert className="relative mt-2">
                      <div className="flex items-center">
                        <div className="p-2 bg-orange-100 dark:bg-orange-400 rounded-md">
                          <CircleAlert className="h-5 w-5" />
                        </div>
                        <AlertDescription className="flex items-center justify-between flex-1">
                          <div className="ml-2 flex items-center leading-7 tracking-tight">
                            Orders require minimum {MIN_ORDER_TOTAL_XEC.toLocaleString()} XEC. Current: {(parseFloat(receiveAmount) * tokenPrice + networkFee).toFixed(2)} XEC
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
                  label={`How many ${selectedToken.name} to list?`}
                  showTokenSelector={true}
                  onlyOwnedTokens={true}
                  showMaxBalance={true}
                />

                <div className="space-y-2">
                  <Button
                    className="w-full text-md rounded-2xl h-12"
                    variant="default"
                    onClick={handleCreateListing}
                    disabled={isCreatingListing || !isWalletConnected || isGuestMode}
                  >
                    {isCreatingListing ? "Creating..." : isWalletConnected ? "Create Listing" : "Connect wallet"}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="limit" className="mt-0">
            {isWalletConnected ? (
              <OrderList ecashAddress={ecashAddress} balance={parseFloat(balance)} />
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
                      handleConnectCashtab={handleConnectCashtab}
                    />
                  </DrawerContent>
                </Drawer>
              </div>
            )}
          </TabsContent>

          <TabsContent value="listing" className="mt-0">
            {isWalletConnected ? (
              <ListingList ecashAddress={ecashAddress} mnemonic={mnemonic} />
            ) : (
              <div className="p-8 text-center">
                <div className="text-muted-foreground mb-4">Please connect your wallet to view your listings</div>
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
                      handleConnectCashtab={handleConnectCashtab}
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
                orderBook={orderBook} 
                tokenId={selectedToken.id}
                latestPrice={tokenPrice}
                className="w-full h-fit"
              />
            </aside>
          )}
        </div>
      </div>

      <ClearLocalDataDialog
        open={isDeleteDialogOpen}
        deleteCountdown={deleteCountdown}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) {
            setDeleteCountdown(5);
            setIsCountingDown(false);
          }
        }}
        onConfirm={handleClearLocalStorage}
      />

    </>
  );
}

