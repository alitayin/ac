"use client";

import type React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TokenSelector } from "@/components/ui/token-selector";
import Image from "next/image";

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
  staticTokenLabel?: string;
  staticTokenIconSrc?: string;
  balanceUsd?: number | null;
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
  staticTokenLabel,
  staticTokenIconSrc,
  balanceUsd,
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
        <div className="flex items-center justify-between gap-3">
          <input
            type="text"
            aria-label={`${label} amount`}
            className={`min-w-0 flex-1 text-lg font-medium bg-transparent outline-none ${readOnly ? "cursor-default text-muted-foreground" : ""}`}
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
          {!showTokenSelector && staticTokenLabel ? (
            <div className="flex shrink-0 items-center gap-2 text-sm font-medium text-foreground/80 select-none">
              {staticTokenIconSrc ? (
                <Image
                  src={staticTokenIconSrc}
                  alt=""
                  width={16}
                  height={16}
                />
              ) : null}
              <span>{staticTokenLabel}</span>
            </div>
          ) : null}
        </div>
        {showMaxBalance && (
          <div className="flex items-center mt-2">
            <Button
              variant="outline"
              className="p-2 h-8 mr-2"
              onClick={handleMaxClick}
              disabled={maxBalance <= 0}
            >
              Max
            </Button>
            <span className="ml-auto text-sm text-muted-foreground">
              Balance: {formattedMaxBalance}
              {typeof balanceUsd === "number" && Number.isFinite(balanceUsd) && balanceUsd >= 0 ? (
                <span className="ml-1 text-xs text-muted-foreground/80">
                  ({balanceUsd.toFixed(3)}$)
                </span>
              ) : null}
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
