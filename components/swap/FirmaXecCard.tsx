import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FirmaXecCardProps {
  xecPriceUSD: string;
  onXecPriceChange: (value: string) => void;
  firmaSpend: string;
  onFirmaSpendChange: (value: string) => void;
  firmaBalance: number;
  xecReceive: string;
  currentXecPrice: number;
  onConfirm: () => void;
  isWalletConnected: boolean;
}

const FIRMA_PRICE_USD = 0.996;

export function FirmaXecCard({
  xecPriceUSD,
  onXecPriceChange,
  firmaSpend,
  onFirmaSpendChange,
  firmaBalance,
  xecReceive,
  currentXecPrice,
  onConfirm,
  isWalletConnected,
}: FirmaXecCardProps) {
  const handleMaxClick = () => {
    onFirmaSpendChange(firmaBalance.toString());
  };

  const firmaSpendNum = parseFloat(firmaSpend) || 0;
  const firmaValueUSD = firmaSpendNum * FIRMA_PRICE_USD;
  const xecReceiveNum = parseFloat(xecReceive) || 0;
  const xecValueUSD = xecReceiveNum * currentXecPrice;

  // Calculate effective Agora price (XEC per Firma)
  const agoraPrice = firmaSpendNum > 0 ? xecReceiveNum / firmaSpendNum : 0;

  return (
    <div className="space-y-4">
      {/* XEC Target Price */}
      <Card className="rounded-xl p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="xec-price" className="text-sm font-medium">
              XEC Target Price
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Set the USD price you want to buy XEC at</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="relative">
            <Input
              id="xec-price"
              type="text"
              inputMode="decimal"
              placeholder="0.000005"
              value={xecPriceUSD}
              onChange={(e) => onXecPriceChange(e.target.value)}
              className="pr-16 text-right font-mono"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $/XEC
            </div>
          </div>
          {currentXecPrice > 0 && (
            <div className="text-xs text-muted-foreground">
              Current: ${currentXecPrice.toFixed(8)}
            </div>
          )}
        </div>
      </Card>

      {/* Spend Firma */}
      <Card className="rounded-xl p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="firma-spend" className="text-sm font-medium">
              Spend (Firma)
            </Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMaxClick}
              disabled={!isWalletConnected || firmaBalance === 0}
              className="h-6 px-2 text-xs"
            >
              MAX
            </Button>
          </div>
          <div className="relative">
            <Input
              id="firma-spend"
              type="text"
              inputMode="decimal"
              placeholder="100"
              value={firmaSpend}
              onChange={(e) => onFirmaSpendChange(e.target.value)}
              disabled={!isWalletConnected}
              className="pr-20 text-right font-mono"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              FIRMA
            </div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Balance: {firmaBalance.toLocaleString()} Firma</span>
            <span>≈ ${(firmaBalance * FIRMA_PRICE_USD).toFixed(2)}</span>
          </div>
          {firmaSpendNum > 0 && (
            <div className="text-xs text-muted-foreground text-right">
              ≈ ${firmaValueUSD.toFixed(2)}
            </div>
          )}
        </div>
      </Card>

      {/* Receive XEC */}
      <Card className="rounded-xl p-4 bg-muted/30">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Receive (XEC)</Label>
          <div className="relative">
            <div className="text-right font-mono text-2xl font-semibold">
              {xecReceiveNum > 0 ? xecReceiveNum.toLocaleString() : '0'}
            </div>
            <div className="text-xs text-muted-foreground text-right mt-1">
              XEC
            </div>
          </div>
          {xecReceiveNum > 0 && (
            <div className="text-xs text-muted-foreground text-right">
              ≈ ${xecValueUSD.toFixed(2)}
            </div>
          )}
        </div>
      </Card>

      {/* Summary */}
      {firmaSpendNum > 0 && xecReceiveNum > 0 && (
        <Card className="rounded-xl p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">XEC Price:</span>
              <span className="font-mono">${xecPriceUSD}/XEC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Firma Price:</span>
              <span className="font-mono">${FIRMA_PRICE_USD}/Firma</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-muted-foreground">Agora Rate:</span>
              <span className="font-mono">{agoraPrice.toLocaleString()} XEC/Firma</span>
            </div>
          </div>
        </Card>
      )}

      {/* Confirm Button */}
      <Button
        className="w-full text-md rounded-xl h-12"
        variant="default"
        onClick={onConfirm}
        disabled={!isWalletConnected || firmaSpendNum === 0 || parseFloat(xecPriceUSD) === 0}
      >
        {isWalletConnected ? "Create Sell Order" : "Connect Wallet"}
      </Button>

      {/* Warning */}
      {isWalletConnected && firmaSpendNum > 0 && (
        <div className="text-xs text-center text-muted-foreground">
          ⚠️ You are creating a SELL order for Firma on Agora
        </div>
      )}
    </div>
  );
}
