"use client";

import type React from "react";
import { Card } from "@/components/ui/card";
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
}) => {
  return (
    <Card className="rounded-3xl py-0 px-0 border-none shadow-none">
      <div className="space-y-2 bg-background p-4 rounded-2xl border mt-2 transition-all hover:bg-muted/50">
        <div className="text-muted-foreground text-sm">Buy</div>
        <div className="flex items-center justify-between">
          <input
            type="text"
            className="text-lg font-medium bg-transparent outline-none w-3/4"
            placeholder="0"
            value={receiveAmount}
            onChange={(e) => {
              const value = e.target.value;
              if (value === "" || /^[0-9]*\.?[0-9]*$/.test(value)) {
                setReceiveAmount(value);
                calculateSpendAmount(value);
              }
            }}
            onBlur={(e) => {
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
          <TokenSelector
            selectedToken={selectedToken}
            userTokens={userTokens}
            onTokenSelect={onTokenSelect}
            onTokenMetaChange={onTokenMetaChange}
            className="bg-background hover:bg-muted border text-foreground rounded-full px-2 py-2 flex items-center gap-2"
          />
        </div>

        <div className="text-muted-foreground text-sm text-right">
          <a
            href={`https://explorer.e.cash/tx/${selectedToken.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            {selectedToken.id.substring(0, 4)}...
            {selectedToken.id.substring(selectedToken.id.length - 4)}
          </a>
        </div>
      </div>
    </Card>
  );
};

export default BuyCard;


