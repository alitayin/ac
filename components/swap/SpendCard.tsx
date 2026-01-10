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
  toast: (options: any) => void;
}

export const SpendCard: React.FC<SpendCardProps> = ({
  spendAmount,
  setSpendAmount,
  calculateReceiveAmount,
  isWalletConnected,
  balance,
  networkFee,
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
          <Button className="bg-background hover:bg-muted border text-foreground rounded-full text-sm px-2 py-1 flex items-center gap-2">
            <Image src="/ecash.svg" alt="eCash" width={12} height={12} />
            eCash
          </Button>
        </div>
        <div className="text-muted-foreground text-sm">
          <div className="flex items-center mt-2">
            <Button
              variant="outline"
              className="p-2 h-8 mr-2"
              onClick={() => {
                if (isWalletConnected) {
                  const maxBalance = parseFloat(balance);
                  if (maxBalance > networkFee) {
                    setSpendAmount(balance);
                    calculateReceiveAmount(balance);
                  } else {
                    toast({
                      title: "Insufficient balance",
                      description: `You need at least ${networkFee.toFixed(
                        2,
                      )} XEC to cover the estimated network fee`,
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
        </div>
      </div>
    </Card>
  );
};

export default SpendCard;


