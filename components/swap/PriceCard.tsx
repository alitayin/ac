"use client";

import type React from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { AuroraText } from "@/components/magicui/aurora-text";
import { Settings } from "lucide-react";
import { TokenSelector } from "@/components/ui/token-selector";

interface PriceCardProps {
  selectedToken: { id: string; name: string };
  userTokens: any;
  tokenPriceInput: string;
  onTokenPriceInputChange: (value: string) => void;
  onTokenPriceBlur: () => void;
  useBestOrderPrice: boolean;
  setUseBestOrderPrice: (value: boolean) => void;
  showUsdPrice: boolean;
  setShowUsdPrice: (value: boolean) => void;
  onMarketClick: () => void;
  onOneDollarClick: () => void;
  showUsdPriceValue: boolean;
  usdPriceText: string;
  onTokenSelect: (tokenId: string, tokenName: string) => void;
  onTokenMetaChange: (meta: { decimals: number }) => void;
}

export const PriceCard: React.FC<PriceCardProps> = ({
  selectedToken,
  userTokens,
  tokenPriceInput,
  onTokenPriceInputChange,
  onTokenPriceBlur,
  useBestOrderPrice,
  setUseBestOrderPrice,
  showUsdPrice,
  setShowUsdPrice,
  onMarketClick,
  onOneDollarClick,
  showUsdPriceValue,
  usdPriceText,
  onTokenSelect,
  onTokenMetaChange,
}) => {
  return (
    <Card className="rounded-3xl p-4 bg-background border shadow-none transition-all hover:bg-muted/50">
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground flex items-center">
          <AuroraText className="text-sm">Set price for 1 {selectedToken.name}/XEC</AuroraText>
          <div className="flex -space-x-2 ml-2">
            <Avatar className="h-4 w-4 ring-2 ring-background">
              <AvatarImage src="/ecash.svg" alt="XEC" />
              <AvatarFallback>XEC</AvatarFallback>
            </Avatar>
            <Avatar className="h-4 w-4 ring-2 ring-background">
              <AvatarImage
                src={`https://icons.etokens.cash/32/${selectedToken.id}.png`}
                alt={selectedToken.name}
              />
              <AvatarFallback>{selectedToken.name.substring(0, 2)}</AvatarFallback>
            </Avatar>
          </div>
        </div>
        <div className="flex items-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings size={16} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Price basis</h4>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-sm text-muted-foreground">
                        {useBestOrderPrice
                          ? "Price is based on the lowest price of a sell order"
                          : "Price is now based on last traded, the button is off now."}
                      </div>
                    </div>
                    <Switch
                      checked={useBestOrderPrice}
                      onCheckedChange={setUseBestOrderPrice}
                      className="dark:data-[state=checked]:bg-pink-400 data-[state=checked]:bg-pink-500 h-6"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Show USD price</h4>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-sm text-muted-foreground">
                        Display USD as reference
                      </div>
                    </div>
                    <Switch
                      checked={showUsdPrice}
                      onCheckedChange={setShowUsdPrice}
                      className="dark:data-[state=checked]:bg-pink-400 data-[state=checked]:bg-pink-500 h-6"
                    />
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex items-center justify-between my-2">
        <span className="font-medium text-lg">
          <input
            type="text"
            className="font-medium bg-transparent outline-none w-full text-lg"
            placeholder="0.00"
            value={tokenPriceInput}
            onChange={(e) => onTokenPriceInputChange(e.target.value)}
            onBlur={onTokenPriceBlur}
          />
        </span>
        <TokenSelector
          selectedToken={selectedToken}
          userTokens={userTokens}
          onTokenSelect={onTokenSelect}
          onTokenMetaChange={onTokenMetaChange}
          className="px-2"
        />
      </div>

      <div className="flex mt-4 justify-between items-center">
        <div className="flex space-x-2">
          <Button
            variant="outline"
            className="p-2 h-8 text-sm"
            onClick={onMarketClick}
          >
            Market
          </Button>
          <Button
            variant="outline"
            className="p-2 h-8 text-sm"
            onClick={onOneDollarClick}
          >
            1.00 $
          </Button>
        </div>
        {showUsdPriceValue && (
          <div className="text-sm text-muted-foreground">
            ${usdPriceText}
          </div>
        )}
      </div>
    </Card>
  );
};

export default PriceCard;


