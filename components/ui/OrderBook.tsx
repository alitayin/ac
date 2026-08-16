"use client"
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Maximize2, Minimize2, DollarSign, TrendingDown } from "lucide-react";
import { useXECPrice } from "@/lib/price"
import { fetchTokenOrders } from "@/lib/api"
import { formatNumber, convertPrice } from "@/lib/formatters"
import { cn } from "@/lib/utils"
import { tokens } from "@/config/tokens"
import { 
  TOKEN_IDS, 
  ORDERBOOK_CONSTANTS, 
  UPDATE_INTERVALS, 
  UI_CONSTANTS 
} from "@/lib/constants"
import type { Order, OrderBookProps, BuyOrderResponse } from "@/lib/types"

const BUY_ORDER_REQUEST_TIMEOUT_MS = 7000;
const BUY_ORDER_INITIAL_BACKOFF_MS = 15000;
const BUY_ORDER_MAX_BACKOFF_MS = 60000;
const FIRMA_BID_ALERT_USDT = 0.998;
const FIRMA_BID_LABEL = "Firma buyback";
const BINANCE_PRICE_LABEL = "Binance price";

type DisplayBuyOrder = Order & {
  isFirmaBid?: boolean;
};

export default function OrderBook({
  orderBook,
  className = "",
  tokenId,
  latestPrice = 0,
  firmaBidXec,
}: OrderBookProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showZoomButton, setShowZoomButton] = useState(false);
  const [showUSD, setShowUSD] = useState(false);
  const [buyOrders, setBuyOrders] = useState<Order[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);
  const collapsedAskRef = useRef<HTMLDivElement>(null);
  const collapsedBidRef = useRef<HTMLDivElement>(null);
  const xecPrice = useXECPrice();
  const isFirmaOrderBook = tokenId === tokens.firma.tokenId;
  const hasFirmaBid = isFirmaOrderBook && Number.isFinite(firmaBidXec) && (firmaBidXec ?? 0) > 0;
  const firmaBidUsd = hasFirmaBid && xecPrice > 0
    ? (firmaBidXec as number) * xecPrice
    : 0;
  const isFirmaBidBelowAlert = firmaBidUsd > 0 && firmaBidUsd < FIRMA_BID_ALERT_USDT;
  const firmaBinanceNeutralPrice = isFirmaOrderBook && xecPrice > 0
    ? 1 / xecPrice
    : 0;
  const mountedRef = useRef(true);
  const inFlightBuyOrdersRef = useRef<Promise<void> | null>(null);
  const activeBuyOrdersAbortRef = useRef<AbortController | null>(null);
  const buyOrdersBackoffRef = useRef({
    until: 0,
    delay: BUY_ORDER_INITIAL_BACKOFF_MS,
  });

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      activeBuyOrdersAbortRef.current?.abort();
      activeBuyOrdersAbortRef.current = null;
      inFlightBuyOrdersRef.current = null;
    };
  }, []);

  const fetchBuyOrders = useCallback((options: { force?: boolean } = {}) => {
    if (inFlightBuyOrdersRef.current) {
      return inFlightBuyOrdersRef.current;
    }

    if (!options.force && Date.now() < buyOrdersBackoffRef.current.until) {
      return Promise.resolve();
    }

    const controller = new AbortController();
    activeBuyOrdersAbortRef.current = controller;
    let didTimeout = false;
    let request: Promise<void> | null = null;
    const timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, BUY_ORDER_REQUEST_TIMEOUT_MS);

    request = (async () => {
      try {
        const data: BuyOrderResponse = await fetchTokenOrders(tokenId, {
          signal: controller.signal,
        });

        if (controller.signal.aborted || !mountedRef.current) {
          return;
        }

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

        if (tokenId === TOKEN_IDS.SPARK) {
          formattedOrders.push({
            price: 1,
            amount: 10000000000,
            total: 10000000000
          });
        }

        setBuyOrders(formattedOrders);
        buyOrdersBackoffRef.current = {
          until: 0,
          delay: BUY_ORDER_INITIAL_BACKOFF_MS,
        };
      } catch (error) {
        if ((controller.signal.aborted && !didTimeout) || !mountedRef.current) {
          return;
        }

        console.error(
          didTimeout
            ? `Buy orders request timed out after ${BUY_ORDER_REQUEST_TIMEOUT_MS}ms`
            : 'Error fetching buy orders:',
          error,
        );

        // Even on request failure, keep the Spark page hint bid
        if (tokenId === TOKEN_IDS.SPARK) {
          setBuyOrders([{
            price: 1,
            amount: 10000000000,
            total: 10000000000
          }]);
        } else {
          setBuyOrders([]);
        }

        const delay = buyOrdersBackoffRef.current.delay;
        buyOrdersBackoffRef.current = {
          until: Date.now() + delay,
          delay: Math.min(delay * 2, BUY_ORDER_MAX_BACKOFF_MS),
        };
      } finally {
        clearTimeout(timeoutId);
        if (activeBuyOrdersAbortRef.current === controller) {
          activeBuyOrdersAbortRef.current = null;
        }
        if (request && inFlightBuyOrdersRef.current === request) {
          inFlightBuyOrdersRef.current = null;
        }
      }
    })();

    inFlightBuyOrdersRef.current = request;
    return request;
  }, [tokenId]);

  useEffect(() => {
    void fetchBuyOrders({ force: true });
    const interval = setInterval(() => {
      void fetchBuyOrders();
    }, UPDATE_INTERVALS.TEN_SECONDS);

    return () => {
      clearInterval(interval);
      activeBuyOrdersAbortRef.current?.abort();
      activeBuyOrdersAbortRef.current = null;
      inFlightBuyOrdersRef.current = null;
    };
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
  }, [isExpanded, orderBook?.orders?.length, buyOrders.length, hasFirmaBid]);

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
  const asksWithCumulative = useMemo(
    () =>
      orderBook?.orders
        ? [...orderBook.orders]
            .sort((a: Order, b: Order) => a.price - b.price)
            .reduce((acc, order) => {
              const previous = acc[acc.length - 1];
              const cumulativeAmount = (previous?.cumulativeAmount ?? 0) + order.amount;
              const cumulativeCost = (previous?.cumulativeCost ?? 0) + order.amount * order.price;
              acc.push({ ...order, cumulativeAmount, cumulativeCost });
              return acc;
            }, [] as Array<Order & { cumulativeAmount: number; cumulativeCost: number }>)
        : [],
    [orderBook?.orders],
  );

  const askMaxAmount = useMemo(
    () => asksWithCumulative.length ? Math.max(...asksWithCumulative.map((o) => o.amount)) : 0,
    [asksWithCumulative]
  );

  const buyOrderMaxAmount = useMemo(
    () => buyOrders.length ? Math.max(...buyOrders.map((o) => o.amount)) : 0,
    [buyOrders]
  );

  const displayBuyOrders = useMemo<DisplayBuyOrder[]>(() => {
    const orders: DisplayBuyOrder[] = [...buyOrders];
    if (hasFirmaBid) {
      orders.push({
        price: firmaBidXec as number,
        amount: 0,
        total: 0,
        isFirmaBid: true,
      });
    }
    return orders.sort((a, b) => b.price - a.price);
  }, [buyOrders, firmaBidXec, hasFirmaBid]);

  const lowestAsk = useMemo(
    () => orderBook?.orders?.length ? Math.min(...orderBook.orders.map((o) => o.price)) : Infinity,
    [orderBook?.orders]
  );

  const highestBid = useMemo(
    () => buyOrders.length ? Math.max(...buyOrders.map((o) => o.price)) : 0,
    [buyOrders]
  );

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
                          className={cn(
                            "flex justify-between items-center text-sm group relative cursor-pointer",
                            "h-6",
                          )}
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
              {firmaBinanceNeutralPrice > 0 && (
                <div
                  className="mb-2 flex items-center justify-between rounded-md border border-border/60 bg-muted/50 px-6 py-2 text-sm"
                  data-testid="firma-binance-neutral-price"
                >
                  <span className="font-medium tabular-nums text-muted-foreground">
                    {priceDisplay(firmaBinanceNeutralPrice)}
                  </span>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {BINANCE_PRICE_LABEL}
                  </span>
                </div>
              )}
              {orderBook?.orders && orderBook.orders.length > 0 && buyOrders.length > 0 && (
                <div className="flex justify-between text-sm px-6">
                  <span className="text-muted-foreground">Spread:</span>
                  <span className="tabular-nums">
                    {(() => {
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
                {displayBuyOrders.length > 0 ? (
                  displayBuyOrders
                    .slice(0, ORDERBOOK_CONSTANTS.COLLAPSED_ORDERS_COUNT)
                    .map((order, index) => {
                      const barWidth = order.isFirmaBid || buyOrderMaxAmount <= 0
                        ? 0
                        : (order.amount / buyOrderMaxAmount) * 100 * UI_CONSTANTS.ORDERBOOK_BAR_MULTIPLIER;
                      const isAbnormalPrice = order.price >= lowestAsk;
                      const isSpecialFirmaBid = order.isFirmaBid === true;

                      return (
                        <Popover key={index}>
                          <PopoverTrigger asChild>
                            <div 
                              className={cn(
                                "flex justify-between items-center text-sm group relative cursor-pointer",
                                "h-6",
                              )}
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
                                  isSpecialFirmaBid
                                    ? 'bg-red-500/10 group-hover:bg-red-200/30'
                                    : isAbnormalPrice
                                      ? 'bg-blue-500/20 group-hover:bg-blue-200/40'
                                      : 'bg-green-500/10 group-hover:bg-green-200/30'
                                } transition-all`}
                                style={{
                                  width: `${barWidth}%`,
                                  maxWidth: '100%'
                                }}
                              />
                              <div className="flex justify-between w-full relative z-10 px-6">
                                <div className="flex items-center gap-1 leading-tight">
                                  <span className={`${
                                    isSpecialFirmaBid
                                      ? (isFirmaBidBelowAlert ? 'text-red-500' : 'text-green-500')
                                      : isAbnormalPrice ? 'text-blue-500' : 'text-green-500'
                                  } font-medium tabular-nums`}>
                                    {priceDisplay(order.price)}
                                  </span>
                                  {isSpecialFirmaBid && isFirmaBidBelowAlert ? (
                                    <span title="Firma bid is below 0.998 USDT">
                                      <TrendingDown
                                        className="h-3.5 w-3.5 text-red-500"
                                        aria-label="Firma bid is below 0.998 USDT"
                                      />
                                    </span>
                                  ) : null}
                                </div>
                                <span className={`tabular-nums ${isSpecialFirmaBid ? 'text-muted-foreground' : 'text-foreground'}`}>
                                  {isSpecialFirmaBid ? FIRMA_BID_LABEL : formatNumber(order.amount)}
                                </span>
                              </div>
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-fit max-w-sm">
                            <div className="space-y-1">
                              <div className="text-sm text-muted-foreground font-medium">
                                Price: {priceDisplay(order.price)}
                              </div>
                              <div className="text-sm text-muted-foreground font-medium">
                                Amount: {isSpecialFirmaBid ? FIRMA_BID_LABEL : formatNumber(order.amount)}
                              </div>
                              <div className="text-sm text-muted-foreground font-medium">
                                Total（XEC）: {isSpecialFirmaBid ? '--' : formatNumber(order.total)}
                              </div>
                              {isAbnormalPrice && !isSpecialFirmaBid && (
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
                    const referencePrice = lowestAsk !== Infinity
                      ? lowestAsk
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
                {displayBuyOrders.length > 0 ? (
                  displayBuyOrders
                    .slice(0, ORDERBOOK_CONSTANTS.EXPANDED_ORDERS_COUNT)
                    .map((order, index) => {
                      const barWidth = order.isFirmaBid || buyOrderMaxAmount <= 0
                        ? 0
                        : (order.amount / buyOrderMaxAmount) * 100;
                      const isAbnormalPrice = order.price >= lowestAsk;
                      const isSpecialFirmaBid = order.isFirmaBid === true;

                      return (
                        <Popover key={index}>
                          <PopoverTrigger asChild>
                            <div
                              className={cn(
                                "grid grid-cols-3 text-sm relative cursor-pointer",
                                "h-6",
                              )}
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
                                className={`absolute left-0 top-0 bottom-0 ${isSpecialFirmaBid ? 'bg-red-500/10' : 'bg-green-500/10'}`}
                                style={{ width: `${barWidth}%` }}
                              />
                              <div className="flex items-center gap-1 leading-tight">
                                <span className={`${
                                  isSpecialFirmaBid
                                    ? (isFirmaBidBelowAlert ? 'text-red-500' : 'text-green-500')
                                    : isAbnormalPrice ? 'text-yellow-600' : 'text-green-500'
                                } font-medium tabular-nums relative z-10`}>
                                  {priceDisplay(order.price)}
                                </span>
                                {isSpecialFirmaBid && isFirmaBidBelowAlert ? (
                                  <span title="Firma bid is below 0.998 USDT">
                                    <TrendingDown
                                      className="h-3.5 w-3.5 text-red-500"
                                      aria-label="Firma bid is below 0.998 USDT"
                                    />
                                  </span>
                                ) : null}
                              </div>
                              <span className={`tabular-nums text-right relative z-10 ${isSpecialFirmaBid ? 'text-muted-foreground' : 'text-foreground'}`}>
                                {isSpecialFirmaBid ? FIRMA_BID_LABEL : formatNumber(order.amount)}
                              </span>
                              <span className="text-muted-foreground tabular-nums text-right relative z-10">
                                {isSpecialFirmaBid ? '--' : formatNumber(order.total)}
                              </span>
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-fit">
                            <div className="space-y-1">
                              <div className="text-sm text-muted-foreground font-medium">
                                Price: {priceDisplay(order.price)}
                              </div>
                              <div className="text-sm text-muted-foreground font-medium">
                                Amount: {isSpecialFirmaBid ? FIRMA_BID_LABEL : formatNumber(order.amount)}
                              </div>
                              <div className="text-sm text-muted-foreground font-medium">
                                Total（XEC）: {isSpecialFirmaBid ? '--' : formatNumber(order.total)}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      );
                    })
                ) : (
                  Array.from({ length: ORDERBOOK_CONSTANTS.EXPANDED_ORDERS_COUNT }, (_, i) => {
                    const referencePrice = lowestAsk !== Infinity
                      ? lowestAsk
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
                            className={cn(
                              "grid grid-cols-3 text-sm relative cursor-pointer",
                              "h-6",
                            )}
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
