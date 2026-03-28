import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { tokens } from '@/config/tokens';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CircleX, Trash2, CircleCheck, LoaderCircle, RefreshCw } from "lucide-react";
import { fetchTokenDetails, getTokenDecimalsFromDetails } from "@/lib/chronik";

interface Order {
  remainingAmount: number;
  maxPrice: number;
  status: string;
  transactions: any[];
  tokenId?: string;
  address?: string;
  tokenName?: string;
  orderType?: string; // added: order type field
  failureReason?: string; // added: failure reason field
}

interface OrderListProps {
  ecashAddress: string;
  balance?: number;
}

export function OrderList({ ecashAddress, balance = 0 }: OrderListProps) {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Record<string, Order>>({});
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [insufficientFundsOrders, setInsufficientFundsOrders] = useState<Set<string>>(new Set());
  const [tokenFilter, setTokenFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [availableTokens, setAvailableTokens] = useState<Array<{id: string, name: string}>>([]);
  const [tokenDecimalsMap, setTokenDecimalsMap] = useState<Record<string, number>>({});

  useEffect(() => {
    // Load orders from localStorage
    const loadOrders = () => {
      const savedOrders = JSON.parse(localStorage.getItem('swap_orders') || '{}');
      
      // Process orders and add extra info
      const processedOrders: Record<string, Order> = {};
      const tokenSet = new Set<string>();
      const tokenList: Array<{id: string, name: string}> = [];
      
      Object.entries(savedOrders).forEach(([key, orderData]) => {
        const [tokenId, address, price] = key.split('|');
        
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
          const tokenInfo = Object.values(tokens).find(token => token.tokenId === tokenId);
          
          if (tokenInfo) {
            order.tokenName = tokenInfo.name;
            
            // Collect unique tokens for filter options
            if (!tokenSet.has(tokenId)) {
              tokenSet.add(tokenId);
              tokenList.push({
                id: tokenId,
                name: tokenInfo.name
              });
            }
          } else {
            order.tokenName = 'Unknown token';
          }
          
          processedOrders[key] = order;
        }
      });
      
      setOrders(processedOrders);
      setAvailableTokens(tokenList);
      
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
        window.dispatchEvent(new Event('orders-updated'));
      }
      
      // Check whether orders are sufficiently funded
      checkOrdersFunding(processedOrders);
    };
    
    if (ecashAddress) {
      loadOrders();
    } else {
      setOrders({});
      setAvailableTokens([]);
    }
  }, [ecashAddress, refreshTrigger, balance]);

  // Load Chronik token detail from available token list to get precise decimals
  useEffect(() => {
    const loadTokenMeta = async () => {
      if (!availableTokens.length) return;

      for (const token of availableTokens) {
        const tokenId = token.id;
        // Skip when decimals already cached
        if (tokenDecimalsMap[tokenId] !== undefined) continue;

        try {
          const detail = await fetchTokenDetails(tokenId);
          // Try decimals from tokens.ts as a fallback
          const tokenInfo = Object.values(tokens).find(t => t.tokenId === tokenId);
          const fallbackDecimals = (tokenInfo as any)?.decimals ?? 0;
          const decimals = getTokenDecimalsFromDetails(detail, fallbackDecimals);

          setTokenDecimalsMap(prev => ({
            ...prev,
            [tokenId]: decimals,
          }));
        } catch (error) {
          console.error(`Failed to load token detail: ${tokenId}`, error);
          // On failure keep default 0 to avoid rendering impact
        }
      }
    };

    loadTokenMeta();
  }, [availableTokens, tokenDecimalsMap]);

  // Check whether orders are sufficiently funded
  const checkOrdersFunding = (ordersList: Record<string, Order>) => {
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
  };

  const refreshOrders = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    window.addEventListener('orderUpdated', refreshOrders);
    return () => {
      window.removeEventListener('orderUpdated', refreshOrders);
    };
  }, []);

  const handleDeleteOrder = (orderKey: string) => {
    setOrderToDelete(orderKey);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteOrder = () => {
    if (orderToDelete) {
      // Delete order from localStorage
      const savedOrders = JSON.parse(localStorage.getItem('swap_orders') || '{}');
      delete savedOrders[orderToDelete];
      localStorage.setItem('swap_orders', JSON.stringify(savedOrders));
      window.dispatchEvent(new Event('orders-updated'));
      
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

  // Filter orders
  const filteredOrders = Object.entries(orders).filter(([orderKey, order]) => {
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
    
    // Read latest auto-processing flag from localStorage on each click
    const currentAutoProcessing = localStorage.getItem('auto_processing') === 'true';
    
    // Verify auto-processing is enabled
    if (!currentAutoProcessing) {
      toast({
        title: "Auto processing is disabled",
        description: "Please enable the signal light to automatically process your orders",
        variant: "destructive",
      });
      return;
    }
    
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
      {/* Filters */}
      <div className="flex justify-between mb-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
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
        
        <Select value={tokenFilter} onValueChange={setTokenFilter}>
          <SelectTrigger className="w-[180px]">
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
      
      {/* Render actual orders */}
      {filteredOrders
        // Sort to prioritize pending and in-progress orders
        .sort((a, b) => {
          const [orderKeyA, orderA] = a;
          const [orderKeyB, orderB] = b;
          
          // First sort by status: pending/in-progress first, completed/fail later
          const statusPriorityA = (orderA.status === 'pending' || orderA.status === 'in-progress') ? 0 : 1;
          const statusPriorityB = (orderB.status === 'pending' || orderB.status === 'in-progress') ? 0 : 1;
          
          if (statusPriorityA !== statusPriorityB) {
            return statusPriorityA - statusPriorityB;
          }
          
          // Then sort by tokenId
          if (orderA.tokenId !== orderB.tokenId) {
            return (orderA.tokenId || '').localeCompare(orderB.tokenId || '');
          }
          
          // Finally sort by maxPrice descending within the same tokenId
          return orderB.maxPrice - orderA.maxPrice;
        })
        .map(([orderKey, order]) => {
 
        const tokenInfo = Object.values(tokens).find(token => token.tokenId === order.tokenId);
        const tokenSymbol = tokenInfo?.symbol || order.tokenName;
        
        const isCompleted = order.status === 'completed';
        
        const hasInsufficientFunds = insufficientFundsOrders.has(orderKey);
        
        const totalExecuted = order.transactions.reduce((sum, tx) => sum + tx.amount, 0);
        const originalAmount = order.remainingAmount + totalExecuted;
        const progressPercent = originalAmount > 0 ? Math.round((totalExecuted / originalAmount) * 100) : 0;
        
        // Use original order amount to compute total value
        const totalValue = (originalAmount * order.maxPrice).toFixed(2);
        
        return (
          <Card 
            key={orderKey} 
            className="rounded-3xl p-4 bg-background hover:bg-muted/30 hover:shadow-md transition-all duration-200 cursor-pointer"
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
                  </>
                )}
              </div>
            </div>
            
            <div className="flex justify-between mt-4">
              <Button 
                variant="outline" 
                size="sm" 
                className="text-muted-foreground"
                onClick={() => handleDeleteOrder(orderKey)}
              >
                {isCompleted ? (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete Order
                  </>
                ) : (
                  <>
                    <CircleX className="h-4 w-4" />
                    Cancel Order
                  </>
                )}
              </Button>
              
              <div className="flex gap-2">
                {/* View refund button - only when refund tx exists */}
                {hasRefundTransactions(order) && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="text-orange-600 border-orange-200 hover:bg-muted/30">
                        <RefreshCw className="h-4 w-4 mr-1" />
                        View Refunds
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
                {order.transactions.length > 0 && (
                  <Popover open={openPopover === orderKey} onOpenChange={(open) => setOpenPopover(open ? orderKey : null)}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        View Transactions
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-2">
                        <h4 className="font-medium">Transaction History</h4>
                        <div className="border rounded-md divide-y">
                          {order.transactions.map((tx, index) => (
                            <div key={index} className="p-2 flex justify-between items-center">
                              <div className="text-sm truncate max-w-[180px]">
                                <a 
                                  href={`https://explorer.e.cash/tx/${tx.txid}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  {formatTxId(tx.txid)}
                                </a>
                              </div>
                              <div className="text-sm font-medium">
                                {tx.amount} {tokenSymbol}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
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
    </div>
  );
}