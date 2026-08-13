"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
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
  onOneDollarClick?: () => void;
  showUsdPriceValue: boolean;
  usdPriceText: string;
  onTokenSelect: (tokenId: string, tokenName: string) => void;
  onTokenMetaChange: (meta: { decimals: number }) => void;
  showTokenSelector?: boolean;
  title?: string;
  showPriceInput?: boolean;
  staticPriceLabel?: string;
  staticPriceHint?: string;
  showOneDollarButton?: boolean;
  sweepModeEnabled?: boolean;
  onSweepModeToggle?: () => void;
  disablePriceBasisToggle?: boolean;
  transientHintText?: string;
  transientHintKey?: number;
  transientHintDurationMs?: number;
  showMarketButton?: boolean;
  showSettings?: boolean;
  marketButtonDisabled?: boolean;
  marketButtonLabel?: string;
  onSecondaryMarketClick?: () => void;
  secondaryMarketButtonLabel?: string;
  secondaryMarketButtonDisabled?: boolean;
  inputUnitLabel?: string;
  referencePrices?: Array<{
    label: string;
    value: string;
    title?: string;
  }>;
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
  showTokenSelector = true,
  title,
  showPriceInput = true,
  staticPriceLabel,
  staticPriceHint,
  showOneDollarButton = true,
  sweepModeEnabled = false,
  onSweepModeToggle,
  disablePriceBasisToggle = false,
  transientHintText,
  transientHintKey = 0,
  transientHintDurationMs = 10000,
  showMarketButton = true,
  showSettings = true,
  marketButtonDisabled = false,
  marketButtonLabel = "Market",
  onSecondaryMarketClick,
  secondaryMarketButtonLabel,
  secondaryMarketButtonDisabled = false,
  inputUnitLabel,
  referencePrices = [],
}) => {
  const [typedHintText, setTypedHintText] = useState("");
  const [showTransientHint, setShowTransientHint] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    clearTimers();

    if (showPriceInput || !transientHintText) {
      setShowTransientHint(false);
      setTypedHintText("");
      return () => clearTimers();
    }

    setShowTransientHint(true);
    setTypedHintText("");

    const totalDurationMs = Math.max(1000, transientHintDurationMs);
    const typingDurationMs = Math.min(
      2200,
      Math.max(1200, Math.floor(totalDurationMs * 0.45)),
    );
    const charIntervalMs = Math.max(
      18,
      Math.floor(typingDurationMs / Math.max(transientHintText.length, 1)),
    );

    let visibleLength = 0;
    intervalRef.current = setInterval(() => {
      visibleLength += 1;
      setTypedHintText(transientHintText.slice(0, visibleLength));

      if (visibleLength >= transientHintText.length && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, charIntervalMs);

    timeoutRef.current = setTimeout(() => {
      setShowTransientHint(false);
      setTypedHintText("");
    }, totalDurationMs);

    return () => clearTimers();
  }, [showPriceInput, transientHintDurationMs, transientHintKey, transientHintText]);

  return (
    <Card className="rounded-3xl py-0 px-0 border-none shadow-none">
      <div className="space-y-2 bg-background p-4 rounded-2xl border transition-all hover:bg-muted/50">
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground flex items-center">
          <AuroraText className="text-sm">
            {title || `Set price for 1 ${selectedToken.name}/XEC`}
          </AuroraText>
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
        <div className="flex items-center gap-2">
          {onSweepModeToggle ? (
            <Button
              variant="outline"
              className={`h-8 rounded-full px-3 text-xs ${sweepModeEnabled ? "border-primary bg-primary/10 text-primary hover:bg-primary/15" : ""}`}
              onClick={onSweepModeToggle}
            >
              {sweepModeEnabled ? "Market Buy" : "Limit Buy"}
            </Button>
          ) : null}
          {showSettings ? (
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
                        {disablePriceBasisToggle
                          ? "Sweep mode prices are derived from the live sell order book."
                          : useBestOrderPrice
                          ? "Price is based on the lowest price of a sell order"
                          : "Price is now based on last traded, the button is off now."}
                      </div>
                    </div>
                    <Switch
                      checked={useBestOrderPrice}
                      onCheckedChange={setUseBestOrderPrice}
                      disabled={disablePriceBasisToggle}
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
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 my-2">
        <div className="min-w-0 flex-1">
          {showPriceInput ? (
            <span className="font-medium text-lg">
              <input
                type="text"
                aria-label={title || `Set price for 1 ${selectedToken.name}/XEC`}
                className="font-medium bg-transparent outline-none w-full text-lg"
                placeholder="0.00"
                value={tokenPriceInput}
                onChange={(e) => onTokenPriceInputChange(e.target.value)}
                onBlur={onTokenPriceBlur}
              />
            </span>
          ) : showTransientHint ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.18em] text-primary/70">
                Live sweep quote
              </div>
              <div className="mt-1 min-h-[2.75rem] font-mono text-xs leading-6 text-foreground/90 sm:text-sm">
                {typedHintText}
                <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-primary align-middle" />
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="font-medium text-lg">{staticPriceLabel || "Sweep current asks"}</div>
              {staticPriceHint ? (
                <div className="text-xs text-muted-foreground">{staticPriceHint}</div>
              ) : null}
            </div>
          )}
        </div>
        {showTokenSelector && (
          <TokenSelector
            selectedToken={selectedToken}
            userTokens={userTokens}
            onTokenSelect={onTokenSelect}
            onTokenMetaChange={onTokenMetaChange}
            className="px-2"
          />
        )}
        {!showTokenSelector && inputUnitLabel ? (
          <div className="shrink-0 text-sm font-medium text-foreground/80">
            {inputUnitLabel}
          </div>
        ) : null}
      </div>

      {(showMarketButton || showUsdPriceValue || referencePrices.length > 0) && (
      <div className={referencePrices.length > 0
        ? "flex mt-4 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
        : "flex mt-4 items-center justify-between gap-3"}
      >
        <div className="flex shrink-0 flex-wrap gap-2">
          {showMarketButton && (
            <Button
              variant="outline"
              className="p-2 h-8 text-sm"
              onClick={onMarketClick}
              disabled={marketButtonDisabled}
            >
              {marketButtonLabel}
            </Button>
          )}
          {onSecondaryMarketClick && secondaryMarketButtonLabel ? (
            <Button
              variant="outline"
              className="p-2 h-8 text-sm"
              onClick={onSecondaryMarketClick}
              disabled={secondaryMarketButtonDisabled}
            >
              {secondaryMarketButtonLabel}
            </Button>
          ) : null}
          {!onSweepModeToggle && showOneDollarButton && onOneDollarClick ? (
            <Button
              variant="outline"
              className="p-2 h-8 text-sm"
              onClick={onOneDollarClick}
            >
              1.00 $
            </Button>
          ) : null}
        </div>
        {referencePrices.length > 0 ? (
          <div className="min-w-0 space-y-1 text-left text-xs text-muted-foreground sm:text-right sm:text-sm">
            {referencePrices.map((reference) => (
              <div
                key={reference.label}
                className="break-words"
                title={reference.title}
              >
                <span>{reference.label}</span>{" "}
                <span className="font-mono tabular-nums text-foreground/80">
                  {reference.value}
                </span>
              </div>
            ))}
          </div>
        ) : showUsdPriceValue ? (
          <div className="text-sm text-muted-foreground">
            ${usdPriceText}
          </div>
        ) : null}
      </div>
      )}
      </div>
    </Card>
  );
};

export default PriceCard;
