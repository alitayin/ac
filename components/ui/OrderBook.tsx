"use client"
import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Maximize2, Minimize2, DollarSign } from "lucide-react";
import { useXECPrice } from "@/lib/price"
import { fetchTokenOrders } from "@/lib/api"
import { formatNumber, convertPrice } from "@/lib/formatters"
import { 
  TOKEN_IDS, 
  ORDERBOOK_CONSTANTS, 
  UPDATE_INTERVALS, 
  UI_CONSTANTS 
} from "@/lib/constants"
import type { Order, OrderBookProps, BuyOrderResponse } from "@/lib/types"
import { useWallet } from "@/lib/context/WalletContext"

export default function OrderBook({ orderBook, className = "", tokenId, latestPrice = 0 }: OrderBookProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showZoomButton, setShowZoomButton] = useState(false);
  const [showUSD, setShowUSD] = useState(false);
  const [buyOrders, setBuyOrders] = useState<Order[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);
  const collapsedAskRef = useRef<HTMLDivElement>(null);
  const collapsedBidRef = useRef<HTMLDivElement>(null);
  const xecPrice = useXECPrice();
  const { isWalletConnected, ecashAddress, userTokens } = useWallet();
  // Temporary feature switch: disable StarShard holding gate while keeping logic for quick rollback.
  const ENABLE_STARSHARD_ACCESS_GATE = false;
  const REQUIRED_TOKEN_ID = "d1131675cb62b65909fb45ba53b022da0bd0f34aaa71fc61770115472b186ffb";
  const REQUIRED_MIN_BALANCE = 100_000n;

  const hasRequiredTokenBalance = (() => {
    try {
      const balanceStr = userTokens?.[REQUIRED_TOKEN_ID] ?? "0";
      return BigInt(balanceStr) >= REQUIRED_MIN_BALANCE;
    } catch {
      return false;
    }
  })();

  const isBuySectionUnlocked = ENABLE_STARSHARD_ACCESS_GATE
    ? Boolean(isWalletConnected && ecashAddress && hasRequiredTokenBalance)
    : Boolean(isWalletConnected && ecashAddress);
  const lockedMessage = !isWalletConnected || !ecashAddress
    ? "Login to access this feature"
    : "You need to hold at least 100,000 StarShard to access this feature.";

  const fetchBuyOrders = useCallback(async () => {
    try {
      const data: BuyOrderResponse = await fetchTokenOrders(tokenId);
      
      let formattedOrders: Order[] = [];

      if (!data.error && data.orders) {
        formattedOrders = data.orders
          .filter((order) => order.remainingAmount > 0)
          .map((order) => ({
            price: order.maxPrice,
            amount: order.remainingAmount,
            total: Number((order.maxPrice * order.remainingAmount).toFixed(2)),
          }));
      }

      if (tokenId === "83f682dffca1cab952d7439f4b5a09ad89e9492b24c879be58d59cf88859f254") {
        formattedOrders.push({
          price: 1,
          amount: 10000000000,
          total: 10000000000
        });
      }
      
      setBuyOrders(formattedOrders);
    } catch (error) {
      console.error('Error fetching buy orders:', error);

      // Even on request failure, keep the Spark page hint bid
      if (tokenId === "83f682dffca1cab952d7439f4b5a09ad89e9492b24c879be58d59cf88859f254") {
        setBuyOrders([{
          price: 1,
          amount: 10000000000,
          total: 10000000000
        }]);
      } else {
        setBuyOrders([]);
      }
    }
  }, [tokenId]);

  useEffect(() => {
    fetchBuyOrders();
    const interval = setInterval(fetchBuyOrders, UPDATE_INTERVALS.TEN_SECONDS);
    return () => clearInterval(interval);
  }, [fetchBuyOrders]);

  // Keep collapsed lists scrolled to bottom to show lowest ask / highest bid by default
  useEffect(() => {
    if (isExpanded) return;
    if (collapsedAskRef.current) {
      collapsedAskRef.current.scrollTop = collapsedAskRef.current.scrollHeight;
    }
    if (collapsedBidRef.current) {
      collapsedBidRef.current.scrollTop = collapsedBidRef.current.scrollHeight;
    }
  }, [isExpanded, orderBook?.orders?.length, buyOrders.length]);

  // Initialize expanded state
  useEffect(() => {
    if (cardRef.current && cardRef.current.offsetWidth >= UI_CONSTANTS.ORDERBOOK_WIDTH_THRESHOLD) {
      setIsExpanded(true);
    }
  }, []);

  // Handle resize
  useEffect(() => {
    const checkWidth = () => {
      if (cardRef.current) {
        const isWideEnough = cardRef.current.offsetWidth >= UI_CONSTANTS.ORDERBOOK_WIDTH_THRESHOLD;
        setShowZoomButton(isWideEnough);
        
        if (!isWideEnough && isExpanded) {
          setIsExpanded(false);
        }
      }
    };

    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, [isExpanded]);

  // Price conversion helper
  const priceDisplay = (price: number): string => {
    return convertPrice(price, showUSD, xecPrice || 0);
  };

  const shortAddress = (address?: string | null): string => {
    if (!address) return "Unknown";
    const trimmed = address.trim();
    return trimmed.length > 6 ? `...${trimmed.slice(-6)}` : trimmed;
  };

  // Prepare ask side data with cumulative depth info
  const asksWithCumulative = orderBook?.orders
    ? [...orderBook.orders]
        .sort((a: Order, b: Order) => a.price - b.price)
        .reduce((acc, order) => {
          const previous = acc[acc.length - 1];
          const cumulativeAmount = (previous?.cumulativeAmount ?? 0) + order.amount;
          const cumulativeCost = (previous?.cumulativeCost ?? 0) + order.amount * order.price;
          acc.push({ ...order, cumulativeAmount, cumulativeCost });
          return acc;
        }, [] as Array<Order & { cumulativeAmount: number; cumulativeCost: number }>)
    : [];

  const askMaxAmount = asksWithCumulative.length
    ? Math.max(...asksWithCumulative.map((o) => o.amount))
    : 0;

  const collapsedAsks = asksWithCumulative
    .slice(0, ORDERBOOK_CONSTANTS.COLLAPSED_ORDERS_COUNT)
    .reverse();

  const expandedAsks = asksWithCumulative.slice(0, ORDERBOOK_CONSTANTS.EXPANDED_ORDERS_COUNT);

  return (
    <Card className={`rounded-3xl ${isExpanded && showZoomButton ? 'w-full h-full' : ''} ${className}`} ref={cardRef}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-medium">Order Book</CardTitle>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUSD(!showUSD)}
            className="p-1 hover:bg-accent rounded-md transition-colors"
            title={showUSD ? "Show XEC" : "Show USD"}
          >
            <DollarSign className={`h-4 w-4 ${showUSD ? 'text-green-500' : 'text-muted-foreground'}`} />
          </button>
          {showZoomButton && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-accent rounded-md transition-colors"
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Maximize2 className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {(!isExpanded) ? (
          <>
            <div className="flex justify-between items-center text-sm text-muted-foreground mb-2 px-6">
              <span>PRICE ({showUSD ? 'USD' : 'XEC'})</span>
              <span>QUANTITY</span>
            </div>
            <div className="space-y-1 max-h-96 overflow-y-auto pr-1" ref={collapsedAskRef}>
              {collapsedAsks
                ?.map((order, index: number) => {
                  const barWidth = askMaxAmount
                    ? (order.amount / askMaxAmount) * 100 * UI_CONSTANTS.ORDERBOOK_BAR_MULTIPLIER
                    : 0;
                  return (
                    <Popover key={index}>
                      <PopoverTrigger asChild>
                        <div 
                          className="flex justify-between items-center text-sm group relative h-6 cursor-pointer"
                          onMouseEnter={(e) => {
                            const trigger = e.currentTarget;
                            trigger.click();
                          }}
                          onMouseLeave={(e) => {
                            const trigger = e.currentTarget;
                            trigger.click();
                          }}
                        >
                          <div className="absolute left-0 top-0 bottom-0 bg-pink-500/10 group-hover:bg-pink-200/30 transition-all"
                            style={{
                              width: `${barWidth}%`,
                              maxWidth: '100%'
                            }}
                          />
                          <div className="flex justify-between w-full relative z-10 px-6">
                            <span className="text-pink-400 font-medium tabular-nums">{priceDisplay(order.price)}</span>
                            <span className="text-foreground tabular-nums">{formatNumber(order.amount)}</span>
                          </div>
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="w-fit">
                        <div className="space-y-1">
                          <div className="text-sm text-muted-foreground font-medium">
                            Price: <span className="text-blue-500">{priceDisplay(order.price)}</span>
                          </div>
                          <div className="text-sm text-muted-foreground font-medium">
                            Amount: <span className="text-blue-500">{formatNumber(order.amount)}</span>
                          </div>
                          <div className="text-sm text-muted-foreground font-medium">
                            Total (XEC): <span className="text-blue-500">{formatNumber(order.total)}</span>
                          </div>
                          <div className="text-sm text-muted-foreground font-medium">
                            Cumulative qty: <span className="text-blue-500">{formatNumber(order.cumulativeAmount)}</span>
                          </div>
                          <div className="text-sm text-muted-foreground font-medium">
                            Buy to reach (XEC): <span className="text-blue-500">{formatNumber(order.cumulativeCost)}</span>
                          </div>
                          <div className="text-sm text-muted-foreground font-medium">
                            Seller: <span className="text-blue-500">{shortAddress(order.makerAddress)}</span>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  );
                })}
            </div>

            <div className="my-3 py-2 border-y border-dashed">
              {orderBook?.orders && orderBook.orders.length > 0 && buyOrders.length > 0 && (
                <div className="flex justify-between text-sm px-6">
                  <span className="text-muted-foreground">Spread:</span>
                  <span className="tabular-nums">
                    {(() => {
                      const lowestAsk = Math.min(...orderBook.orders.map(o => o.price));
                      const highestBid = Math.max(...buyOrders.map(o => o.price));
                      const spread = lowestAsk - highestBid;
                      const spreadPercentage = (spread / lowestAsk) * 100;
                      return `${spread.toFixed(2)} (${spreadPercentage.toFixed(2)}%)`;
                    })()}
                  </span>
                </div>
              )}
            </div>

            <div className="relative">
              <div className="space-y-1 max-h-96 overflow-y-auto pr-1" ref={collapsedBidRef}>
                {buyOrders.length > 0 ? (
                  buyOrders
                    .sort((a, b) => b.price - a.price)
                    .slice(0, ORDERBOOK_CONSTANTS.COLLAPSED_ORDERS_COUNT)
                    .map((order, index) => {
                      const maxAmount = Math.max(...buyOrders.map(o => o.amount));
                      const barWidth = (order.amount / maxAmount) * 100 * UI_CONSTANTS.ORDERBOOK_BAR_MULTIPLIER;
                      const lowestAsk = orderBook?.orders?.length 
                    ? Math.min(...orderBook.orders.map(o => o.price))
                    : Infinity;
                  const isAbnormalPrice = order.price >= lowestAsk;

                      return (
                        <Popover key={index}>
                          <PopoverTrigger asChild>
                            <div 
                              className="flex justify-between items-center text-sm group relative h-6 cursor-pointer"
                              onMouseEnter={(e) => {
                                const trigger = e.currentTarget;
                                trigger.click();
                              }}
                              onMouseLeave={(e) => {
                                const trigger = e.currentTarget;
                                trigger.click();
                              }}
                            >
                              <div 
                                className={`absolute left-0 top-0 bottom-0 ${
                                  isAbnormalPrice ? 'bg-blue-500/20 group-hover:bg-blue-200/40' : 'bg-green-500/10 group-hover:bg-green-200/30'
                                } transition-all`}
                                style={{
                                  width: `${barWidth}%`,
                                  maxWidth: '100%'
                                }}
                              />
                              <div className="flex justify-between w-full relative z-10 px-6">
                                <span className={`${
                                  isAbnormalPrice ? 'text-blue-500' : 'text-green-500'
                                } font-medium tabular-nums`}>
                                  {priceDisplay(order.price)}
                                </span>
                                <span className="text-foreground tabular-nums">{formatNumber(order.amount)}</span>
                              </div>
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-fit max-w-sm">
                            <div className="space-y-1">
                              <div className="text-sm text-muted-foreground font-medium">
                                Price: {priceDisplay(order.price)}
                              </div>
                              <div className="text-sm text-muted-foreground font-medium">
                                Amount: {formatNumber(order.amount)}
                              </div>
                              <div className="text-sm text-muted-foreground font-medium">
                                Total（XEC）: {formatNumber(order.total)}
                              </div>
                              {isAbnormalPrice && (
                                <div className="text-sm text-blue-600 font-medium">
                                  This order may not be executed due to minimum buy price or other conditions
                                </div>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      );
                    })
                ) : (
                  Array.from({ length: ORDERBOOK_CONSTANTS.COLLAPSED_ORDERS_COUNT }, (_, i) => {
                    const referencePrice = orderBook?.orders?.length 
                      ? Math.min(...orderBook.orders.map(o => o.price))
                      : ORDERBOOK_CONSTANTS.DEFAULT_REFERENCE_PRICE;
                    const price = referencePrice * (1 - ORDERBOOK_CONSTANTS.SPREAD_DECREMENT * (i + 1));
                    return (
                      <div key={i} className="flex justify-between items-center text-sm h-6">
                        <div className="flex justify-between w-full px-6">
                          <span className="text-green-500 font-medium tabular-nums">{priceDisplay(price)}</span>
                          <span className="text-muted-foreground tabular-nums">0</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {!isBuySectionUnlocked && (
                <div className="absolute inset-0 z-20 rounded-xl bg-background/10 backdrop-blur-sm flex items-center justify-center px-4 text-center text-sm text-muted-foreground">
                  {lockedMessage}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex gap-4">
            {/* Bid list (actual data) */}
            <div className="flex-1 relative">
              <div className="grid grid-cols-3 text-sm text-muted-foreground mb-2">
                <span>PRICE ({showUSD ? 'USD' : 'XEC'})</span>
                <span className="text-right">QUANTITY</span>
                <span className="text-right">TOTAL</span>
              </div>
              <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
                {buyOrders.length > 0 ? (
                  buyOrders
                    .sort((a, b) => b.price - a.price)
                    .slice(0, ORDERBOOK_CONSTANTS.EXPANDED_ORDERS_COUNT)
                    .map((order, index) => {
                      const maxAmount = Math.max(...buyOrders.map(o => o.amount));
                      const barWidth = (order.amount / maxAmount) * 100;
                      const lowestAsk = Math.min(...orderBook.orders.map(o => o.price));
                      const isAbnormalPrice = order.price >= lowestAsk;

                      return (
                        <Popover key={index}>
                          <PopoverTrigger asChild>
                            <div
                              className="grid grid-cols-3 text-sm relative h-6 cursor-pointer"
                              onMouseEnter={(e) => {
                                const trigger = e.currentTarget;
                                trigger.click();
                              }}
                              onMouseLeave={(e) => {
                                const trigger = e.currentTarget;
                                trigger.click();
                              }}
                            >
                              <div className="absolute left-0 top-0 bottom-0 bg-green-500/10" style={{ width: `${barWidth}%` }} />
                              <span className={`${
                                isAbnormalPrice ? 'text-yellow-600' : 'text-green-500'
                              } font-medium tabular-nums relative z-10`}>
                                {priceDisplay(order.price)}
                              </span>
                              <span className="text-foreground tabular-nums text-right relative z-10">{formatNumber(order.amount)}</span>
                              <span className="text-muted-foreground tabular-nums text-right relative z-10">{formatNumber(order.total)}</span>
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-fit">
                            <div className="space-y-1">
                              <div className="text-sm text-muted-foreground font-medium">
                                Price: {priceDisplay(order.price)}
                              </div>
                              <div className="text-sm text-muted-foreground font-medium">
                                Amount: {formatNumber(order.amount)}
                              </div>
                              <div className="text-sm text-muted-foreground font-medium">
                                Total（XEC）: {formatNumber(order.total)}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      );
                    })
                ) : (
                  Array.from({ length: ORDERBOOK_CONSTANTS.EXPANDED_ORDERS_COUNT }, (_, i) => {
                    const referencePrice = orderBook?.orders?.length 
                      ? Math.min(...orderBook.orders.map(o => o.price))
                      : ORDERBOOK_CONSTANTS.DEFAULT_REFERENCE_PRICE;
                    const price = referencePrice * (1 - ORDERBOOK_CONSTANTS.SPREAD_DECREMENT * (i + 1));
                    return (
                      <div key={i} className="grid grid-cols-3 text-sm relative h-6">
                        <span className="text-green-500 font-medium tabular-nums">{priceDisplay(price)}</span>
                        <span className="text-muted-foreground tabular-nums text-right">0</span>
                        <span className="text-muted-foreground tabular-nums text-right">0</span>
                      </div>
                    );
                  })
                )}
              </div>

              {!isBuySectionUnlocked && (
                <div className="absolute inset-0 z-20 rounded-xl bg-background/70 backdrop-blur-md flex items-center justify-center px-4 text-center text-sm text-muted-foreground">
                  {lockedMessage}
                </div>
              )}
            </div>

            {/* Ask list (actual data) */}
            <div className="flex-1">
              <div className="grid grid-cols-3 text-sm text-muted-foreground mb-2">
                <span>PRICE ({showUSD ? 'USD' : 'XEC'})</span>
                <span className="text-right">QUANTITY</span>
                <span className="text-right">TOTAL</span>
              </div>
              <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
                {expandedAsks
                  ?.map((order, index: number) => {
                    const barWidth = askMaxAmount ? (order.amount / askMaxAmount) * 100 : 0;
                    return (
                      <Popover key={index}>
                        <PopoverTrigger asChild>
                          <div 
                            className="grid grid-cols-3 text-sm relative h-6 cursor-pointer"
                            onMouseEnter={(e) => {
                              const trigger = e.currentTarget;
                              trigger.click();
                            }}
                            onMouseLeave={(e) => {
                              const trigger = e.currentTarget;
                              trigger.click();
                            }}
                          >
                            <div className="absolute left-0 top-0 bottom-0 bg-pink-500/10" style={{ width: `${barWidth}%` }} />
                            <span className="text-pink-400 font-medium tabular-nums relative z-10">{priceDisplay(order.price)}</span>
                            <span className="text-foreground tabular-nums text-right relative z-10">{formatNumber(order.amount)}</span>
                            <span className="text-muted-foreground tabular-nums text-right relative z-10">{formatNumber(order.total)}</span>
                          </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-fit">
                          <div className="space-y-1">
                            <div className="text-sm text-muted-foreground font-medium">
                              Price: <span className="text-blue-500">{priceDisplay(order.price)}</span>
                            </div>
                            <div className="text-sm text-muted-foreground font-medium">
                              Amount: <span className="text-blue-500">{formatNumber(order.amount)}</span>
                            </div>
                            <div className="text-sm text-muted-foreground font-medium">
                              Total (XEC): <span className="text-blue-500">{formatNumber(order.total)}</span>
                            </div>
                            <div className="text-sm text-muted-foreground font-medium">
                              Cumulative qty: <span className="text-blue-500">{formatNumber(order.cumulativeAmount)}</span>
                            </div>
                            <div className="text-sm text-muted-foreground font-medium">
                              Buy to reach (XEC): <span className="text-blue-500">{formatNumber(order.cumulativeCost)}</span>
                            </div>
                            <div className="text-sm text-muted-foreground font-medium">
                              Seller: <span className="text-blue-500">{shortAddress(order.makerAddress)}</span>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 