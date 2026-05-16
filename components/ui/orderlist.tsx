import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { tokens } from '@/config/tokens';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CircleX, Trash2, CircleCheck, LoaderCircle, RefreshCw, History } from "lucide-react";
import {
  fetchTokenDetails,
  getCachedTokenDetails,
  getTokenDecimalsFromDetails,
} from "@/lib/chronik";
import {
  ORDERS_UPDATED_EVENT,
  clearSwapOrdersForAddress,
  deleteSwapOrder,
  dispatchOrdersUpdated,
} from "@/lib/swap-order-utils";
import { isBlockedTokenId } from "@/lib/blocked-tokens";

interface Order {
  remainingAmount: number;
  maxPrice: number;
  status: string;
  transactions: OrderTransaction[];
  createdAt?: string;
  tokenId?: string;
  address?: string;
  tokenName?: string;
  orderType?: string; // added: order type field
  failureReason?: string; // added: failure reason field
}

interface OrderTransaction {
  txid?: string;
  amount?: number;
  networkFee?: number;
  swapFee?: number;
  totalFees?: number;
  totalXECPaid?: number;
  refundTxid?: string;
  refundAmount?: number;
}

interface OrderListProps {
  ecashAddress: string;
  balance?: number;
}

function shortenTokenId(tokenId: string): string {
  return `${tokenId.substring(0, 6)}...${tokenId.substring(tokenId.length - 4)}`;
}

function getTokenNameFromDetail(
  detail: any,
  tokenId: string,
  fallbackName?: string,
): string {
  const tokenName = detail?.genesisInfo?.tokenName?.trim();
  if (tokenName) {
    return tokenName;
  }

  const tokenTicker = detail?.genesisInfo?.tokenTicker?.trim();
  if (tokenTicker) {
    return tokenTicker;
  }

  return fallbackName || shortenTokenId(tokenId);
}

export function OrderList({ ecashAddress, balance = 0 }: OrderListProps) {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Record<string, Order>>({});
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [insufficientFundsOrders, setInsufficientFundsOrders] = useState<Set<string>>(new Set());
  const [tokenFilter, setTokenFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [availableTokens, setAvailableTokens] = useState<Array<{id: string, name: string}>>([]);
  const [tokenDecimalsMap, setTokenDecimalsMap] = useState<Record<string, number>>({});

  // Check whether orders are sufficiently funded
  const checkOrdersFunding = useCallback((ordersList: Record<string, Order>) => {
    // Group orders by tokenId
    const ordersByToken: Record<string, Array<Order & { key: string }>> = {};

    Object.entries(ordersList).forEach(([key, order]) => {
      if (!order.tokenId) return;

      // Only check orders that are not completed or failed
      if (order.status === 'completed' || order.status === 'fail') return;

      if (!ordersByToken[order.tokenId]) {
        ordersByToken[order.tokenId] = [];
      }

      ordersByToken[order.tokenId].push({...order, key});
    });

    const insufficientOrders = new Set<string>();

    // Check each token group separately
    Object.values(ordersByToken).forEach(tokenOrders => {
      // Sort by price descending
      tokenOrders.sort((a, b) => b.maxPrice - a.maxPrice);

      let remainingBalance = balance;

      // Evaluate each order
      tokenOrders.forEach(order => {
        const orderCost = order.remainingAmount * order.maxPrice;

        if (remainingBalance < orderCost) {
          // Insufficient balance, mark the order
          insufficientOrders.add(order.key);
        } else {
          // Balance sufficient, deduct order cost
          remainingBalance -= orderCost;
        }
      });
    });

    setInsufficientFundsOrders(insufficientOrders);
  }, [balance]);

  useEffect(() => {
    let cancelled = false;

    const getConfiguredToken = (tokenId: string) =>
      Object.values(tokens).find(token => token.tokenId === tokenId);

    const getInitialTokenName = (tokenId: string) => {
      const tokenInfo = getConfiguredToken(tokenId);
      return tokenInfo?.name || shortenTokenId(tokenId);
    };

    const loadOrders = async () => {
      const savedOrders = JSON.parse(localStorage.getItem('swap_orders') || '{}');
      
      // Process orders and add extra info
      const processedOrders: Record<string, Order> = {};
      const tokenSet = new Set<string>();
      
      Object.entries(savedOrders).forEach(([key, orderData]) => {
        const parts = key.split('|');
        const tokenId = parts[0];
        const address = parts[1];
        const price = parts[2];
        // parts[3] is the random string (if present)

        if (isBlockedTokenId(tokenId)) {
          return;
        }

        // Only show orders for the connected wallet
        if (address === ecashAddress) {
          const order = orderData as Order;
          
          // Add extra metadata to the order object
          order.tokenId = tokenId;
          order.address = address;
          
          // Keep orderType field to support legacy orders
          if (!order.orderType) {
            order.orderType = 'online'; // default to online for legacy orders
          }
          
          // Auto-complete tiny remainders to avoid stuck dust orders (guard price>0)
          if (order.orderType === 'online' && order.status !== 'completed' && order.remainingAmount > 0) {
            const priceNum = parseFloat(price);
            if (priceNum > 0) {
              const remainingValue = order.remainingAmount * priceNum;
              if (remainingValue < 100) {
                order.status = 'completed';
                order.remainingAmount = 0;
              }
            }
          }
          
          // Look up token info by tokenId
          order.tokenName = getInitialTokenName(tokenId);

          if (!tokenSet.has(tokenId)) {
            tokenSet.add(tokenId);
          }
          
          processedOrders[key] = order;
        }
      });

      const tokenIds = Array.from(tokenSet);
      const initialTokenList = tokenIds
        .map((tokenId) => ({
          id: tokenId,
          name: getInitialTokenName(tokenId),
        }))
        .sort((left, right) => left.name.localeCompare(right.name));

      if (cancelled) {
        return;
      }

      setOrders(processedOrders);
      setAvailableTokens(initialTokenList);
      
      // If any orders are auto-marked complete, persist to localStorage
      const hasChanges = Object.entries(processedOrders).some(([key, order]) => {
        const original = savedOrders[key];
        return original && (original.status !== order.status || original.remainingAmount !== order.remainingAmount);
      });
      
      if (hasChanges) {
        // Rebuild the full order objects
        const updatedOrders = { ...savedOrders };
        Object.entries(processedOrders).forEach(([key, order]) => {
          updatedOrders[key] = {
            ...updatedOrders[key],
            status: order.status,
            remainingAmount: order.remainingAmount
          };
        });
        
        localStorage.setItem('swap_orders', JSON.stringify(updatedOrders));
        dispatchOrdersUpdated("processed");
      }
      
      // Check whether orders are sufficiently funded
      checkOrdersFunding(processedOrders);

      if (tokenIds.length === 0) {
        if (!cancelled) {
          setTokenDecimalsMap({});
        }
        return;
      }

      const tokenMetaResults = await Promise.allSettled(
        tokenIds.map(async (tokenId) => {
          const tokenInfo = getConfiguredToken(tokenId);
          const fallbackDecimals = (tokenInfo as any)?.decimals ?? 0;
          const cachedDetail = getCachedTokenDetails(tokenId);
          const detail = cachedDetail || await fetchTokenDetails(tokenId);

          return {
            tokenId,
            name: getTokenNameFromDetail(detail, tokenId, getInitialTokenName(tokenId)),
            decimals: getTokenDecimalsFromDetails(detail, fallbackDecimals),
          };
        }),
      );

      if (cancelled) {
        return;
      }

      const resolvedOrders: Record<string, Order> = {};
      Object.entries(processedOrders).forEach(([key, order]) => {
        resolvedOrders[key] = { ...order };
      });

      const nextTokenList = tokenIds.map((tokenId) => ({
        id: tokenId,
        name: getInitialTokenName(tokenId),
      }));
      const nextDecimalsMap: Record<string, number> = {};

      tokenMetaResults.forEach((result, index) => {
        const tokenId = tokenIds[index];
        const tokenInfo = getConfiguredToken(tokenId);
        const fallbackDecimals = (tokenInfo as any)?.decimals ?? 0;

        if (result.status === "fulfilled") {
          const { name, decimals } = result.value;
          nextDecimalsMap[tokenId] = decimals;

          for (const order of Object.values(resolvedOrders)) {
            if (order.tokenId === tokenId) {
              order.tokenName = name;
            }
          }

          const tokenListEntry = nextTokenList.find((token) => token.id === tokenId);
          if (tokenListEntry) {
            tokenListEntry.name = name;
          }
        } else {
          console.error(`Failed to load token detail: ${tokenId}`, result.reason);
          nextDecimalsMap[tokenId] = fallbackDecimals;
        }
      });

      setOrders(resolvedOrders);
      setAvailableTokens(
        nextTokenList.sort((left, right) => left.name.localeCompare(right.name)),
      );
      setTokenDecimalsMap(nextDecimalsMap);
    };
    
    if (ecashAddress) {
      void loadOrders();
    } else {
      setOrders({});
      setAvailableTokens([]);
      setTokenDecimalsMap({});
    }

    return () => {
      cancelled = true;
    };
  }, [checkOrdersFunding, ecashAddress, refreshTrigger]);

  const refreshOrders = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    window.addEventListener(ORDERS_UPDATED_EVENT, refreshOrders);
    return () => {
      window.removeEventListener(ORDERS_UPDATED_EVENT, refreshOrders);
    };
  }, []);

  const handleDeleteOrder = (orderKey: string) => {
    setOrderToDelete(orderKey);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteOrder = () => {
    if (orderToDelete) {
      deleteSwapOrder(orderToDelete, "deleted");
      
      // Update state
      const newOrders = { ...orders };
      delete newOrders[orderToDelete];
      setOrders(newOrders);
      
      // Show success toast
      toast({
        title: "✅ Order Deleted",
        description: "Your order has been successfully deleted",
      });
      
      // Close dialog
      setIsDeleteDialogOpen(false);
      setOrderToDelete(null);
    }
  };

  const confirmClearAllOrders = () => {
    clearSwapOrdersForAddress(ecashAddress, "cleared");
    setOrders({});
    setAvailableTokens([]);
    setInsufficientFundsOrders(new Set());
    setIsClearAllDialogOpen(false);

    toast({
      title: "✅ Orders Cleared",
      description: "All buy orders for this wallet have been deleted",
    });
  };

  // Format token amount for display
  const formatTokenAmount = (amount: number, tokenId: string | undefined) => {
    if (!tokenId) return amount.toString();

    const decimals = tokenDecimalsMap[tokenId] ?? 0;
    // Note: do not divide by 10^decimals here; order amounts are already in user-input units
    return amount.toFixed(decimals);
  };

  // Format txid for display
  const formatTxId = (txid: string) => {
    return `${txid.substring(0, 6)}...${txid.substring(txid.length - 6)}`;
  };

  const getOrderTimestamp = (order: Order) => {
    if (!order.createdAt) return 0;
    const timestamp = new Date(order.createdAt).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
  };

  const formatOrderTime = (createdAt?: string) => {
    if (!createdAt) return "Unknown time";

    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return "Unknown time";

    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  };

  // Filter orders
  const filteredOrders = Object.entries(orders).filter(([orderKey, order]) => {
    if (isBlockedTokenId(order.tokenId)) return false;

    // Token filter
    if (tokenFilter !== "all" && order.tokenId !== tokenFilter) return false;
    
    // Status filter
    if (statusFilter !== "all") {
      if (statusFilter === "pending" && order.status !== "pending") return false;
      if (statusFilter === "in-progress" && order.status !== "in-progress") return false;
      if (statusFilter === "completed" && order.status !== "completed") return false;
      if (statusFilter === "fail" && order.status !== "fail") return false;
    }
    
    return true;
  });

  // Check whether an order contains refund transactions
  const hasRefundTransactions = (order: Order) => {
    return order.transactions.some(tx => tx.refundTxid || tx.refundAmount);
  };

  // Handle card click
  const handleCardClick = (order: Order) => {
    // Skip prompts when an order is completed
    if (order.status === 'completed') return;

    // Show status-specific message
    if (order.status === 'pending') {
      if (order.transactions.length === 0) {
        toast({
          title: "Waiting for sellers",
          description: `Your order for ${order.tokenName} is waiting for matching sell orders`,
        });
      } else {
        toast({
          title: "Order partially filled",
          description: `${order.transactions.length} transactions completed. Still waiting for more sellers to complete your order`,
        });
      }
    } else {
      toast({
        title: "Order in progress",
        description: "Your order is currently being processed",
      });
    }
  };

  if (Object.keys(orders).length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-muted-foreground mb-4">You haven't created any orders yet</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2 p-4">
      <div className="mb-2 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="fail">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-0 flex-1">
          <Select value={tokenFilter} onValueChange={setTokenFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filter by token" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tokens</SelectItem>
              {availableTokens.map(token => (
                <SelectItem key={token.id} value={token.id}>
                  {token.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={() => setIsClearAllDialogOpen(true)}
          aria-label="Clear all orders"
          title="Clear all orders"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Render actual orders */}
      {filteredOrders
        .sort((a, b) => {
          const timeDiff = getOrderTimestamp(b[1]) - getOrderTimestamp(a[1]);
          if (timeDiff !== 0) {
            return timeDiff;
          }

          return b[1].maxPrice - a[1].maxPrice;
        })
        .map(([orderKey, order]) => {
 
        const tokenInfo = Object.values(tokens).find(token => token.tokenId === order.tokenId);
        const tokenSymbol = tokenInfo?.symbol || order.tokenName;
        
        const isCompleted = order.status === 'completed';
        
        const hasInsufficientFunds = insufficientFundsOrders.has(orderKey);
        
        const totalExecuted = order.transactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
        const totalNetworkFees = order.transactions.reduce(
          (sum, tx) => sum + (Number(tx.networkFee) || 0),
          0,
        );
        const totalSwapFees = order.transactions.reduce(
          (sum, tx) => sum + (Number(tx.swapFee) || 0),
          0,
        );
        const totalFeesPaid = order.transactions.reduce(
          (sum, tx) =>
            sum +
            (typeof tx.totalFees === 'number'
              ? tx.totalFees
              : (Number(tx.networkFee) || 0) + (Number(tx.swapFee) || 0)),
          0,
        );
        const originalAmount = order.remainingAmount + totalExecuted;
        const progressPercent = originalAmount > 0 ? Math.round((totalExecuted / originalAmount) * 100) : 0;
        
        // Use original order amount to compute total value
        const totalValue = (originalAmount * order.maxPrice).toFixed(2);
        
        return (
          <Card 
            key={orderKey} 
            data-testid={`order-card-${orderKey}`}
            className="rounded-xl p-4 bg-background hover:bg-muted/30 hover:shadow-md transition-all duration-200 cursor-pointer"
            onClick={() => handleCardClick(order)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <Avatar className="h-8 w-8 mr-2">
                  <AvatarImage 
                    src={`https://icons.etokens.cash/32/${order.tokenId}.png`} 
                    alt={order.tokenName} 
                  />
                  <AvatarFallback>{order.tokenName?.substring(0, 2)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{order.tokenName}</div>
                  <div className="text-sm text-muted-foreground">
                    <Label className={`px-2 py-0.5 rounded-full text-xs ${
                      order.status === 'pending' ? 'bg-gray-100 text-gray-800' : 
                      order.status === 'completed' ? 'bg-green-100 text-green-800' : 
                      order.status === 'fail' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {order.status === 'pending' ? 'Pending' : 
                       order.status === 'completed' ? 'Completed' : 
                       order.status === 'fail' ? 'Failed' :
                       'In Progress'}
                    </Label>
                    
                    {/* Order type label */}
                    <Label className={`px-2 py-0.5 rounded-full text-xs ml-1 ${
                      order.orderType === 'offline' 
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                        : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    }`}>
                      {order.orderType === 'offline' ? 'Custodial' : 'Self-Custody'}
                    </Label>
                    
                    {/* Insufficient balance label */}
                    {hasInsufficientFunds && !isCompleted && order.status !== 'fail' && (
                      <Label className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800 ml-1">
                        Insufficient Funds
                      </Label>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Top-right shows only progress and price */}
              <div className="text-right">
                <div className="flex items-center justify-end gap-2">
                  {isCompleted ? (
                    <div className="flex items-center text-sm text-green-400">
                      <CircleCheck className="h-4 w-4 mr-1" />
                      <span>100%</span>
                    </div>
                  ) : (
                    <div className={`flex items-center text-sm font-medium ${progressPercent > 0 ? 'text-green-400' : 'text-muted-foreground'}`}>
                      <LoaderCircle className="h-4 w-4 mr-1" />
                      <span>{progressPercent}%</span>
                    </div>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {order.maxPrice} XEC
                </div>
              </div>
            </div>
            
            {/* Trade info goes in the card body */}
            <div className="mt-3 pt-3 border-t border-muted/30">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Target Amount</div>
                  <div className="font-medium">
                    {formatTokenAmount(originalAmount, order.tokenId)} {tokenSymbol}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Total Value</div>
                  <div className="font-medium">{totalValue} XEC</div>
                </div>
                {totalExecuted > 0 && (
                  <>
                    <div>
                      <div className="text-muted-foreground text-xs">Executed</div>
                      <div className="font-medium text-green-600">
                        {totalExecuted} {tokenSymbol}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">Remaining</div>
                      <div className="font-medium">
                        {formatTokenAmount(order.remainingAmount, order.tokenId)} {tokenSymbol}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">Fees Paid</div>
                      <div className="font-medium">
                        {totalFeesPaid.toFixed(2)} XEC
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">Swap / Network</div>
                      <div className="font-medium">
                        {totalSwapFees.toFixed(2)} / {totalNetworkFees.toFixed(2)} XEC
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between mt-4">
              <div className="text-xs text-muted-foreground" data-testid={`order-time-${orderKey}`}>
                {formatOrderTime(order.createdAt)}
              </div>

              <div className="flex items-center gap-1">
                {/* View refund button - only when refund tx exists */}
                {hasRefundTransactions(order) && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-orange-600 hover:text-orange-700"
                        onClick={(event) => event.stopPropagation()}
                        aria-label="View Refunds"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                                         <PopoverContent className="w-80">
                       <div className="space-y-2">
                         <h4 className="font-medium">Refund History</h4>
                         <div className="border rounded-md divide-y">
                           {order.transactions
                             .filter(tx => tx.refundTxid || tx.refundAmount)
                             .map((tx, index) => (
                             <div key={index} className="p-2 space-y-2">
                               {tx.refundTxid && (
                                 <div className="flex justify-between items-center">
                                   <div className="text-sm text-muted-foreground">Refund Tx:</div>
                                   <div className="text-sm">
                                     <a 
                                       href={`https://explorer.e.cash/tx/${tx.refundTxid}`} 
                                       target="_blank" 
                                       rel="noopener noreferrer"
                                       className="text-orange-600 hover:underline"
                                     >
                                       {formatTxId(tx.refundTxid)}
                                     </a>
                                   </div>
                                 </div>
                               )}
                               {tx.refundAmount && (
                                 <div className="flex justify-between items-center">
                                   <div className="text-sm text-muted-foreground">Refund Amount:</div>
                                   <div className="text-sm font-medium text-orange-600">
                                     {tx.refundAmount} XEC
                                   </div>
                                 </div>
                               )}
                             </div>
                           ))}
                         </div>
                       </div>
                     </PopoverContent>
                  </Popover>
                )}
                
                {/* View transaction button */}
                {order.transactions.some(tx => tx.txid) && (
                  <Popover open={openPopover === orderKey} onOpenChange={(open) => setOpenPopover(open ? orderKey : null)}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={(event) => event.stopPropagation()}
                        aria-label="View Transactions"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-2">
                        <h4 className="font-medium">Transaction History</h4>
                        <div className="border rounded-md divide-y">
                          {order.transactions
                            .filter(tx => tx.txid)
                            .map((tx, index) => (
                            <div key={index} className="p-2 space-y-2">
                              <div className="flex justify-between items-center gap-3">
                                <div className="text-sm truncate max-w-[180px]">
                                  <a 
                                    href={`https://explorer.e.cash/tx/${tx.txid}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline"
                                  >
                                    {formatTxId(tx.txid!)}
                                  </a>
                                </div>
                                <div className="text-sm font-medium">
                                  {tx.amount} {tokenSymbol}
                                </div>
                              </div>
                              {((Number(tx.swapFee) || 0) > 0 || (Number(tx.networkFee) || 0) > 0) && (
                                <div className="flex justify-between items-center text-xs text-muted-foreground">
                                  <span>
                                    Fees ({(Number(tx.swapFee) || 0).toFixed(2)} swap + {(Number(tx.networkFee) || 0).toFixed(2)} network)
                                  </span>
                                  <span className="font-medium text-foreground">
                                    {(
                                      typeof tx.totalFees === 'number'
                                        ? tx.totalFees
                                        : (Number(tx.swapFee) || 0) + (Number(tx.networkFee) || 0)
                                    ).toFixed(2)} XEC
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDeleteOrder(orderKey);
                  }}
                  aria-label={isCompleted ? "Delete Order" : "Cancel Order"}
                >
                  {isCompleted ? (
                    <Trash2 className="h-4 w-4" />
                  ) : (
                    <CircleX className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            
            {/* Failure reason shown at the card bottom */}
            {order.status === 'fail' && order.failureReason && (
              <div className="mt-1 pt-1 ">
                <div className="text-xs text-red-600 flex items-center">
                  <span className="font-medium">Error:</span>
                  <span className="ml-2">{order.failureReason}</span>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  If you haven't received a refund or purchased tokens, please contact mupeishan@proton.me with your address or AOV transaction TXid
                </div>
              </div>
            )}
          </Card>
        );
      })}
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Order Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this order? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteOrder}>Confirm Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isClearAllDialogOpen} onOpenChange={setIsClearAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all orders</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all buy orders stored for the connected wallet on this device.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmClearAllOrders}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear all orders
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
