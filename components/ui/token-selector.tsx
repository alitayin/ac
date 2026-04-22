import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { MousePointerClick, ChevronDown, Search } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  fetchTokenDetails,
  getCachedTokenDetails,
  getTokenDecimalsFromDetails,
} from "@/lib/chronik";

type TokenDetailsMap = Record<string, any>;
type SearchLookupState =
  | { status: "idle"; tokenId: "" }
  | { status: "loading"; tokenId: string }
  | { status: "found"; tokenId: string }
  | { status: "not-found"; tokenId: string };

type DisplayToken = {
  tokenId: string;
  tokenName: string;
  tokenTicker: string;
  formattedAmount: string;
  rawAmount: string;
};

interface TokenSelectorProps {
  selectedToken: {
    id: string;
    name: string;
  };
  userTokens: { [key: string]: string };
  onTokenSelect: (tokenId: string, tokenName: string) => void;
  onTokenMetaChange?: (meta: {
    tokenId: string;
    decimals: number;
    detail?: any;
  }) => void;
  className?: string;
}

function shortenTokenId(tokenId: string): string {
  return `${tokenId.slice(0, 6)}...${tokenId.slice(-4)}`;
}

function getTokenName(detail: any, tokenId: string): string {
  const tokenName = detail?.genesisInfo?.tokenName?.trim();
  if (tokenName) {
    return tokenName;
  }

  const tokenTicker = detail?.genesisInfo?.tokenTicker?.trim();
  if (tokenTicker) {
    return tokenTicker;
  }

  return shortenTokenId(tokenId);
}

function parseRawAmount(rawAmount: string): bigint {
  try {
    return BigInt(rawAmount);
  } catch {
    return BigInt(0);
  }
}

function isValidTokenId(tokenId: string): boolean {
  return /^[a-fA-F0-9]{64}$/.test(tokenId);
}

export function TokenSelector({
  selectedToken,
  userTokens,
  onTokenSelect,
  onTokenMetaChange,
  className = "",
}: TokenSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLookup, setSearchLookup] = useState<SearchLookupState>({
    status: "idle",
    tokenId: "",
  });
  const [searchedTokenDetail, setSearchedTokenDetail] = useState<any | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [tokenDetails, setTokenDetails] = useState<TokenDetailsMap>({});
  const tokenDetailsRef = useRef<TokenDetailsMap>({});
  const loadRequestIdRef = useRef(0);
  const userTokenIds = useMemo(() => Object.keys(userTokens), [userTokens]);
  const walletTokenIdsWithBalance = useMemo(
    () =>
      userTokenIds.filter((tokenId) => {
        const rawAmount = userTokens[tokenId] || "0";
        return rawAmount !== "0";
      }),
    [userTokenIds, userTokens],
  );
  const trimmedSearchQuery = searchQuery.trim();
  const normalizedSearchQuery = trimmedSearchQuery.toLowerCase();
  const exactOwnedTokenId = useMemo(
    () =>
      walletTokenIdsWithBalance.find(
        (tokenId) => tokenId.toLowerCase() === normalizedSearchQuery,
      ) || null,
    [normalizedSearchQuery, walletTokenIdsWithBalance],
  );

  useEffect(() => {
    if (userTokenIds.length === 0) return;

    const cachedDetails: TokenDetailsMap = {};
    userTokenIds.forEach((tokenId) => {
      const detail = getCachedTokenDetails(tokenId);
      if (detail) {
        cachedDetails[tokenId] = detail;
      }
    });

    if (Object.keys(cachedDetails).length === 0) {
      return;
    }

    tokenDetailsRef.current = {
      ...tokenDetailsRef.current,
      ...cachedDetails,
    };

    setTokenDetails((prev) => {
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
  }, [userTokenIds]);

  useEffect(() => {
    let cancelled = false;
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    const run = async () => {
      const tokensToLoad = userTokenIds.filter((tokenId) => !tokenDetailsRef.current[tokenId]);
      if (tokensToLoad.length === 0) return;

      const results = await Promise.allSettled(
        tokensToLoad.map(async (tokenId) => {
          const detail = await fetchTokenDetails(tokenId);
          return { tokenId, detail };
        }),
      );

      if (cancelled || loadRequestIdRef.current !== requestId) {
        return;
      }

      const loadedDetails: TokenDetailsMap = {};
      results.forEach((result) => {
        if (result.status === "fulfilled" && result.value.detail) {
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

      setTokenDetails((prev) => ({
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

    const decimals = getTokenDecimalsFromDetails(selectedTokenDetail, 0);

    onTokenMetaChange({
      tokenId: selectedToken.id,
      decimals,
      detail: selectedTokenDetail,
    });
  }, [selectedToken.id, selectedTokenDetail, onTokenMetaChange]);

  useEffect(() => {
    let cancelled = false;

    const resolveExactTokenIdSearch = async () => {
      if (!trimmedSearchQuery || !isValidTokenId(trimmedSearchQuery)) {
        setSearchLookup({
          status: "idle",
          tokenId: "",
        });
        setSearchedTokenDetail(null);
        return;
      }

      setSearchLookup({
        status: "loading",
        tokenId: normalizedSearchQuery,
      });
      setSearchedTokenDetail(null);

      const cachedDetail =
        tokenDetailsRef.current[normalizedSearchQuery] ||
        getCachedTokenDetails(normalizedSearchQuery);

      if (cachedDetail) {
        const resolvedTokenId = (cachedDetail.tokenId || normalizedSearchQuery).toLowerCase();

        tokenDetailsRef.current = {
          ...tokenDetailsRef.current,
          [resolvedTokenId]: cachedDetail,
        };
        setTokenDetails((prev) => ({
          ...prev,
          [resolvedTokenId]: cachedDetail,
        }));
        setSearchedTokenDetail(cachedDetail);
        setSearchLookup({
          status: "found",
          tokenId: resolvedTokenId,
        });
        return;
      }

      try {
        const detail = await fetchTokenDetails(normalizedSearchQuery);
        if (cancelled) {
          return;
        }

        if (!detail) {
          setSearchLookup({
            status: "not-found",
            tokenId: normalizedSearchQuery,
          });
          setSearchedTokenDetail(null);
          return;
        }

        const resolvedTokenId = (detail.tokenId || normalizedSearchQuery).toLowerCase();

        tokenDetailsRef.current = {
          ...tokenDetailsRef.current,
          [resolvedTokenId]: detail,
        };
        setTokenDetails((prev) => ({
          ...prev,
          [resolvedTokenId]: detail,
        }));
        setSearchedTokenDetail(detail);
        setSearchLookup({
          status: "found",
          tokenId: resolvedTokenId,
        });
      } catch {
        if (!cancelled) {
          setSearchLookup({
            status: "not-found",
            tokenId: normalizedSearchQuery,
          });
          setSearchedTokenDetail(null);
        }
      }
    };

    void resolveExactTokenIdSearch();

    return () => {
      cancelled = true;
    };
  }, [normalizedSearchQuery, trimmedSearchQuery]);

  const displayTokens = useMemo<DisplayToken[]>(() => {
    return walletTokenIdsWithBalance
      .map((tokenId) => {
        const rawAmount = userTokens[tokenId] || "0";
        const detail = tokenDetails[tokenId];
        const decimals = getTokenDecimalsFromDetails(detail, 0);
        const actualAmount = Number(rawAmount) / Math.pow(10, decimals || 0);
        const formattedAmount = new Intl.NumberFormat("en-US", {
          maximumFractionDigits: decimals,
        }).format(actualAmount);

        return {
          tokenId,
          tokenName: getTokenName(detail, tokenId),
          tokenTicker: detail?.genesisInfo?.tokenTicker?.trim() || "",
          formattedAmount,
          rawAmount,
        };
      })
      .sort((a, b) => {
        const amountA = parseRawAmount(a.rawAmount);
        const amountB = parseRawAmount(b.rawAmount);

        if (amountA !== amountB) {
          return amountA > amountB ? -1 : 1;
        }
        return a.tokenName.localeCompare(b.tokenName);
      });
  }, [tokenDetails, userTokens, walletTokenIdsWithBalance]);

  const searchedTokenResult = useMemo(() => {
    if (
      !isValidTokenId(trimmedSearchQuery) ||
      searchLookup.status !== "found" ||
      !searchedTokenDetail ||
      exactOwnedTokenId
    ) {
      return null;
    }

    return {
      tokenId: searchLookup.tokenId,
      tokenName: getTokenName(searchedTokenDetail, searchLookup.tokenId),
      tokenTicker: searchedTokenDetail?.genesisInfo?.tokenTicker?.trim() || "",
    };
  }, [exactOwnedTokenId, searchLookup, searchedTokenDetail, trimmedSearchQuery]);

  const filteredTokens = useMemo(() => {
    if (!normalizedSearchQuery) {
      return displayTokens;
    }

    if (isValidTokenId(trimmedSearchQuery)) {
      if (!exactOwnedTokenId) {
        return [];
      }

      return displayTokens.filter(
        ({ tokenId }) => tokenId.toLowerCase() === exactOwnedTokenId.toLowerCase(),
      );
    }

    return displayTokens.filter(({ tokenId, tokenName, tokenTicker }) => {
      return (
        tokenName.toLowerCase().includes(normalizedSearchQuery) ||
        tokenTicker.toLowerCase().includes(normalizedSearchQuery) ||
        tokenId.toLowerCase().includes(normalizedSearchQuery)
      );
    });
  }, [displayTokens, exactOwnedTokenId, normalizedSearchQuery, trimmedSearchQuery]);

  const hasWalletTokens = displayTokens.length > 0;

  useEffect(() => {
    if (open && filteredTokens.length > 2) {
      setShowScrollHint(true);

      const timer = setTimeout(() => {
        setShowScrollHint(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [filteredTokens.length, open]);

  const resetSearch = () => {
    setSearchQuery("");
    setSearchLookup({
      status: "idle",
      tokenId: "",
    });
    setSearchedTokenDetail(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      resetSearch();
    }
  };

  const handleTokenSelect = (tokenId: string, tokenName: string) => {
    onTokenSelect(tokenId, tokenName);
    setOpen(false);
    resetSearch();
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          className={`bg-background text-sm hover:bg-muted border text-foreground rounded-full px-2 py-1 flex items-center gap-2 ${className}`}
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
          {selectedToken.name || "Select token"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 flex flex-col">
        <div className="space-y-4 flex-1">
          <h4 className="font-medium flex items-center gap-2">
            <MousePointerClick className="w-4 h-4" />
            Select a token
          </h4>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search token"
              className="h-8 rounded-full pl-8 pr-3 text-xs"
            />
          </div>

          {searchedTokenResult ? (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Search result</div>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 px-2 py-1.5 h-auto"
                onClick={() =>
                  handleTokenSelect(searchedTokenResult.tokenId, searchedTokenResult.tokenName)
                }
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={`https://icons.etokens.cash/32/${searchedTokenResult.tokenId}.png`}
                    alt={searchedTokenResult.tokenName}
                  />
                  <AvatarFallback>
                    {searchedTokenResult.tokenName.substring(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium">{searchedTokenResult.tokenName}</span>
                  {searchedTokenResult.tokenTicker ? (
                    <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground/80">
                      {searchedTokenResult.tokenTicker}
                    </span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {shortenTokenId(searchedTokenResult.tokenId)}
                  </span>
                </div>
              </Button>
            </div>
          ) : null}

          <div className="space-y-2 relative">
            <div className="text-sm text-muted-foreground">Wallet tokens</div>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {filteredTokens.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  {!hasWalletTokens
                    ? "No wallet tokens"
                    : isValidTokenId(trimmedSearchQuery) && searchLookup.status === "loading"
                      ? "Searching token ID..."
                      : isValidTokenId(trimmedSearchQuery) && searchLookup.status === "not-found"
                        ? "Token not found"
                        : "No matching tokens"}
                </div>
              ) : (
                filteredTokens.map(({ tokenId, tokenName, tokenTicker, formattedAmount }) => (
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
                      {tokenTicker ? (
                        <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground/80">
                          {tokenTicker}
                        </span>
                      ) : null}
                      <span className="text-sm text-muted-foreground">
                        Balance: {formattedAmount}
                      </span>
                    </div>
                  </Button>
                ))
              )}
            </div>
            {showScrollHint && filteredTokens.length > 2 && (
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
