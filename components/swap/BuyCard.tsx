"use client";

import type React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TokenSelector } from "@/components/ui/token-selector";

interface BuyCardProps {
  receiveAmount: string;
  setReceiveAmount: React.Dispatch<React.SetStateAction<string>>;
  calculateSpendAmount: (inputAmount: string) => void;
  selectedToken: { id: string; name: string };
  userTokens: any;
  onTokenSelect: (tokenId: string, tokenName: string) => void;
  onTokenMetaChange: (meta: { decimals: number }) => void;
  selectedTokenDecimals: number;
  label?: string;
  showTokenSelector?: boolean;
  showMaxBalance?: boolean;
  readOnly?: boolean;
  showExplorerLink?: boolean;
}

export const BuyCard: React.FC<BuyCardProps> = ({
  receiveAmount,
  setReceiveAmount,
  calculateSpendAmount,
  selectedToken,
  userTokens,
  onTokenSelect,
  onTokenMetaChange,
  selectedTokenDecimals,
  label = "Buy",
  showTokenSelector = true,
  showMaxBalance = false,
  readOnly = false,
  showExplorerLink = true,
}) => {
  const rawAmount = userTokens[selectedToken.id] || "0";
  const maxBalance = Number(rawAmount) / Math.pow(10, selectedTokenDecimals);
  const formattedMaxBalance = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: selectedTokenDecimals,
  }).format(maxBalance);

  const handleMaxClick = () => {
    const maxValue = maxBalance.toFixed(selectedTokenDecimals);
    setReceiveAmount(maxValue);
    calculateSpendAmount(maxValue);
  };

  return (
    <Card className="rounded-3xl py-0 px-0 border-none shadow-none">
      <div className="space-y-2 bg-background p-4 rounded-2xl border mt-2 transition-all hover:bg-muted/50">
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground text-sm">{label}</div>
        </div>
        <div className="flex items-center justify-between">
          <input
            type="text"
            className={`text-lg font-medium bg-transparent outline-none w-3/4 ${readOnly ? "cursor-default text-muted-foreground" : ""}`}
            placeholder="0"
            value={receiveAmount}
            readOnly={readOnly}
            onChange={(e) => {
              if (readOnly) {
                return;
              }

              const value = e.target.value;
              if (value === "" || /^[0-9]*\.?[0-9]*$/.test(value)) {
                setReceiveAmount(value);
                calculateSpendAmount(value);
              }
            }}
            onBlur={(e) => {
              if (readOnly) {
                return;
              }

              const value = e.target.value;
              if (value && !isNaN(Number(value))) {
                const numValue = parseFloat(value);
                const formattedValue = numValue.toFixed(selectedTokenDecimals);
                setReceiveAmount(formattedValue);
                calculateSpendAmount(formattedValue);
              } else if (value && isNaN(Number(value))) {
                setReceiveAmount("");
                calculateSpendAmount("");
              }
            }}
          />
          {showTokenSelector && (
            <TokenSelector
              selectedToken={selectedToken}
              userTokens={userTokens}
              onTokenSelect={onTokenSelect}
              onTokenMetaChange={onTokenMetaChange}
              className="bg-background hover:bg-muted border text-foreground rounded-full px-2 py-2 flex items-center gap-2"
            />
          )}
        </div>
        {showMaxBalance && maxBalance > 0 && (
          <div className="flex items-center mt-2">
            <Button
              variant="outline"
              className="p-2 h-8 mr-2"
              onClick={handleMaxClick}
            >
              Max
            </Button>
            <span className="ml-auto text-sm text-muted-foreground">
              Balance: {formattedMaxBalance}
            </span>
          </div>
        )}

        {showExplorerLink && (
          <div className="text-muted-foreground text-sm text-right">
            {selectedToken.id ? (
              <a
                href={`https://explorer.e.cash/tx/${selectedToken.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors"
              >
                {selectedToken.id.substring(0, 4)}...
                {selectedToken.id.substring(selectedToken.id.length - 4)}
              </a>
            ) : (
              <span>No token selected</span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default BuyCard;
