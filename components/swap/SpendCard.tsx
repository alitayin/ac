"use client";

import type React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from "next/image";

interface SpendCardProps {
  spendAmount: string;
  setSpendAmount: React.Dispatch<React.SetStateAction<string>>;
  calculateReceiveAmount: (inputAmount: string) => void;
  isWalletConnected: boolean;
  balance: string;
  networkFee: number;
  swapFee: number;
  swapFeeCredit?: number;
  serviceCreditLabel?: string;
  serviceCreditEnabled?: boolean;
  setServiceCreditEnabled?: (enabled: boolean) => void;
  serviceCreditAvailable?: boolean;
  serviceCreditOverpay?: number;
  totalFees: number;
  minimumTotalFees: number;
  toast: (options: any) => void;
}

export const SpendCard: React.FC<SpendCardProps> = ({
  spendAmount,
  setSpendAmount,
  calculateReceiveAmount,
  isWalletConnected,
  balance,
  swapFee,
  swapFeeCredit = 0,
  serviceCreditLabel = "SS/SC credit",
  serviceCreditEnabled = false,
  setServiceCreditEnabled,
  serviceCreditAvailable = false,
  serviceCreditOverpay = 0,
  totalFees,
  minimumTotalFees,
  toast,
}) => {
  return (
    <Card className="rounded-3xl py-0 px-0 border-none shadow-none">
      <div className="space-y-2 bg-background p-4 rounded-2xl border mt-2 transition-all hover:bg-muted/50">
        <div className="text-muted-foreground text-sm">Spend</div>
        <div className="flex items-center justify-between">
          <input
            type="text"
            className="text-lg font-medium bg-transparent outline-none w-3/4"
            placeholder="0"
            value={spendAmount}
            onChange={(e) => {
              const value = e.target.value;
              if (value === "" || /^[0-9]*\.?[0-9]*$/.test(value)) {
                setSpendAmount(value);
                calculateReceiveAmount(value);
              }
            }}
            onBlur={(e) => {
              const value = e.target.value;
              if (value && !isNaN(Number(value))) {
                const hasDecimal = value.includes(".");
                if (hasDecimal) {
                  const parts = value.split(".");
                  const decimalPart = parts[1] || "";
                  if (decimalPart === "" || decimalPart.endsWith("0")) {
                    setSpendAmount(value);
                  } else {
                    setSpendAmount(parseFloat(value).toFixed(2));
                  }
                } else {
                  setSpendAmount(value);
                }
                calculateReceiveAmount(value);
              } else if (value && isNaN(Number(value))) {
                setSpendAmount("");
                calculateReceiveAmount("");
              }
            }}
          />
          <div className="flex items-center gap-2 text-sm font-medium text-foreground/80 select-none">
            <Image src="/ecash.svg" alt="eCash" width={14} height={14} />
            <span>ecash</span>
          </div>
        </div>
        <div className="text-muted-foreground text-sm">
          <div className="flex items-center mt-2">
            <Button
              variant="outline"
              className="p-2 h-8 mr-2"
              onClick={() => {
                if (isWalletConnected) {
                  const maxBalance = parseFloat(balance);
                  if (maxBalance > minimumTotalFees) {
                    setSpendAmount(balance);
                    calculateReceiveAmount(balance);
                  } else {
                    toast({
                      title: "Insufficient balance",
                      description: `You need at least ${minimumTotalFees.toFixed(
                        2,
                      )} XEC to cover the estimated swap and network fees`,
                      variant: "destructive",
                    });
                  }
                }
              }}
              disabled={!isWalletConnected}
            >
              Max
            </Button>
            <span className="ml-auto text-sm">
              Balance: {isWalletConnected ? `${balance} XEC` : "0 XEC"}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Estimated fees</span>
            <span>{totalFees.toFixed(2)} XEC</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Swap fee</span>
            <span>{swapFee.toFixed(2)} XEC</span>
          </div>
          {serviceCreditAvailable ? (
            <div className="mt-2 rounded-lg border bg-muted/30 p-2 text-xs">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span className="text-foreground">{serviceCreditLabel}</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={serviceCreditEnabled}
                  onChange={(event) =>
                    setServiceCreditEnabled?.(event.target.checked)
                  }
                />
              </label>
              {serviceCreditEnabled ? (
                <div className="mt-1 flex items-center justify-between text-muted-foreground">
                  <span>Applied</span>
                  <span>-{swapFeeCredit.toFixed(2)} XEC</span>
                </div>
              ) : null}
              {serviceCreditEnabled && serviceCreditOverpay > 0 ? (
                <div className="mt-1 text-muted-foreground">
                  This redemption overpays by {serviceCreditOverpay.toFixed(2)} XEC.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
};

export default SpendCard;
