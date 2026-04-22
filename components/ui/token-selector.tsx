import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MousePointerClick, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { fetchTokenDetails, getTokenDecimalsFromDetails } from "@/lib/chronik";

type TokenDetailsMap = Record<string, any>;
type DisplayToken = {
  tokenId: string;
  tokenName: string;
  formattedAmount: string;
  rawAmount: string;
};

interface TokenSelectorProps {
  selectedToken: {
    id: string;
    name: string;
  };
  userTokens: {[key: string]: string};
  onTokenSelect: (tokenId: string, tokenName: string) => void;
  onTokenMetaChange?: (meta: {
    tokenId: string;
    decimals: number;
    detail?: any;
  }) => void;
  className?: string;
}

function shortenTokenId(tokenId: string): string {
  return `${tokenId.slice(0, 6)}...${tokenId.slice(-4)}`
}

function getTokenName(detail: any, tokenId: string): string {
  const tokenName = detail?.genesisInfo?.tokenName?.trim()
  if (tokenName) {
    return tokenName
  }

  const tokenTicker = detail?.genesisInfo?.tokenTicker?.trim()
  if (tokenTicker) {
    return tokenTicker
  }

  return shortenTokenId(tokenId)
}

function parseRawAmount(rawAmount: string): bigint {
  try {
    return BigInt(rawAmount)
  } catch {
    return BigInt(0)
  }
}

export function TokenSelector({
  selectedToken,
  userTokens,
  onTokenSelect,
  onTokenMetaChange,
  className = "",
}: TokenSelectorProps) {
  const [open, setOpen] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [tokenDetails, setTokenDetails] = useState<TokenDetailsMap>({});
  const tokenDetailsRef = useRef<TokenDetailsMap>({});
  const loadRequestIdRef = useRef(0);
  const userTokenIds = useMemo(() => Object.keys(userTokens), [userTokens]);
  
  useEffect(() => {
    if (userTokenIds.length === 0) return;
    
    const loadCachedDetails = () => {
      try {
        const cacheStr = localStorage.getItem('token_details_cache');
        if (!cacheStr) return;
        
        const cache = JSON.parse(cacheStr);
        const cachedDetails: TokenDetailsMap = {};
        userTokenIds.forEach(tokenId => {
          if (cache[tokenId]) {
            cachedDetails[tokenId] = cache[tokenId];
          }
        });
        
        if (Object.keys(cachedDetails).length > 0) {
          tokenDetailsRef.current = {
            ...tokenDetailsRef.current,
            ...cachedDetails,
          };
          setTokenDetails(prev => {
            const next = { ...prev };
            let hasChanges = false;

            Object.entries(cachedDetails).forEach(([tokenId, detail]) => {
              if (next[tokenId] !== detail) {
                next[tokenId] = detail;
                hasChanges = true;
              }
            });

            return hasChanges ? next : prev;
          });
        }
      } catch (error) {
      }
    };
    
    loadCachedDetails();
  }, [userTokenIds]);
  
  useEffect(() => {
    let cancelled = false;
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    const run = async () => {
      const tokensToLoad = userTokenIds.filter(tokenId => !tokenDetailsRef.current[tokenId]);
      if (tokensToLoad.length === 0) return;

      const results = await Promise.allSettled(
        tokensToLoad.map(async (tokenId) => {
          const detail = await fetchTokenDetails(tokenId);
          return { tokenId, detail };
        })
      );

      if (cancelled || loadRequestIdRef.current !== requestId) {
        return;
      }

      const loadedDetails: TokenDetailsMap = {};
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.detail) {
          loadedDetails[result.value.tokenId] = result.value.detail;
        }
      });

      if (Object.keys(loadedDetails).length === 0) {
        return;
      }

      tokenDetailsRef.current = {
        ...tokenDetailsRef.current,
        ...loadedDetails,
      };

      setTokenDetails(prev => ({
        ...prev,
        ...loadedDetails,
      }));
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [userTokenIds]);

  const selectedTokenDetail = selectedToken?.id ? tokenDetails[selectedToken.id] : undefined;

  useEffect(() => {
    if (!onTokenMetaChange || !selectedToken?.id) return;

    const decimals = getTokenDecimalsFromDetails(
      selectedTokenDetail,
      0,
    );

    onTokenMetaChange({
      tokenId: selectedToken.id,
      decimals,
      detail: selectedTokenDetail,
    });
  }, [selectedToken.id, selectedTokenDetail, onTokenMetaChange]);

  const displayTokens = useMemo<DisplayToken[]>(() => {
    return userTokenIds
      .filter((tokenId) => {
        const rawAmount = userTokens[tokenId] || "0";
        return rawAmount !== "0";
      })
      .map((tokenId) => {
        const rawAmount = userTokens[tokenId] || "0";
        const detail = tokenDetails[tokenId];
        const decimals = getTokenDecimalsFromDetails(detail, 0);
        const actualAmount = Number(rawAmount) / Math.pow(10, decimals || 0);
        const formattedAmount = new Intl.NumberFormat('en-US', {
          maximumFractionDigits: decimals,
        }).format(actualAmount);

        return {
          tokenId,
          tokenName: getTokenName(detail, tokenId),
          formattedAmount,
          rawAmount,
        };
      })
      .sort((a, b) => {
        const amountA = parseRawAmount(a.rawAmount)
        const amountB = parseRawAmount(b.rawAmount)

        if (amountA !== amountB) {
          return amountA > amountB ? -1 : 1
        }
        return a.tokenName.localeCompare(b.tokenName);
      });
  }, [tokenDetails, userTokenIds, userTokens]);

  const hasWalletTokens = displayTokens.length > 0;
  
  useEffect(() => {
    if (open && displayTokens.length > 2) {
      setShowScrollHint(true);
      
      const timer = setTimeout(() => {
        setShowScrollHint(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [displayTokens.length, open]);
  
  const handleTokenSelect = (tokenId: string, tokenName: string) => {
    onTokenSelect(tokenId, tokenName);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          className={`bg-background text-sm hover:bg-muted border text-foreground rounded-full px-2 py-1 flex items-center gap-2 ${className}`}
          disabled={!hasWalletTokens}
        >
          <Avatar className="h-4 w-4">
            {selectedToken.id ? (
              <AvatarImage 
                src={`https://icons.etokens.cash/32/${selectedToken.id}.png`} 
                alt={selectedToken.name} 
              />
            ) : null}
            <AvatarFallback>{(selectedToken.name || "TK").substring(0, 2)}</AvatarFallback>
          </Avatar>
          {selectedToken.name || (hasWalletTokens ? "Select token" : "No tokens")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 flex flex-col">
        <div className="space-y-4 flex-1">
          <h4 className="font-medium flex items-center gap-2">
            <MousePointerClick className="w-4 h-4" />
            Select a token
          </h4>
          
          <div className="space-y-2 relative">
            <div className="text-sm text-muted-foreground">Wallet tokens</div>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {displayTokens.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No wallet tokens
                </div>
              ) : (
                displayTokens.map(({ tokenId, tokenName, formattedAmount }) => (
                  <Button
                    key={tokenId}
                    variant="ghost"
                    className="w-full justify-start gap-2 px-2 py-1.5 h-auto"
                    onClick={() => handleTokenSelect(tokenId, tokenName)}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={`https://icons.etokens.cash/32/${tokenId}.png`}
                        alt={tokenName}
                      />
                      <AvatarFallback>{tokenName.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-medium">{tokenName}</span>
                      <span className="text-sm text-muted-foreground">
                        Balance: {formattedAmount}
                      </span>
                    </div>
                  </Button>
                ))
              )}
            </div>
            {showScrollHint && displayTokens.length > 2 && (
              <div 
                className="absolute bottom-[-12px] left-1/2 transform -translate-x-1/2 transition-opacity duration-500"
                style={{ opacity: showScrollHint ? 1 : 0 }}
              >
                <ChevronDown className="w-5 h-5 text-muted-foreground animate-bounce" />
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
