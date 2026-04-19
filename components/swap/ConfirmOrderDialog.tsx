"use client";

import type React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowDown, PackageCheck, X } from "lucide-react";
import Image from "next/image";

interface ConfirmOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isOfflineOrder: boolean;
  selectedToken: { id: string; name: string };
  receiveAmount: string;
  spendAmount: string;
  tokenPrice: number;
  networkFee: number;
  swapFee: number;
  totalFees: number;
  tokenCost: number;
  feeDescription: string;
  formatTokenPrice: (price: number) => string;
  onClose: () => void;
  onConfirm: () => void;
}

interface BreakdownRowProps {
  label: string;
  value: string;
  emphasized?: boolean;
}

function formatDisplayNumber(
  value: number | string,
  options: Intl.NumberFormatOptions = {},
): string {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  return numericValue.toLocaleString("en-US", options);
}

function BreakdownRow({
  label,
  value,
  emphasized = false,
}: BreakdownRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-baseline gap-1 text-right">
        <span className={`tabular-nums ${emphasized ? "text-base font-semibold" : "font-medium"}`}>
          {value}
        </span>
        <span className="text-xs uppercase text-muted-foreground">XEC</span>
      </div>
    </div>
  );
}

export const ConfirmOrderDialog: React.FC<ConfirmOrderDialogProps> = ({
  open,
  onOpenChange,
  isOfflineOrder,
  selectedToken,
  receiveAmount,
  spendAmount,
  tokenPrice,
  networkFee,
  swapFee,
  totalFees,
  tokenCost,
  feeDescription,
  formatTokenPrice,
  onClose,
  onConfirm,
}) => {
  const custodyLabel = isOfflineOrder ? "Custodial" : "Self-Custody";
  const totalXec =
    receiveAmount && tokenPrice
      ? tokenCost + totalFees
      : Number(spendAmount || 0);

  const formattedTotalXec = formatDisplayNumber(totalXec, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formattedReceiveAmount = formatDisplayNumber(receiveAmount, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  });
  const formattedTokenCost = formatDisplayNumber(tokenCost, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formattedSwapFee = formatDisplayNumber(swapFee, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formattedNetworkFee = formatDisplayNumber(networkFee, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formattedTotalFees = formatDisplayNumber(totalFees, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="gap-3 p-5 sm:max-w-xl">
        <AlertDialogHeader className="gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-full border bg-muted">
                <PackageCheck className="size-5" />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <AlertDialogTitle>Confirm Order</AlertDialogTitle>
                  <Badge variant={isOfflineOrder ? "outline" : "secondary"}>
                    {custodyLabel}
                  </Badge>
                </div>
                <AlertDialogDescription>
                  Check the key numbers before submitting.
                </AlertDialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              onClick={onClose}
              aria-label="Close confirm order dialog"
            >
              <X />
            </Button>
          </div>
        </AlertDialogHeader>

        <div className="flex flex-col gap-3">
          <Card className="border-primary/20 bg-primary/5 shadow-none">
            <CardContent className="p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div className="flex items-center gap-3 rounded-lg border bg-background/80 p-3">
                  <Image src="/ecash.svg" alt="eCash" width={18} height={18} />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      Spend up to
                    </span>
                    <span className="truncate text-sm font-semibold tabular-nums">
                      {formattedTotalXec} XEC
                    </span>
                  </div>
                </div>

                <div className="hidden justify-center sm:flex">
                  <div className="flex size-8 items-center justify-center rounded-full border bg-background/80">
                    <ArrowDown className="size-4" />
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg border bg-background/80 p-3">
                  <Avatar className="size-7">
                    <AvatarImage
                      src={`https://icons.etokens.cash/32/${selectedToken.id}.png`}
                      alt={selectedToken.name}
                    />
                    <AvatarFallback>
                      {selectedToken.name.substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      Receive up to
                    </span>
                    <span className="truncate text-sm font-semibold">
                      {formattedReceiveAmount} {selectedToken.name}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardContent className="flex flex-col gap-2.5 p-4">
              <BreakdownRow label="Order value" value={formattedTokenCost} />
              <BreakdownRow label="Price per token" value={formatTokenPrice(tokenPrice)} />
              <BreakdownRow label={feeDescription} value={formattedSwapFee} />
              <BreakdownRow label="Network fee" value={formattedNetworkFee} />
              <div className="rounded-lg bg-muted/60 p-2.5">
                <BreakdownRow label="Total fees" value={formattedTotalFees} />
                <div className="mt-2 border-t border-border/60 pt-2">
                  <BreakdownRow label="Max spend" value={formattedTotalXec} emphasized />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <AlertDialogFooter className="sm:justify-center">
          <AlertDialogAction onClick={onConfirm} className="h-11 w-full text-sm">
            Confirm Order
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmOrderDialog;
