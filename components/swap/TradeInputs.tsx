"use client";

import type React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { ArrowDownUp } from "lucide-react";
import { TokenSelector } from "@/components/ui/token-selector";

interface TradeInputsProps {
  spendAmount: string;
  receiveAmount: string;
  onSpendChange: (value: string) => void;
  onSpendBlur: (value: string) => void;
  onReceiveChange: (value: string) => void;
  onReceiveBlur: (value: string) => void;
  onMaxClick: () => void;
  isWalletConnected: boolean;
  balanceText: string;
  selectedToken: { id: string; name: string };
  userTokens: { [key: string]: string };
  onTokenSelect: (tokenId: string, tokenName: string) => void;
  onTokenMetaChange: (meta: { decimals: number }) => void;
}

export const TradeInputs: React.FC<TradeInputsProps> = ({
  spendAmount,
  receiveAmount,
  onSpendChange,
  onSpendBlur,
  onReceiveChange,
  onReceiveBlur,
  onMaxClick,
  isWalletConnected,
  balanceText,
  selectedToken,
  userTokens,
  onTokenSelect,
  onTokenMetaChange,
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
            onChange={(e) => onSpendChange(e.target.value)}
            onBlur={(e) => onSpendBlur(e.target.value)}
          />
          <Button className="bg-background hover:bg-muted border text-foreground rounded-full px-2 py-2 flex items-center gap-2">
            <Image
              src="/ecash.svg"
              alt="eCash"
              width={20}
              height={20}
            />
            eCash
          </Button>
        </div>
        <div className="text-muted-foreground text-sm">
          <div className="flex items-center mt-2">
            <Button
              variant="outline"
              className="p-2 h-8 mr-2"
              onClick={onMaxClick}
              disabled={!isWalletConnected}
            >
              Max
            </Button>
            <span className="ml-auto">
              Balance: {balanceText}
            </span>
          </div>
        </div>
      </div>

      <div className="relative h-0">
        <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-full p-2 shadow-md z-10 dark:border">
          <ArrowDownUp size={20} />
        </div>
      </div>

      <div className="space-y-2 bg-background p-4 rounded-2xl border mt-2 transition-all hover:bg-muted/50">
        <div className="text-muted-foreground text-sm">Buy</div>
        <div className="flex items-center justify-between">
          <input
            type="text"
            className="text-lg font-medium bg-transparent outline-none w-3/4"
            placeholder="0"
            value={receiveAmount}
            onChange={(e) => onReceiveChange(e.target.value)}
            onBlur={(e) => onReceiveBlur(e.target.value)}
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

export default TradeInputs;


