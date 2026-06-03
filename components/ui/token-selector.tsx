import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { MousePointerClick, Search } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  fetchTokenDetails,
  getCachedTokenDetails,
  getTokenDecimalsFromDetails,
} from "@/lib/chronik";
import { isBlockedTokenId } from "@/lib/blocked-tokens";
import { fetchEtokenDbTopVolumeTokens } from "@/lib/etokendb";

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

type TopVolumeToken = Awaited<ReturnType<typeof fetchEtokenDbTopVolumeTokens>>[number];
type ActiveTokensStatus = "idle" | "loading" | "loaded" | "error";

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

const TOP_VOLUME_TOKENS_CACHE_KEY = "token_table_top_volume_tokens_v1";
const TOP_VOLUME_TOKENS_CACHE_TTL_MS = 2 * 60 * 1000;

function normalizeTokenIds(tokens: TopVolumeToken[]): string[] {
  const seen = new Set<string>();
  const tokenIds: string[] = [];

  tokens.forEach((token) => {
    const tokenId = token?.tokenId?.trim().toLowerCase();
    if (!tokenId || !isValidTokenId(tokenId) || isBlockedTokenId(tokenId) || seen.has(tokenId)) {
      return;
    }

    seen.add(tokenId);
    tokenIds.push(tokenId);
  });

  return tokenIds;
}

function getCachedTopVolumeTokenIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = localStorage.getItem(TOP_VOLUME_TOKENS_CACHE_KEY);
    if (!stored) {
      return [];
    }

    const payload = JSON.parse(stored) as { cachedAt?: number; tokens?: TopVolumeToken[] } | null;
    if (
      !payload ||
      typeof payload.cachedAt !== "number" ||
      !Array.isArray(payload.tokens) ||
      Date.now() - payload.cachedAt > TOP_VOLUME_TOKENS_CACHE_TTL_MS
    ) {
      return [];
    }

    return normalizeTokenIds(payload.tokens);
  } catch {
    return [];
  }
}

function setCachedTopVolumeTokens(tokens: TopVolumeToken[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(
      TOP_VOLUME_TOKENS_CACHE_KEY,
      JSON.stringify({
        cachedAt: Date.now(),
        tokens,
      }),
    );
  } catch {}
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
  const [tokenDetails, setTokenDetails] = useState<TokenDetailsMap>({});
  const [activeTokenIds, setActiveTokenIds] = useState<string[]>([]);
  const [activeTokensStatus, setActiveTokensStatus] = useState<ActiveTokensStatus>("idle");
  const tokenDetailsRef = useRef<TokenDetailsMap>({});
  const loadRequestIdRef = useRef(0);
  const userTokenIds = useMemo(
    () => Object.keys(userTokens).filter((tokenId) => !isBlockedTokenId(tokenId)),
    [userTokens],
  );
  const walletTokenIdsWithBalance = useMemo(
    () =>
      userTokenIds.filter((tokenId) => {
        const rawAmount = userTokens[tokenId] || "0";
        return rawAmount !== "0";
      }),
    [userTokenIds, userTokens],
  );
  const candidateTokenIds = useMemo(() => {
    const seen = new Set<string>();
    const tokenIds: string[] = [];

    [...userTokenIds, ...activeTokenIds].forEach((tokenId) => {
      const normalizedTokenId = tokenId.trim().toLowerCase();
      if (!normalizedTokenId || seen.has(normalizedTokenId) || isBlockedTokenId(normalizedTokenId)) {
        return;
      }

      seen.add(normalizedTokenId);
      tokenIds.push(normalizedTokenId);
    });

    return tokenIds;
  }, [activeTokenIds, userTokenIds]);
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
    if (candidateTokenIds.length === 0) return;

    const cachedDetails: TokenDetailsMap = {};
    candidateTokenIds.forEach((tokenId) => {
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
  }, [candidateTokenIds]);

  useEffect(() => {
    let cancelled = false;
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    const run = async () => {
      const tokensToLoad = candidateTokenIds.filter((tokenId) => !tokenDetailsRef.current[tokenId]);
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
  }, [candidateTokenIds]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    const cachedTokenIds = getCachedTopVolumeTokenIds();
    if (cachedTokenIds.length > 0) {
      setActiveTokenIds(cachedTokenIds);
      setActiveTokensStatus("loaded");
    } else {
      setActiveTokensStatus("loading");
    }

    const run = async () => {
      try {
        const tokens = await fetchEtokenDbTopVolumeTokens({ pageSize: 100 });
        if (cancelled) {
          return;
        }

        const tokenIds = normalizeTokenIds(tokens);
        setCachedTopVolumeTokens(tokens);
        setActiveTokenIds(tokenIds);
        setActiveTokensStatus("loaded");
      } catch {
        if (!cancelled) {
          setActiveTokensStatus(cachedTokenIds.length > 0 ? "loaded" : "error");
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [open]);

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

      if (isBlockedTokenId(normalizedSearchQuery)) {
        setSearchLookup({
          status: "not-found",
          tokenId: normalizedSearchQuery,
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

  const activeDisplayTokens = useMemo<DisplayToken[]>(() => {
    const walletTokenIds = new Set(walletTokenIdsWithBalance.map((tokenId) => tokenId.toLowerCase()));

    return activeTokenIds
      .filter((tokenId) => !walletTokenIds.has(tokenId.toLowerCase()))
      .map((tokenId) => {
        const detail = tokenDetails[tokenId];

        return {
          tokenId,
          tokenName: getTokenName(detail, tokenId),
          tokenTicker: detail?.genesisInfo?.tokenTicker?.trim() || "",
          formattedAmount: "",
          rawAmount: "0",
        };
      });
  }, [activeTokenIds, tokenDetails, walletTokenIdsWithBalance]);

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

  const filteredActiveTokens = useMemo(() => {
    if (!normalizedSearchQuery || isValidTokenId(trimmedSearchQuery)) {
      return [];
    }

    return activeDisplayTokens
      .filter(({ tokenId, tokenName, tokenTicker }) => {
        return (
          tokenName.toLowerCase().includes(normalizedSearchQuery) ||
          tokenTicker.toLowerCase().includes(normalizedSearchQuery) ||
          tokenId.toLowerCase().includes(normalizedSearchQuery)
        );
      })
      .slice(0, 12);
  }, [activeDisplayTokens, normalizedSearchQuery, trimmedSearchQuery]);

  const hasWalletTokens = displayTokens.length > 0;

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
          <span className="max-w-[12rem] truncate">{selectedToken.name || "Select token"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[calc(100vw-2rem)] overflow-hidden p-0">
        <div className="flex max-h-[min(58vh,440px)] flex-col">
          <div className="space-y-4 p-4 pb-3">
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
          </div>

          <div className="relative min-h-0 flex-1">
            <div className="max-h-[calc(min(58vh,440px)-108px)] space-y-4 overflow-y-auto px-4 pb-8 pt-1">
              {searchedTokenResult ? (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Search result</div>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 px-2 py-1.5 h-auto overflow-hidden"
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
                    <div className="flex min-w-0 flex-1 flex-col items-start">
                      <span className="max-w-full truncate text-sm font-medium">
                        {searchedTokenResult.tokenName}
                      </span>
                      {searchedTokenResult.tokenTicker ? (
                        <span className="max-w-full truncate text-[11px] uppercase tracking-[0.08em] text-muted-foreground/80">
                          {searchedTokenResult.tokenTicker}
                        </span>
                      ) : null}
                      <span className="max-w-full truncate text-xs text-muted-foreground">
                        {shortenTokenId(searchedTokenResult.tokenId)}
                      </span>
                    </div>
                  </Button>
                </div>
              ) : null}

              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Wallet tokens</div>
                <div className="space-y-1">
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
                        className="w-full justify-start gap-2 px-2 py-1.5 h-auto overflow-hidden"
                        onClick={() => handleTokenSelect(tokenId, tokenName)}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={`https://icons.etokens.cash/32/${tokenId}.png`}
                            alt={tokenName}
                          />
                          <AvatarFallback>{tokenName.substring(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-1 flex-col items-start">
                          <span className="max-w-full truncate text-sm font-medium">{tokenName}</span>
                          {tokenTicker ? (
                            <span className="max-w-full truncate text-[11px] uppercase tracking-[0.08em] text-muted-foreground/80">
                              {tokenTicker}
                            </span>
                          ) : null}
                          <span className="max-w-full truncate text-sm text-muted-foreground">
                            Balance: {formattedAmount}
                          </span>
                        </div>
                      </Button>
                    ))
                  )}
                </div>
              </div>

              {filteredActiveTokens.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Active tokens</div>
                  <div className="space-y-1">
                    {filteredActiveTokens.map(({ tokenId, tokenName, tokenTicker }) => (
                      <Button
                        key={tokenId}
                        variant="ghost"
                        className="w-full justify-start gap-2 px-2 py-1.5 h-auto overflow-hidden"
                        onClick={() => handleTokenSelect(tokenId, tokenName)}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={`https://icons.etokens.cash/32/${tokenId}.png`}
                            alt={tokenName}
                          />
                          <AvatarFallback>{tokenName.substring(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-1 flex-col items-start">
                          <span className="max-w-full truncate text-sm font-medium">{tokenName}</span>
                          {tokenTicker ? (
                            <span className="max-w-full truncate text-[11px] uppercase tracking-[0.08em] text-muted-foreground/80">
                              {tokenTicker}
                            </span>
                          ) : null}
                          <span className="max-w-full truncate text-xs text-muted-foreground">
                            {shortenTokenId(tokenId)}
                          </span>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              ) : normalizedSearchQuery && activeTokensStatus === "loading" ? (
                <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  Loading active tokens...
                </div>
              ) : null}
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-popover to-transparent" />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
