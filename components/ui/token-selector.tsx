import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TOKENS } from '@/config/tokenconfig';
import { MousePointerClick, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { fetchTokenDetails, getTokenDecimalsFromDetails } from "@/lib/chronik";
import Link from "next/link";

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

export function TokenSelector({ 
  selectedToken, 
  userTokens, 
  onTokenSelect,
  onTokenMetaChange,
  className = "" 
}: TokenSelectorProps) {
  const [open, setOpen] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [tokenDetails, setTokenDetails] = useState<{ [key: string]: any }>({});
  const tokenDetailsRef = useRef<{ [key: string]: any }>({});
  
  const PRIORITY_TOKEN_ID = 'fb4233e8a568993976ed38a81c2671587c5ad09552dedefa78760deed6ff87aa';
  
  useEffect(() => {
    const ids = Object.keys(userTokens);
    if (ids.length === 0) return;
    
    const loadCachedDetails = () => {
      try {
        const cacheStr = localStorage.getItem('token_details_cache');
        if (!cacheStr) return;
        
        const cache = JSON.parse(cacheStr);
        const cachedDetails: {[key: string]: any} = {};
        ids.forEach(tokenId => {
          if (cache[tokenId]) {
            cachedDetails[tokenId] = cache[tokenId];
          }
        });
        
        if (Object.keys(cachedDetails).length > 0) {
          setTokenDetails(cachedDetails);
        }
      } catch (error) {
      }
    };
    
    loadCachedDetails();
  }, [userTokens]);
  
  useEffect(() => {
    tokenDetailsRef.current = tokenDetails;
  }, [tokenDetails]);
  
  useEffect(() => {
    const loadTokenDetails = async () => {
      const ids = Object.keys(userTokens);
      if (ids.length === 0) return;

      for (const tokenId of ids) {
        if (tokenDetailsRef.current[tokenId]) continue;
        try {
          const detail = await fetchTokenDetails(tokenId);
          if (detail) {
            setTokenDetails(prev => ({
              ...prev,
              [tokenId]: detail,
            }));
          }
        } catch (error) {
        }
      }
    };

    loadTokenDetails();
  }, [userTokens]);

  useEffect(() => {
    if (!onTokenMetaChange || !selectedToken?.id) return;

    const detail = tokenDetails[selectedToken.id];
    const decimals = getTokenDecimalsFromDetails(
      detail,
      0,
    );

    onTokenMetaChange({
      tokenId: selectedToken.id,
      decimals,
      detail,
    });
  }, [selectedToken.id, tokenDetails, onTokenMetaChange]);

  useEffect(() => {
    if (open && Object.keys(userTokens).length > 2) {
      setShowScrollHint(true);
      
      const timer = setTimeout(() => {
        setShowScrollHint(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [open, userTokens]);
  
  const handleTokenSelect = (tokenId: string, tokenName: string) => {
    onTokenSelect(tokenId, tokenName);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          className={`bg-background text-sm hover:bg-muted border text-foreground rounded-full px-2 py-1 flex items-center gap-2 ${className}`}
        >
          <Avatar className="h-4 w-4">
            <AvatarImage 
              src={`https://icons.etokens.cash/32/${selectedToken.id}.png`} 
              alt={selectedToken.name} 
            />
            <AvatarFallback>{selectedToken.name.substring(0, 2)}</AvatarFallback>
          </Avatar>
          {selectedToken.name}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 flex flex-col">
        <div className="space-y-4 flex-1">
          <h4 className="font-medium flex items-center gap-2">
            <MousePointerClick className="w-4 h-4" />
            Select a token
          </h4>
          
          <div className="space-y-2 relative">
            <div className="text-sm text-muted-foreground">Listed etokens</div>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {Object.entries(TOKENS)
                .map(([tokenId, token]) => {
                  const rawAmount = userTokens[tokenId] || "0";
                  const hasBalance = rawAmount !== "0";

                  const detail = tokenDetails[tokenId];
                  const decimals = getTokenDecimalsFromDetails(detail, 0);
                  const actualAmount = Number(rawAmount) / Math.pow(10, decimals);
                  const formattedAmount = new Intl.NumberFormat('en-US', {
                    maximumFractionDigits: decimals,
                  }).format(actualAmount);

                  return {
                    tokenId,
                    token,
                    hasBalance,
                    formattedAmount,
                  };
                })
                .sort((a, b) => {
                  if (a.hasBalance !== b.hasBalance) {
                    return a.hasBalance ? -1 : 1;
                  }
                  if (a.tokenId === PRIORITY_TOKEN_ID && b.tokenId !== PRIORITY_TOKEN_ID) return -1;
                  if (b.tokenId === PRIORITY_TOKEN_ID && a.tokenId !== PRIORITY_TOKEN_ID) return 1;
                  return a.token.name.localeCompare(b.token.name);
                })
                .map(({ tokenId, token, hasBalance, formattedAmount }) => (
                  <Button
                    key={tokenId}
                    variant="ghost"
                    className="w-full justify-start gap-2 px-2 py-1.5 h-auto"
                    onClick={() => handleTokenSelect(tokenId, token.name)}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage 
                        src={`https://icons.etokens.cash/32/${tokenId}.png`}
                        alt={token.name}
                      />
                      <AvatarFallback>{token.name.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-medium">{token.name}</span>
                      <span className="text-sm text-muted-foreground">
                        Balance: {hasBalance ? formattedAmount : "0"}
                      </span>
                    </div>
                  </Button>
                ))}
            </div>
            {showScrollHint && Object.keys(userTokens).length > 2 && (
              <div 
                className="absolute bottom-[-12px] left-1/2 transform -translate-x-1/2 transition-opacity duration-500"
                style={{ opacity: showScrollHint ? 1 : 0 }}
              >
                <ChevronDown className="w-5 h-5 text-muted-foreground animate-bounce" />
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 pt-4 border-t">
          <Link href="/list" className="block">
            <div className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-center">
              Pay 1M SS to list your token and enable buy functionality!
            </div>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}