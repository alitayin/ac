"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import {
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Filter,
  Plus,
  RotateCcw,
  Search,
  X,
  Youtube,
} from "lucide-react"
import { tokens } from "@/config/tokens"
import { AuroraText } from "@/components/magicui/aurora-text"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useXECPrice } from "@/lib/price"
import { TokenBadge } from "@/components/ui/tokenbadge"
import { formatNumber, formatPrice } from "@/lib/formatters"
import { Token, SortType, Transaction } from "@/lib/types"
import { UI_CONSTANTS } from "@/lib/constants"
import { fetchAgoraTransactionsFromChronik } from "@/lib/chronik-transactions"
import {
  fetchBlockchainInfo,
  fetchTokenDetails,
  getCachedTokenDetails,
  getTokenAmountFromToken,
  getTokenDecimalsFromDetails,
} from "@/lib/chronik"
import { useChronik } from "@/lib/context/ChronikContext"
import {
  fetchEtokenDbTopVolumeTokens,
  fetchEtokenDbTokenSummary,
  isEtokenDbAvailable,
  nanosatsPerAtomToXec,
} from "@/lib/etokendb"
import {
  clearTokenCache,
  getCachedTokenData,
  setCachedTokenData,
  getCachedTokenSummary,
  setCachedTokenSummary,
  invalidateTokenCache,
  deleteSummaryCache,
  CACHE_TTL_MS,
  SUMMARY_CACHE_TTL_MS,
  BLOCKS_PER_7_DAYS,
  BLOCKS_PER_DAY,
  compute24hStats,
} from "@/lib/token-stats"
import { watchAgoraTokens } from "@/lib/agora-ws"
import { useToast } from "@/hooks/use-toast"
import { useWallet } from "@/lib/context/WalletContext"
import { Spinner } from "@/components/ui/spinner"

const FILTER_OPTION_STORAGE_KEY = "token_table_filter_option_v1"

type TokenTableRow = Token

type FilterOption = "all" | "no-trades-30d" | "low-volume-30d" | "low-trades-30d"

type TokenLookupStatus = "idle" | "loading" | "listed" | "found" | "not-found"

type TokenLookupState = {
  status: TokenLookupStatus
  tokenId: string
  tokenInfo: Awaited<ReturnType<typeof fetchTokenDetails>> | null
}

type BootstrapTokenCandidate = {
  tokenId: string
  fallbackName?: string
  patch?: Partial<Token>
  etokenDbToken?: (Awaited<ReturnType<typeof fetchEtokenDbTopVolumeTokens>>)[number]
}

type TopVolumeTokensCachePayload = {
  cachedAt: number
  tokens: Awaited<ReturnType<typeof fetchEtokenDbTopVolumeTokens>>
}

const FILTER_OPTIONS: Array<{
  value: FilterOption
  label: string
  summary: string
}> = [
  {
    value: "all",
    label: "Show all listed tokens",
    summary: "All tokens",
  },
  {
    value: "no-trades-30d",
    label: "Hide tokens with no trades in 30 days",
    summary: "Hide 0 trades / 30d",
  },
  {
    value: "low-volume-30d",
    label: "Hide tokens with volume < 1M XEC in 30 days",
    summary: "Hide low volume / 30d",
  },
  {
    value: "low-trades-30d",
    label: "Hide tokens with < 50 trades in 30 days",
    summary: "Hide low trades / 30d",
  },
]

const TOP_VOLUME_TOKENS_CACHE_KEY = "token_table_top_volume_tokens_v1"
const TOP_VOLUME_TOKENS_CACHE_TTL_MS = 2 * 60 * 1000

const EMPTY_TOKEN_LOOKUP_STATE: TokenLookupState = {
  status: "idle",
  tokenId: "",
  tokenInfo: null,
}

type LookupMetaCardProps = {
  label: string
  value: React.ReactNode
  mono?: boolean
}

const LookupMetaCard = ({ label, value, mono = false }: LookupMetaCardProps) => (
  <div className="rounded-xl border bg-background/80 p-4">
    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
      {label}
    </p>
    <div
      className={cn(
        "mt-3 text-sm font-medium text-foreground",
        mono && "break-all font-mono text-xs sm:text-sm",
      )}
    >
      {value}
    </div>
  </div>
)

const getCachedTopVolumeTokens = (): Awaited<
  ReturnType<typeof fetchEtokenDbTopVolumeTokens>
> | null => {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const stored = localStorage.getItem(TOP_VOLUME_TOKENS_CACHE_KEY)
    if (!stored) {
      return null
    }

    const payload = JSON.parse(stored) as TopVolumeTokensCachePayload | null
    if (
      !payload ||
      typeof payload !== "object" ||
      typeof payload.cachedAt !== "number" ||
      !Array.isArray(payload.tokens)
    ) {
      return null
    }

    if (Date.now() - payload.cachedAt > TOP_VOLUME_TOKENS_CACHE_TTL_MS) {
      return null
    }

    return payload.tokens
  } catch (_error) {
    return null
  }
}

const setCachedTopVolumeTokens = (
  tokens: Awaited<ReturnType<typeof fetchEtokenDbTopVolumeTokens>>,
) => {
  if (typeof window === "undefined") {
    return
  }

  try {
    const payload: TopVolumeTokensCachePayload = {
      cachedAt: Date.now(),
      tokens,
    }
    localStorage.setItem(TOP_VOLUME_TOKENS_CACHE_KEY, JSON.stringify(payload))
  } catch (_error) {}
}

const clearCachedTopVolumeTokens = () => {
  if (typeof window === "undefined") {
    return
  }

  try {
    localStorage.removeItem(TOP_VOLUME_TOKENS_CACHE_KEY)
  } catch (_error) {}
}

const getTokenNameFromDetails = (
  tokenDetails: any,
  fallbackName?: string,
): string | null => {
  const tokenName = tokenDetails?.genesisInfo?.tokenName

  if (typeof tokenName === "string" && tokenName.trim().length > 0) {
    return tokenName.trim()
  }

  if (typeof fallbackName === "string" && fallbackName.trim().length > 0) {
    return fallbackName.trim()
  }

  return null
}

const getTokenRouteParam = (token: Pick<Token, "tokenId">): string => {
  return token.tokenId
}

const createInitialTokenRow = (
  tokenId: string,
  name: string,
  patch?: Partial<Token>,
): Token => {
  return {
    id: tokenId,
    tokenId,
    name,
    totalTransactions: 0,
    last24HoursXECAmount: 0,
    last30DaysXECAmount: 0,
    last30DaysVolumeXECAmount: 0,
    priceChange24h: 0,
    latestPrice: 0,
    totalXECAmount: 0,
    has30DayVolume: false,
    hasInitialMarketData: false,
    hasResolvedTokenInfo: false,
    official: false,
    gratitude: false,
    community: false,
    stablecoin: false,
    apyTag: undefined,
    watchlist: false,
    ...patch,
  }
}

const getTokenDisplayFallbackName = (
  tokenId: string,
  fallbackName?: string,
): string => {
  if (typeof fallbackName === "string" && fallbackName.trim().length > 0) {
    return fallbackName.trim()
  }

  if (tokenId.length <= 12) {
    return tokenId
  }

  return `${tokenId.slice(0, 6)}...${tokenId.slice(-4)}`
}

const getConfiguredTokenPatch = (
  tokenId: string,
  watchlist: boolean,
): Partial<Token> => {
  const tokenConfig = Object.values(tokens).find((token) => token.tokenId === tokenId)

  return {
    official: tokenConfig?.official || false,
    gratitude: tokenConfig?.gratitude || false,
    community: tokenConfig?.community || false,
    stablecoin: tokenConfig?.stablecoin || false,
    apyTag: tokenConfig?.apyTag,
    watchlist,
  }
}

const hasCurrentSummaryCacheShape = (
  summary: { data?: Partial<Token> | null } | null,
): summary is { data: Partial<Token> } => {
  const data = summary?.data
  return (
    !!data &&
    typeof data === "object" &&
    typeof data.totalXECAmount === "number" &&
    typeof data.last30DaysVolumeXECAmount === "number" &&
    typeof data.has30DayVolume === "boolean"
  )
}

const getStoredFilterOption = (): FilterOption => {
  if (typeof window === "undefined") return "all"
  try {
    const stored = localStorage.getItem(FILTER_OPTION_STORAGE_KEY)
    if (
      stored === "all" ||
      stored === "no-trades-30d" ||
      stored === "low-volume-30d" ||
      stored === "low-trades-30d"
    ) {
      return stored as FilterOption
    }
  } catch (_error) {}
  return "all"
}

export default function Component() {
  const { chronik: chronikClient, isLoading: isChronikLoading } = useChronik()
  const { toast } = useToast()
  const { isWalletConnected, userTokens } = useWallet()

  const [data, setData] = React.useState<TokenTableRow[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [showUSD, setShowUSD] = React.useState(false)
  const [loadedTokens, setLoadedTokens] = React.useState<Set<string>>(new Set())
  const [refreshNonce, setRefreshNonce] = React.useState(0)
  const [errorTokens, setErrorTokens] = React.useState<Set<string>>(new Set())
  const [loadedIcons, setLoadedIcons] = React.useState<Set<string>>(new Set())
  const [failedIcons, setFailedIcons] = React.useState<Set<string>>(new Set())
  const [chainTipHeight, setChainTipHeight] = React.useState<number | null>(null)
  const [searchExpanded, setSearchExpanded] = React.useState(false)
  const [searchInput, setSearchInput] = React.useState("")
  const [lookupDialogOpen, setLookupDialogOpen] = React.useState(false)
  const [tokenLookup, setTokenLookup] = React.useState<TokenLookupState>(
    EMPTY_TOKEN_LOOKUP_STATE,
  )
  const [filterOption, setFilterOption] = React.useState<FilterOption>(getStoredFilterOption)
  const [filteredTokens, setFilteredTokens] = React.useState<Set<string>>(new Set())
  const [showClearCacheConfirm, setShowClearCacheConfirm] = React.useState(false)
  const [tokenUpdatedAt, setTokenUpdatedAt] = React.useState<Map<string, number>>(new Map())
  const [isAddingToWatchlist, setIsAddingToWatchlist] = React.useState(false)
  const [isLocalFallbackMode, setIsLocalFallbackMode] = React.useState(false)
  const router = useRouter()
  
  const loadingTokens = React.useRef<Set<string>>(new Set())
  const loadingTimeouts = React.useRef<Map<string, NodeJS.Timeout>>(new Map())
  const wsReloadTimeouts = React.useRef<Map<string, NodeJS.Timeout>>(new Map())
  const searchContainerRef = React.useRef<HTMLDivElement | null>(null)
  const filteredTokensRef = React.useRef<Set<string>>(new Set())
  const prevFilteredTokensRef = React.useRef<Set<string>>(new Set())

  const [sortBy, setSortBy] = React.useState<SortType>('7d');

  const [highlightFields, setHighlightFields] = React.useState<Map<string, Set<string>>>(new Map());

  const xecPrice = useXECPrice();
  const cancelledRef = React.useRef(false)

  const [largeDatasetTokens, setLargeDatasetTokens] = React.useState<Set<string>>(new Set())
  const [approvedLargeTokens, setApprovedLargeTokens] = React.useState<Set<string>>(new Set())
  const approvedLargeTokensRef = React.useRef<Set<string>>(new Set())
  const [failedDataTokens, setFailedDataTokens] = React.useState<Set<string>>(new Set())
  const retryCountRef = React.useRef<Map<string, number>>(new Map())
  const hasRowMarketData = React.useCallback(
    (token: TokenTableRow) => {
      return loadedTokens.has(token.tokenId) || token.hasInitialMarketData === true
    },
    [loadedTokens],
  )

  React.useEffect(() => {
    if (!searchExpanded) return

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setSearchExpanded(false)
        setSearchInput("")
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("touchstart", handleClickOutside)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("touchstart", handleClickOutside)
    }
  }, [searchExpanded])

  React.useEffect(() => {
    try {
      localStorage.setItem(FILTER_OPTION_STORAGE_KEY, filterOption)
    } catch (_error) {}
  }, [filterOption])

  React.useEffect(() => {
    return () => {
      wsReloadTimeouts.current.forEach((timeoutId) => {
        clearTimeout(timeoutId)
      })
      wsReloadTimeouts.current.clear()
    }
  }, [])

  const clearCacheAndReload = () => {
    clearTokenCache()
    clearCachedTopVolumeTokens()
    setLoadedTokens(new Set())
    setLoadedIcons(new Set())
    setFailedIcons(new Set())
    setHighlightFields(new Map())
    setData([])
    setIsLoading(true)
    setRefreshNonce((n) => n + 1)
    setShowClearCacheConfirm(false)
  }

  const columns: ColumnDef<TokenTableRow>[] = [
    {
      id: "index",
      header: "#",
      cell: ({ row }) => {
        const tokenId = row.original.tokenId
        const index = row.index
        const updatedAt = tokenUpdatedAt.get(tokenId)
        const minutesAgo =
          typeof updatedAt === "number"
            ? Math.max(0, Math.round((Date.now() - updatedAt) / 60000))
            : null

        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-sm text-foreground hover:text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {index + 1}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <span className="text-xs">
                {minutesAgo !== null
                  ? `cached ${minutesAgo} minutes ago`
                  : "No cache"}
              </span>
            </TooltipContent>
          </Tooltip>
        )
      },
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => {
        const isRowLoading = isLoading || !hasRowMarketData(row.original)
        const isIconLoaded = loadedIcons.has(row.original.tokenId)
        const isIconFailed = failedIcons.has(row.original.tokenId)

        const markIconLoaded = () => {
          setLoadedIcons((prev) => {
            if (prev.has(row.original.tokenId)) return prev
            const next = new Set(prev)
            next.add(row.original.tokenId)
            return next
          })
          setFailedIcons((prev) => {
            if (!prev.has(row.original.tokenId)) return prev
            const next = new Set(prev)
            next.delete(row.original.tokenId)
            return next
          })
        }

        const markIconFailed = () => {
          setFailedIcons((prev) => {
            if (prev.has(row.original.tokenId)) return prev
            const next = new Set(prev)
            next.add(row.original.tokenId)
            return next
          })
        }

        return (
          <div 
            className="flex items-center gap-2 cursor-pointer hover:opacity-80"
            onClick={() => router.push(`/${getTokenRouteParam(row.original)}`)}
          >
              <Avatar className="h-8 w-8 relative overflow-hidden">
                {!isIconLoaded && !isIconFailed && (
                  <div className="absolute inset-0 rounded-full bg-accent animate-pulse" />
                )}
                <img
                  src={`https://icons.etokens.cash/32/${row.original.tokenId}.png`}
                  alt={row.original.name}
                  loading="lazy"
                  className={cn(
                    "h-full w-full object-cover transition-opacity duration-300",
                    isIconFailed ? "hidden" : "",
                    isIconLoaded ? "opacity-100" : "opacity-0",
                  )}
                  onLoad={markIconLoaded}
                  onError={markIconFailed}
                />
                {isIconFailed && (
                  <AvatarFallback>
                    {row.original.name.substring(0, 2)}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex items-center gap-2">
                <span>{row.original.name}</span>
                {isRowLoading && (
                  <span className="text-xs text-muted-foreground">(loading)</span>
                )}
                {errorTokens.has(row.original.tokenId) && (
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                )}
                {row.original.official && (
                  <TokenBadge
                    label="AC"
                    description="eToken issued by Agora.Cash"
                    gradient
                  />
                )}
                {row.original.stablecoin && (
                  <TokenBadge
                    label="stablecoin"
                    description="A cryptocurrency designed to maintain a stable value"
                  />
                )}
                {row.original.apyTag && (
                  <TokenBadge
                    label={row.original.apyTag}
                    gradient
                    customClass="whitespace-nowrap"
                  />
                )}
                {row.original.gratitude && (
                  <TokenBadge
                    label="gratitude"
                    description="Special label exclusively for POW token"
                    pinnedStyle
                  />
                )}
                {row.original.community && (
                  <TokenBadge
                    label="community"
                    description="eCash Community eToken"
                  />
                )}
                {row.original.watchlist && (
                  <div 
                    className="relative inline-flex group"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <TokenBadge
                      label="Self-selection"
                      description="Custom token added to your watchlist"
                      customClass="bg-blue-500/10 text-blue-500 border-blue-500/20"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeCustomToken(row.original.tokenId)
                      }}
                      className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {(() => {
                  const tokenConfig = Object.values(tokens).find(t => t.tokenId === row.original.tokenId);
                  if (tokenConfig?.youtubeUrl && tokenConfig?.youtubeHoverImage) {
                    return (
                      <Dialog>
                        <DialogTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center hover:opacity-80 transition-opacity"
                          >
                            <Youtube className="h-6 w-6" />
                          </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl" onClick={(e) => e.stopPropagation()}>
                          <DialogHeader>
                            <DialogTitle>Visit YouTube Channel</DialogTitle>
                            <DialogDescription>
                              You are about to visit {row.original.name}&apos;s YouTube channel
                            </DialogDescription>
                          </DialogHeader>
                          <div className="flex justify-center py-4">
                            <img 
                              src={tokenConfig.youtubeHoverImage} 
                              alt="YouTube Preview" 
                              className="w-full h-auto rounded-lg"
                            />
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(tokenConfig.youtubeUrl, '_blank', 'noopener,noreferrer');
                              }}
                            >
                              Confirm Visit
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
        )
      },
    },
    {
      accessorKey: "latestPrice",
      header: () => (
        <div className="flex items-center gap-2">
          <span>Price ({showUSD ? 'USD' : 'XEC'})</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowUSD(!showUSD)
            }}
            className="p-1 hover:bg-accent rounded-md transition-colors"
          >
            <DollarSign className={`h-4 w-4 ${showUSD ? 'text-green-500' : 'text-muted-foreground'}`} />
          </button>
        </div>
      ),
      cell: ({ row }) => {
        const tokenIdForLoad = row.original.tokenId
        const hasUsableData = hasRowMarketData(row.original)
        const isRowLoading = isLoading || !hasUsableData
        if (isRowLoading) {
          return <div className="text-left text-muted-foreground">Loading</div>
        }

        const isFailed = failedDataTokens.has(tokenIdForLoad)
        if (isFailed) {
          return (
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-red-500 hover:text-white transition-colors border-red-500 text-red-500"
              onClick={(e) => {
                e.stopPropagation()
                retryTokenData(tokenIdForLoad, row.original.name)
              }}
            >
              Try Again
            </Badge>
          )
        }

        if (row.original.hasInitialMarketData && row.original.hasResolvedTokenInfo === false) {
          return <div className="text-left text-muted-foreground">Loading</div>
        }

        const price = row.original.latestPrice || 0
        const usdPrice = price * (xecPrice || 0)
        return (
          <div className="text-left">
            {formatPrice(showUSD ? usdPrice : price)}
          </div>
        )
      },
    },
    {
      accessorKey: "priceChange24h",
      header: "24h Change",
      cell: ({ row }) => {
        const tokenIdForLoad = row.original.tokenId
        const isRowLoading = isLoading || !hasRowMarketData(row.original)
        if (isRowLoading) {
          return <div className="text-left text-muted-foreground">Loading</div>
        }

        const isFailed = failedDataTokens.has(tokenIdForLoad)
        if (isFailed) {
          return (
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-red-500 hover:text-white transition-colors border-red-500 text-red-500"
              onClick={(e) => {
                e.stopPropagation()
                retryTokenData(tokenIdForLoad, row.original.name)
              }}
            >
              Try Again
            </Badge>
          )
        }

        const change = row.original.priceChange24h || 0
        const color = change >= 0 ? "text-green-500" : "text-red-500"
        return (
          <div className={`text-left ${color}`}>
            {change >= 0 ? "+" : ""}{change.toFixed(2)}%
          </div>
        )
      },
    },
    {
      accessorKey: "last24HoursXECAmount",
      header: "24h Volume",
      cell: ({ row }) => {
        const tokenIdForLoad = row.original.tokenId
        const isRowLoading = isLoading || !hasRowMarketData(row.original)
        if (isRowLoading) {
          return <div className="text-left text-muted-foreground">Loading</div>
        }

        const isFailed = failedDataTokens.has(tokenIdForLoad)
        if (isFailed) {
          return (
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-red-500 hover:text-white transition-colors border-red-500 text-red-500"
              onClick={(e) => {
                e.stopPropagation()
                retryTokenData(tokenIdForLoad, row.original.name)
              }}
            >
              Try Again
            </Badge>
          )
        }

        return (
          <div className="text-left">
            {formatNumber(row.original.last24HoursXECAmount || 0)} XEC
          </div>
        )
      },
    },
    {
      accessorKey: "last30DaysXECAmount",
      header: "7D Volume",
      cell: ({ row }) => {
        const tokenIdForLoad = row.original.tokenId
        const isRowLoading = isLoading || !hasRowMarketData(row.original)
        if (isRowLoading) {
          return <div className="text-left text-muted-foreground">Loading</div>
        }

        const isLargeDataset = largeDatasetTokens.has(tokenIdForLoad)
        const isApproved = approvedLargeTokens.has(tokenIdForLoad)
        const isFailed = failedDataTokens.has(tokenIdForLoad)

        if (isFailed) {
          return (
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-red-500 hover:text-white transition-colors border-red-500 text-red-500"
              onClick={(e) => {
                e.stopPropagation()
                retryTokenData(tokenIdForLoad, row.original.name)
              }}
            >
              Try Again
            </Badge>
          )
        }

        if (isLargeDataset && !isApproved) {
          return (
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                load7DayDataForToken(tokenIdForLoad, row.original.name)
              }}
            >
              Show
            </Badge>
          )
        }

        return (
          <div className="text-left">
            {formatNumber(row.original.last30DaysXECAmount || 0)} XEC
          </div>
        )
      },
    },
    {
      accessorKey: "totalXECAmount",
      header: "30D Volume",
      cell: ({ row }) => {
        const tokenIdForLoad = row.original.tokenId
        const isRowLoading = isLoading || !hasRowMarketData(row.original)
        if (isRowLoading) {
          return <div className="text-left text-muted-foreground">Loading</div>
        }

        const isFailed = failedDataTokens.has(tokenIdForLoad)
        if (isFailed) {
          return (
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-red-500 hover:text-white transition-colors border-red-500 text-red-500"
              onClick={(e) => {
                e.stopPropagation()
                retryTokenData(tokenIdForLoad, row.original.name)
              }}
            >
              Try Again
            </Badge>
          )
        }

        if (!row.original.has30DayVolume) {
          return <div className="text-left text-muted-foreground">-</div>
        }

        return (
          <div className="text-left">
            {formatNumber(row.original.totalXECAmount || 0)} XEC
          </div>
        )
      },
    },
    {
      accessorKey: "totalTransactions",
      header: "Sales in 7D",
      cell: ({ row }) => {
        const tokenIdForLoad = row.original.tokenId
        const isRowLoading = isLoading || !hasRowMarketData(row.original)
        if (isRowLoading) {
          return <div className="text-left text-muted-foreground">loading</div>
        }

        const isLargeDataset = largeDatasetTokens.has(tokenIdForLoad)
        const isApproved = approvedLargeTokens.has(tokenIdForLoad)
        const isFailed = failedDataTokens.has(tokenIdForLoad)

        if (isFailed) {
          return (
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-red-500 hover:text-white transition-colors border-red-500 text-red-500"
              onClick={(e) => {
                e.stopPropagation()
                retryTokenData(tokenIdForLoad, row.original.name)
              }}
            >
              Try Again
            </Badge>
          )
        }

        if (isLargeDataset && !isApproved) {
          return (
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                load7DayDataForToken(tokenIdForLoad, row.original.name)
              }}
            >
              Show
            </Badge>
          )
        }

        return (
          <div className="text-left">
            {formatNumber(row.original.totalTransactions || 0, true)}
          </div>
        )
      },
    },
  ]

  const applyTokenUpdate = (tokenId: string, patch: Partial<Token>) => {
    let updatedFields: Set<string> | undefined
    const nowTs = Date.now()
    setData((prevData) => {
      const nextData = [...prevData]
      const index = nextData.findIndex((t) => t.tokenId === tokenId)
      const prev = index !== -1 ? nextData[index] : null
      const merged = { ...prev, ...patch } as Token

      if (prev) {
        const trackableFields = [
          "latestPrice",
          "last24HoursXECAmount",
          "last30DaysXECAmount",
          "priceChange24h",
          "totalTransactions",
          "totalXECAmount",
        ] as const
        const diff = new Set<string>()
        trackableFields.forEach((field) => {
          if (prev[field] !== (merged as any)[field]) {
            diff.add(field)
          }
        })
        if (diff.size > 0) {
          updatedFields = diff
        }
      }

      if (index !== -1) {
        nextData[index] = merged
      } else {
        nextData.push(merged)
      }
      return nextData
    })

    setTokenUpdatedAt((prev) => {
      const next = new Map(prev)
      next.set(tokenId, nowTs)
      return next
    })

    if (updatedFields && updatedFields.size > 0) {
      setHighlightFields((prev) => {
        const map = new Map(prev)
        map.set(tokenId, updatedFields!)
        return map
      })
      setTimeout(() => {
        setHighlightFields((prev) => {
          const map = new Map(prev)
          map.delete(tokenId)
          return map
        })
      }, UI_CONSTANTS.HIGHLIGHT_DURATION)
    }
  }

  const retryTokenData = async (tokenId: string, name: string) => {
    retryCountRef.current.delete(`${tokenId}:24h`)
    retryCountRef.current.delete(`${tokenId}:latest`)
    retryCountRef.current.delete(`${tokenId}:7d`)

    setFailedDataTokens((prev) => {
      const next = new Set(prev)
      next.delete(tokenId)
      return next
    })

    setErrorTokens((prev) => {
      const next = new Set(prev)
      next.delete(tokenId)
      return next
    })

    setLoadedTokens((prev) => {
      const next = new Set(prev)
      next.delete(tokenId)
      return next
    })

    invalidateTokenCache(tokenId)
    deleteSummaryCache(tokenId)

    await loadTokenStatsRef.current?.(tokenId, name, { ignoreFilter: true })
  }

  const load7DayDataForToken = async (tokenId: string, name: string) => {
    // Update ref immediately for synchronous access
    approvedLargeTokensRef.current.add(tokenId)

    setApprovedLargeTokens((prev) => {
      const next = new Set(prev)
      next.add(tokenId)
      return next
    })

    setLoadedTokens((prev) => {
      const next = new Set(prev)
      next.delete(tokenId)
      return next
    })

    // Clear failed state when user manually retries
    setFailedDataTokens((prev) => {
      const next = new Set(prev)
      next.delete(tokenId)
      return next
    })

    // Clear cache to force reload with 7D data
    invalidateTokenCache(tokenId)
    deleteSummaryCache(tokenId)

    await loadTokenStatsRef.current?.(tokenId, name, { ignoreFilter: true })
  }

  const loadTokenStats = async (
    tokenId: string,
    name: string,
    options?: { ignoreFilter?: boolean },
  ) => {
    if (!options?.ignoreFilter && filteredTokensRef.current.has(tokenId)) {
      return
    }
    if (loadingTokens.current.has(tokenId)) {
      return
    }
    
    loadingTokens.current.add(tokenId)
    
    const timeoutId = setTimeout(() => {
      loadingTokens.current.delete(tokenId)
      loadingTimeouts.current.delete(tokenId)
      
      if (!cancelledRef.current) {
        loadTokenStatsRef.current?.(tokenId, name, options)
      }
    }, 30000)
    
    loadingTimeouts.current.set(tokenId, timeoutId)
    
    try {
      const now = Date.now()

      const etokenDbAvailable = await isEtokenDbAvailable()
      const summaryCached = !etokenDbAvailable
        ? getCachedTokenSummary<Partial<Token>>(tokenId)
        : null
      const summaryCacheValid =
        !etokenDbAvailable &&
        hasCurrentSummaryCacheShape(summaryCached) &&
        now - summaryCached.computedAt < SUMMARY_CACHE_TTL_MS
    
      if (summaryCacheValid) {
        const tokenConfig = Object.values(tokens).find((t) => t.tokenId === tokenId)
        const customTokens = getCustomTokens()
        if (!cancelledRef.current) {
          applyTokenUpdate(tokenId, {
            ...summaryCached.data,
            name,
            official: tokenConfig?.official || false,
            gratitude: tokenConfig?.gratitude || false,
            community: tokenConfig?.community || false,
            stablecoin: tokenConfig?.stablecoin || false,
            apyTag: tokenConfig?.apyTag,
            watchlist: customTokens.includes(tokenId),
          })
          
          setLoadedTokens((prev) => {
            if (prev.has(tokenId)) return prev
            const next = new Set(prev)
            next.add(tokenId)
            return next
          })
        }
        return
      }

      const activeChronik = chronikClient!

      let etokenDbSummary: Awaited<ReturnType<typeof fetchEtokenDbTokenSummary>> | null = null
      if (etokenDbAvailable) {
        try {
          etokenDbSummary = await fetchEtokenDbTokenSummary(tokenId, {
            chronikClient: activeChronik,
          })
          setLargeDatasetTokens((prev) => {
            if (!prev.has(tokenId)) return prev
            const next = new Set(prev)
            next.delete(tokenId)
            return next
          })
        } catch (err) {
          console.error(`[etokendb Fetch Error] Token: ${name}, error:`, err)
        }
      }

      const currentToken = data.find((token) => token.tokenId === tokenId)
      const cachedTokenSnapshot = hasCurrentSummaryCacheShape(summaryCached)
        ? summaryCached.data
        : null
      const currentHasPrice =
        typeof currentToken?.latestPrice === "number" && currentToken.latestPrice > 0
      const cachedHasPrice =
        typeof cachedTokenSnapshot?.latestPrice === "number" &&
        cachedTokenSnapshot.latestPrice > 0
      const fallbackLatestPrice =
        currentHasPrice
          ? currentToken!.latestPrice
          : cachedHasPrice
            ? cachedTokenSnapshot!.latestPrice!
            : 0
      const fallbackPriceChange24h =
        currentHasPrice && typeof currentToken?.priceChange24h === "number"
          ? currentToken.priceChange24h
          : typeof cachedTokenSnapshot?.priceChange24h === "number"
            ? cachedTokenSnapshot.priceChange24h
            : 0
      const fallback30DayVolume =
        typeof currentToken?.last30DaysVolumeXECAmount === "number"
          ? currentToken.last30DaysVolumeXECAmount
          : typeof cachedTokenSnapshot?.last30DaysVolumeXECAmount === "number"
            ? cachedTokenSnapshot.last30DaysVolumeXECAmount
            : 0
      const fallbackHas30DayVolume =
        currentToken?.has30DayVolume === true || cachedTokenSnapshot?.has30DayVolume === true
      
      const cached = getCachedTokenData(tokenId)
      const cacheValid = !!cached && now - cached.computedAt < CACHE_TTL_MS

      let effectiveTipHeight = chainTipHeight
      if (typeof effectiveTipHeight !== "number") {
        try {
          const info = await fetchBlockchainInfo(activeChronik)
          if (typeof info?.tipHeight === "number") {
            effectiveTipHeight = info.tipHeight
            setChainTipHeight(info.tipHeight)
          }
        } catch (_err) {}
      }

      let last30DaysXECAmount = cacheValid ? cached!.last30DaysXECAmount : 0
      let last30DaysVolumeXECAmount = 0
      let totalTransactions30d = cacheValid ? cached!.totalTransactions : 0
      let latestProcessedHeight: number | null =
        typeof cached?.latestProcessedHeight === "number" ? cached.latestProcessedHeight : null

      let fetchError = false
      const tx24h: Transaction[] = []
      let pagesRead = 0
      const retry24hKey = `${tokenId}:24h`
      const retryLatestKey = `${tokenId}:latest`
      const retry7dKey = `${tokenId}:7d`
      const shouldUseEtokenDbLatestPrice = Boolean(etokenDbSummary?.hasLatestPriceXec)
      const shouldUseEtokenDbPriceChange = Boolean(etokenDbSummary?.hasPriceChange24h)
      const needsChronik24h =
        !etokenDbSummary || !shouldUseEtokenDbLatestPrice || !shouldUseEtokenDbPriceChange
      const needsChronikLatestTx = !shouldUseEtokenDbLatestPrice

      if (needsChronik24h) {
        try {
          await fetchAgoraTransactionsFromChronik(
            tokenId,
            (batch, meta) => {
              tx24h.push(...batch)
              if (meta?.page !== undefined) {
                pagesRead = meta.page + 1
              }
            },
            {
              targetCount: 400,
              pageSize: 200,
              maxBlocksBack: BLOCKS_PER_DAY,
              stopBelowHeight:
                typeof effectiveTipHeight === "number"
                  ? Math.max(effectiveTipHeight - BLOCKS_PER_DAY, 0)
                  : undefined,
              failOnError: true,
            },
            activeChronik,
          )
        } catch (err) {
          console.error(`[24h Fetch Error] Token: ${name}, error:`, err)

          if (etokenDbSummary) {
            console.warn(
              `[24h Fetch Warning] Token: ${name}, using etokendb stats with cached price fields`,
            )
          } else {
            fetchError = true

            const currentRetryCount = retryCountRef.current.get(retry24hKey) || 0

            if (currentRetryCount < 1) {
              // First retry
              retryCountRef.current.set(retry24hKey, currentRetryCount + 1)
              console.log(`[24h Retry] Token: ${name}, retry attempt: ${currentRetryCount + 1}`)

              setErrorTokens((prev) => {
                const next = new Set(prev)
                next.add(tokenId)
                return next
              })

              setTimeout(() => {
                if (
                  !cancelledRef.current &&
                  (options?.ignoreFilter || !filteredTokensRef.current.has(tokenId))
                ) {
                  loadingTokens.current.delete(tokenId)
                  const timeoutId = loadingTimeouts.current.get(tokenId)
                  if (timeoutId) {
                    clearTimeout(timeoutId)
                    loadingTimeouts.current.delete(tokenId)
                  }
                  loadTokenStatsRef.current?.(tokenId, name, options)
                }
              }, 3000)

              return
            } else {
              // Second failure - mark as failed
              console.log(`[24h Failed] Token: ${name}, failed after retry`)
              retryCountRef.current.delete(retry24hKey)

              setFailedDataTokens((prev) => {
                const next = new Set(prev)
                next.add(tokenId)
                return next
              })

              setLoadedTokens((prev) => {
                if (prev.has(tokenId)) return prev
                const next = new Set(prev)
                next.add(tokenId)
                return next
              })

              setErrorTokens((prev) => {
                const next = new Set(prev)
                next.add(tokenId)
                return next
              })

              return
            }
          }
        }
      }

      let latestTx: Transaction[] = []
      if (needsChronikLatestTx) {
        try {
          latestTx = await fetchAgoraTransactionsFromChronik(
            tokenId,
            undefined,
            {
              targetCount: 1,
              pageSize: 50,
              failOnError: true,
            },
            activeChronik,
          )
        } catch (err) {
          if (!fetchError && !etokenDbSummary) {
            console.error(`[Latest Tx Fetch Error] Token: ${name}, error:`, err)

            const currentRetryCount = retryCountRef.current.get(retryLatestKey) || 0

            if (currentRetryCount < 1) {
              // First retry
              retryCountRef.current.set(retryLatestKey, currentRetryCount + 1)
              console.log(`[Latest Tx Retry] Token: ${name}, retry attempt: ${currentRetryCount + 1}`)

              setErrorTokens((prev) => {
                const next = new Set(prev)
                next.add(tokenId)
                return next
              })

              setTimeout(() => {
                if (
                  !cancelledRef.current &&
                  (options?.ignoreFilter || !filteredTokensRef.current.has(tokenId))
                ) {
                  loadingTokens.current.delete(tokenId)
                  const timeoutId = loadingTimeouts.current.get(tokenId)
                  if (timeoutId) {
                    clearTimeout(timeoutId)
                    loadingTimeouts.current.delete(tokenId)
                  }
                  loadTokenStatsRef.current?.(tokenId, name, options)
                }
              }, 3000)

              return
            } else {
              // Second failure - mark as failed
              console.log(`[Latest Tx Failed] Token: ${name}, failed after retry`)
              retryCountRef.current.delete(retryLatestKey)

              setFailedDataTokens((prev) => {
                const next = new Set(prev)
                next.add(tokenId)
                return next
              })

              setLoadedTokens((prev) => {
                if (prev.has(tokenId)) return prev
                const next = new Set(prev)
                next.add(tokenId)
                return next
              })

              setErrorTokens((prev) => {
                const next = new Set(prev)
                next.add(tokenId)
                return next
              })

              return
            }
          } else if (etokenDbSummary) {
            console.warn(
              `[Latest Tx Fetch Warning] Token: ${name}, using etokendb stats with cached price fields`,
            )
          }
        }
      }

      const {
        latestPrice: price24h,
        priceChange24h: chronikPriceChange24h,
        last24HoursXECAmount: chronik24hVolume,
        latestBlockHeight,
      } = compute24hStats(tx24h, effectiveTipHeight ?? chainTipHeight, null)

      const rawLatestPrice =
        shouldUseEtokenDbLatestPrice
          ? etokenDbSummary!.latestPriceXec
          : price24h > 0
            ? price24h
            : (latestTx[0]?.price || 0) || fallbackLatestPrice
      const priceChange24h =
        shouldUseEtokenDbPriceChange
          ? etokenDbSummary!.priceChange24h
          : tx24h.length > 0 || latestTx.length > 0
            ? chronikPriceChange24h
            : fallbackPriceChange24h
      const last24HoursXECAmount = etokenDbSummary?.last24HoursXECAmount ?? chronik24hVolume

      if (etokenDbSummary) {
        last30DaysXECAmount = etokenDbSummary.last7DaysXECAmount
        last30DaysVolumeXECAmount = etokenDbSummary.has30DayVolume
          ? etokenDbSummary.last30DaysVolumeXECAmount
          : fallback30DayVolume
        totalTransactions30d = etokenDbSummary.recent7dTradeCount
        latestProcessedHeight =
          typeof etokenDbSummary.lastTradeBlockHeight === "number"
            ? etokenDbSummary.lastTradeBlockHeight
            : latestProcessedHeight
      } else {
        if (cacheValid && typeof latestProcessedHeight === "number") {
          const deltaTx = tx24h.filter(
            (tx) => typeof tx.blockHeight === "number" && tx.blockHeight > latestProcessedHeight!,
          )
          const deltaVolume = deltaTx.reduce(
            (sum, tx) => sum + (tx.price || 0) * (tx.amount || 0),
            0,
          )
          last30DaysXECAmount += deltaVolume
          totalTransactions30d += deltaTx.length
        }

        if (!cacheValid) {
          const totalTransactionsScanned = pagesRead * 200
          console.log(`[Large Dataset Check] Token: ${name}, pages read: ${pagesRead}, total scanned: ${totalTransactionsScanned}`)

          if (pagesRead >= 3) {
            console.log(`[Large Dataset] Token ${name} required ${pagesRead} pages (${totalTransactionsScanned}+ transactions), marking as large dataset`)
            setLargeDatasetTokens((prev) => {
              if (prev.has(tokenId)) return prev
              const next = new Set(prev)
              next.add(tokenId)
              return next
            })

            if (!approvedLargeTokens.has(tokenId) && !approvedLargeTokensRef.current.has(tokenId)) {
              console.log(`[Large Dataset] Token ${name} not approved, skipping 7D data fetch`)
              const tokenConfig = Object.values(tokens).find((t) => t.tokenId === tokenId)
              const customTokens = getCustomTokens()

              if (!cancelledRef.current) {
                applyTokenUpdate(tokenId, {
                  tokenId,
                  name,
                  latestPrice: rawLatestPrice,
                  priceChange24h,
                  last24HoursXECAmount,
                  last30DaysXECAmount: 0,
                  last30DaysVolumeXECAmount: 0,
                  totalTransactions: 0,
                  totalXECAmount: 0,
                  has30DayVolume: false,
                  official: tokenConfig?.official || false,
                  gratitude: tokenConfig?.gratitude || false,
                  community: tokenConfig?.community || false,
                  stablecoin: tokenConfig?.stablecoin || false,
                  apyTag: tokenConfig?.apyTag,
                  watchlist: customTokens.includes(tokenId),
                })

                setLoadedTokens((prev) => {
                  if (prev.has(tokenId)) return prev
                  const next = new Set(prev)
                  next.add(tokenId)
                  return next
                })
              }

              loadingTokens.current.delete(tokenId)
              const timeoutId = loadingTimeouts.current.get(tokenId)
              if (timeoutId) {
                clearTimeout(timeoutId)
                loadingTimeouts.current.delete(tokenId)
              }

              return
            }
          }
          try {
            let tx7dCount = 0
            let rawPagesRead = 0
            const isUserApproved = approvedLargeTokens.has(tokenId) || approvedLargeTokensRef.current.has(tokenId)
            console.log(`[7D Load Start] Token: ${name}, isUserApproved: ${isUserApproved}`)

            const tx7d = await fetchAgoraTransactionsFromChronik(
              tokenId,
              (batch, meta) => {
                tx7dCount += batch.length
                rawPagesRead = meta.rawPage + 1
                console.log(`[7D Batch] Token: ${name}, rawPage: ${rawPagesRead}, agora txs: ${batch.length}, total agora: ${tx7dCount}`)
                // 只有在用户未批准时才检查原始页数限制
                if (!isUserApproved && rawPagesRead >= 5) {
                  console.log(`[7D Abort] Token: ${name}, exceeded 5 raw pages (${rawPagesRead}), stopping`)
                  return true  // 返回 true 通知停止加载
                }
                return false
              },
              {
                targetCount: 1400,
                pageSize: 200,
                maxBlocksBack: BLOCKS_PER_7_DAYS,
                stopBelowHeight:
                  typeof effectiveTipHeight === "number"
                    ? Math.max(effectiveTipHeight - BLOCKS_PER_7_DAYS, 0)
                    : undefined,
                failOnError: true,
              },
              activeChronik
            )

            if (!isUserApproved && rawPagesRead >= 5) {
              console.log(`[Large Dataset] Token ${name} exceeded 5 raw pages in 7D (actual: ${rawPagesRead} pages, ${tx7dCount} agora txs), marking as large dataset`)
              setLargeDatasetTokens((prev) => {
                if (prev.has(tokenId)) return prev
                const next = new Set(prev)
                next.add(tokenId)
                return next
              })

              const tokenConfig = Object.values(tokens).find((t) => t.tokenId === tokenId)
              const customTokens = getCustomTokens()

              if (!cancelledRef.current) {
                applyTokenUpdate(tokenId, {
                  tokenId,
                  name,
                  latestPrice: rawLatestPrice,
                  priceChange24h,
                  last24HoursXECAmount,
                  last30DaysXECAmount: 0,
                  last30DaysVolumeXECAmount: 0,
                  totalTransactions: 0,
                  totalXECAmount: 0,
                  has30DayVolume: false,
                  official: tokenConfig?.official || false,
                  gratitude: tokenConfig?.gratitude || false,
                  community: tokenConfig?.community || false,
                  stablecoin: tokenConfig?.stablecoin || false,
                  apyTag: tokenConfig?.apyTag,
                  watchlist: customTokens.includes(tokenId),
                })

                setLoadedTokens((prev) => {
                  if (prev.has(tokenId)) return prev
                  const next = new Set(prev)
                  next.add(tokenId)
                  return next
                })
              }

              loadingTokens.current.delete(tokenId)
              const timeoutId = loadingTimeouts.current.get(tokenId)
              if (timeoutId) {
                clearTimeout(timeoutId)
                loadingTimeouts.current.delete(tokenId)
              }

              return
            }

            const confirmed7d = tx7d.filter((tx) => typeof tx.blockHeight === "number")
            last30DaysXECAmount = confirmed7d.reduce(
              (sum, tx) => sum + (tx.price || 0) * (tx.amount || 0),
              0,
            )
            totalTransactions30d = confirmed7d.length
            const maxHeight = confirmed7d.reduce<number | null>((max, tx) => {
              if (typeof tx.blockHeight !== "number") return max
              if (max === null) return tx.blockHeight
              return Math.max(max, tx.blockHeight)
            }, null)
            if (typeof maxHeight === "number") {
              latestProcessedHeight = maxHeight
            }

            // Clear retry count on success
            retryCountRef.current.delete(retry7dKey)
          } catch (err) {
            console.error(`[7D Fetch Error] Token: ${name}, error:`, err)

            const currentRetryCount = retryCountRef.current.get(retry7dKey) || 0

            if (currentRetryCount < 1) {
              // First retry
              retryCountRef.current.set(retry7dKey, currentRetryCount + 1)
              console.log(`[7D Retry] Token: ${name}, retry attempt: ${currentRetryCount + 1}`)

              setErrorTokens((prev) => {
                const next = new Set(prev)
                next.add(tokenId)
                return next
              })

              setTimeout(() => {
                if (
                  !cancelledRef.current &&
                  (options?.ignoreFilter || !filteredTokensRef.current.has(tokenId))
                ) {
                  loadingTokens.current.delete(tokenId)
                  const timeoutId = loadingTimeouts.current.get(tokenId)
                  if (timeoutId) {
                    clearTimeout(timeoutId)
                    loadingTimeouts.current.delete(tokenId)
                  }
                  loadTokenStatsRef.current?.(tokenId, name, options)
                }
              }, 3000)

              return
            } else {
              // Second failure - mark as failed
              console.log(`[7D Failed] Token: ${name}, failed after retry`)
              retryCountRef.current.delete(retry7dKey)

              setFailedDataTokens((prev) => {
                const next = new Set(prev)
                next.add(tokenId)
                return next
              })

              setLoadedTokens((prev) => {
                if (prev.has(tokenId)) return prev
                const next = new Set(prev)
                next.add(tokenId)
                return next
              })

              setErrorTokens((prev) => {
                const next = new Set(prev)
                next.add(tokenId)
                return next
              })

              return
            }
          }
        }
      }

      if (typeof latestBlockHeight === "number") {
        latestProcessedHeight =
          typeof latestProcessedHeight === "number"
            ? Math.max(latestProcessedHeight, latestBlockHeight)
            : latestBlockHeight
      }

      const tokenConfig = Object.values(tokens).find((t) => t.tokenId === tokenId)
      const customTokens = getCustomTokens()
      const latestPrice = rawLatestPrice
      const savedAt = Date.now()

      const tokenSnapshot = {
        id: tokenId,
        tokenId,
        name,
        latestPrice,
        priceChange24h,
        last24HoursXECAmount,
        last30DaysXECAmount,
        last30DaysVolumeXECAmount,
        totalTransactions: totalTransactions30d,
        totalXECAmount: last30DaysVolumeXECAmount,
        has30DayVolume: etokenDbSummary?.has30DayVolume ?? fallbackHas30DayVolume,
        official: tokenConfig?.official || false,
        gratitude: tokenConfig?.gratitude || false,
        community: tokenConfig?.community || false,
        stablecoin: tokenConfig?.stablecoin || false,
        apyTag: tokenConfig?.apyTag,
        watchlist: customTokens.includes(tokenId),
      }

      if (!cancelledRef.current) {
        applyTokenUpdate(tokenId, tokenSnapshot)
      }

      if (!fetchError && !cancelledRef.current) {
        setCachedTokenData(tokenId, {
          computedAt: savedAt,
          latestProcessedHeight: latestProcessedHeight || 0,
          last30DaysXECAmount,
          totalTransactions: totalTransactions30d,
        })
        if (!etokenDbAvailable) {
          setCachedTokenSummary(tokenId, {
            computedAt: savedAt,
            data: tokenSnapshot,
          })
        }

        setFailedDataTokens((prev) => {
          if (!prev.has(tokenId)) return prev
          const next = new Set(prev)
          next.delete(tokenId)
          return next
        })

        // Clear retry count on successful save
        retryCountRef.current.delete(retry24hKey)
        retryCountRef.current.delete(retryLatestKey)
        retryCountRef.current.delete(retry7dKey)
      }

      if (!cancelledRef.current) {
        setLoadedTokens((prev) => {
          if (prev.has(tokenId)) return prev
          const next = new Set(prev)
          next.add(tokenId)
          return next
        })

        if (!fetchError) {
          setErrorTokens((prev) => {
            if (!prev.has(tokenId)) return prev
            const next = new Set(prev)
            next.delete(tokenId)
            return next
          })
        }
      }
    } finally {
      const timeoutId = loadingTimeouts.current.get(tokenId)
      if (timeoutId) {
        clearTimeout(timeoutId)
        loadingTimeouts.current.delete(tokenId)
      }
      
      loadingTokens.current.delete(tokenId)
    }
  }

  const loadTokenStatsRef = React.useRef(loadTokenStats)
  React.useEffect(() => {
    loadTokenStatsRef.current = loadTokenStats
  }, [loadTokenStats])

  const CUSTOM_TOKENS_KEY = 'custom_watchlist_tokens'

  const getCustomTokens = (): string[] => {
    try {
      const stored = localStorage.getItem(CUSTOM_TOKENS_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (_error) {
      return []
    }
  }

  const customTokenOrder = React.useMemo(() => {
    const customTokens = getCustomTokens()
    return new Map(customTokens.map((tokenId, index) => [tokenId, index]))
  }, [refreshNonce])

  const addCustomToken = (tokenId: string): boolean => {
    try {
      const isInConfig = Object.values(tokens).some(t => t.tokenId === tokenId)
      if (isInConfig) {
        throw new Error('Token already exists in the default list')
      }

      const current = getCustomTokens()

      if (!current.includes(tokenId)) {
        const updated = [...current, tokenId]
        localStorage.setItem(CUSTOM_TOKENS_KEY, JSON.stringify(updated))
      }
      return true
    } catch (error) {
      throw error
    }
  }

  const isValidTokenId = (id: string): boolean => {
    return /^[a-fA-F0-9]{64}$/.test(id)
  }

  const trimmedSearchInput = searchInput.trim()
  const isSearchTokenId = isValidTokenId(trimmedSearchInput)

  const closeLookupDialog = () => {
    setLookupDialogOpen(false)
    setTokenLookup(EMPTY_TOKEN_LOOKUP_STATE)
    setSearchInput("")
    setSearchExpanded(false)
  }

  const handleSearchToken = async (tokenIdOverride?: string) => {
    const tokenId = (tokenIdOverride ?? trimmedSearchInput).trim()

    if (!isValidTokenId(tokenId) || isChronikLoading || !chronikClient) {
      return
    }

    setLookupDialogOpen(true)
    setTokenLookup({
      status: "loading",
      tokenId,
      tokenInfo: null,
    })

    try {
      const isListed = data.some(
        (token) => token.tokenId.toLowerCase() === tokenId.toLowerCase(),
      )

      if (isListed) {
        setTokenLookup({
          status: "listed",
          tokenId,
          tokenInfo: null,
        })
        return
      }

      const tokenInfo = await fetchTokenDetails(tokenId, chronikClient)

      setTokenLookup({
        status: tokenInfo ? "found" : "not-found",
        tokenId,
        tokenInfo: tokenInfo ?? null,
      })
    } catch (_error) {
      setTokenLookup({
        status: "not-found",
        tokenId,
        tokenInfo: null,
      })
    }
  }

  const handleAddToWatchlist = async () => {
    const tokenIdToAdd = tokenLookup.tokenInfo?.tokenId || tokenLookup.tokenId

    if (!tokenIdToAdd || !isValidTokenId(tokenIdToAdd)) {
      return
    }

    setIsAddingToWatchlist(true)
    
    try {
      const added = addCustomToken(tokenIdToAdd)
      if (!added) return
      
      closeLookupDialog()
      
      setRefreshNonce((n) => n + 1)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to add to watchlist",
        description: error instanceof Error ? error.message : "Failed to add token to watchlist",
      })
    } finally {
      setIsAddingToWatchlist(false)
    }
  }

  const removeCustomToken = (tokenId: string) => {
    try {
      const current = getCustomTokens()
      const updated = current.filter(id => id !== tokenId)
      localStorage.setItem(CUSTOM_TOKENS_KEY, JSON.stringify(updated))
      setRefreshNonce((n) => n + 1)
      try {
        window.dispatchEvent(
          new CustomEvent("token-watchlist-removed", { detail: { tokenId } }),
        )
      } catch (_error) {}
    } catch (_error) {}
  }

  React.useEffect(() => {
    if (isChronikLoading || !chronikClient) return

    const handleWatchlistAdd = async (event: Event) => {
      const customEvent = event as CustomEvent<{ tokenId?: string }>
      const tokenId = customEvent.detail?.tokenId
      if (!tokenId) return

      try {
        const details = await fetchTokenDetails(tokenId, chronikClient)
        const name = getTokenNameFromDetails(details)
        if (!name) return

        setData((prev) =>
          prev.some((t) => t.tokenId === tokenId)
            ? prev.map((t) =>
                t.tokenId === tokenId
                  ? {
                      ...t,
                      name,
                      hasResolvedTokenInfo: true,
                      watchlist: true,
                    }
                  : t,
              )
            : [
                ...prev,
                createInitialTokenRow(tokenId, name, {
                  hasResolvedTokenInfo: true,
                  watchlist: true,
                }),
              ],
        )

        setLoadedTokens((prev) => {
          const next = new Set(prev)
          next.delete(tokenId)
          return next
        })

        loadTokenStatsRef.current?.(tokenId, name, { ignoreFilter: true })
      } catch (_err) {
        console.error(`[watchlist] Failed to fetch token info for ${tokenId}`)
      }
    }

    window.addEventListener("token-watchlist-added", handleWatchlistAdd as EventListener)
    return () => {
      window.removeEventListener("token-watchlist-added", handleWatchlistAdd as EventListener)
    }
  }, [chronikClient, isChronikLoading])

  React.useEffect(() => {
    if (isChronikLoading || !chronikClient) return

    let isCancelled = false

    cancelledRef.current = false
    setIsLocalFallbackMode(false)

    const bootstrap = async () => {
      if (!chronikClient) {
        return
      }

      try {
        void fetchBlockchainInfo(chronikClient)
          .then((info) => {
            if (isCancelled) return
            setChainTipHeight(
              typeof info?.tipHeight === "number" ? info.tipHeight : null,
            )
          })
          .catch(() => {
            if (!isCancelled) {
              setChainTipHeight(null)
            }
          })

        const customTokenIds = getCustomTokens()
        const configuredTokensById = new Map(
          Object.values(tokens).map((tokenConfig) => [tokenConfig.tokenId, tokenConfig]),
        )
        const createBootstrapRows = (
          etokenDbTokens: Awaited<ReturnType<typeof fetchEtokenDbTopVolumeTokens>>,
          shouldUseConfiguredFallback: boolean,
        ): {
          bootstrapCandidates: BootstrapTokenCandidate[]
          initialTokens: TokenTableRow[]
          deferredWatchlistTokenIds: string[]
        } => {
          const bootstrapCandidateMap = new Map<string, BootstrapTokenCandidate>()
          const bootstrapCandidateOrder: string[] = []
          const deferredWatchlistTokenIds: string[] = []
          const upsertBootstrapCandidate = (candidate: BootstrapTokenCandidate) => {
            const existing = bootstrapCandidateMap.get(candidate.tokenId)
            if (existing) {
              bootstrapCandidateMap.set(candidate.tokenId, {
                tokenId: candidate.tokenId,
                fallbackName: existing.fallbackName ?? candidate.fallbackName,
                etokenDbToken: candidate.etokenDbToken ?? existing.etokenDbToken,
                patch: {
                  ...(existing.patch || {}),
                  ...(candidate.patch || {}),
                },
              })
              return
            }

            bootstrapCandidateMap.set(candidate.tokenId, candidate)
            bootstrapCandidateOrder.push(candidate.tokenId)
          }

          if (!shouldUseConfiguredFallback) {
            etokenDbTokens.forEach((token) => {
              const tokenConfig = configuredTokensById.get(token.tokenId)
              upsertBootstrapCandidate({
                tokenId: token.tokenId,
                fallbackName: tokenConfig?.name,
                etokenDbToken: token,
                patch: {
                  ...getConfiguredTokenPatch(
                    token.tokenId,
                    customTokenIds.includes(token.tokenId),
                  ),
                },
              })
            })
          }

          if (shouldUseConfiguredFallback) {
            Object.values(tokens).forEach((tokenConfig: any) => {
              upsertBootstrapCandidate({
                tokenId: tokenConfig.tokenId,
                fallbackName: tokenConfig.name,
                patch: getConfiguredTokenPatch(
                  tokenConfig.tokenId,
                  customTokenIds.includes(tokenConfig.tokenId),
                ),
              })
            })
          }

          if (shouldUseConfiguredFallback) {
            customTokenIds.forEach((customTokenId) => {
              upsertBootstrapCandidate({
                tokenId: customTokenId,
                patch: {
                  watchlist: true,
                },
              })
            })
          } else {
            customTokenIds.forEach((customTokenId) => {
              if (bootstrapCandidateMap.has(customTokenId)) {
                upsertBootstrapCandidate({
                  tokenId: customTokenId,
                  patch: {
                    watchlist: true,
                  },
                })
                return
              }

              deferredWatchlistTokenIds.push(customTokenId)
            })
          }

          const bootstrapCandidates = bootstrapCandidateOrder
            .map((tokenId) => bootstrapCandidateMap.get(tokenId) || null)
            .filter((candidate): candidate is BootstrapTokenCandidate => candidate !== null)

          const initialTokens = bootstrapCandidates.map((candidate) => {
            const tokenConfig = configuredTokensById.get(candidate.tokenId)
            const cachedTokenInfo = getCachedTokenDetails(candidate.tokenId)
            const fallbackDecimals =
              typeof tokenConfig?.decimals === "number" ? tokenConfig.decimals : 0
            const tokenDecimals = getTokenDecimalsFromDetails(cachedTokenInfo, fallbackDecimals)
            const hasResolvedTokenInfo =
              Boolean(cachedTokenInfo) || typeof tokenConfig?.decimals === "number"
            const tokenName =
              getTokenNameFromDetails(cachedTokenInfo, candidate.fallbackName) ||
              getTokenDisplayFallbackName(candidate.tokenId, candidate.fallbackName)
            const etokenDbPatch = candidate.etokenDbToken
              ? {
                  latestPrice:
                    candidate.etokenDbToken.hasLatestPrice && hasResolvedTokenInfo
                      ? nanosatsPerAtomToXec(
                          candidate.etokenDbToken.latestPriceNanosatsPerAtom,
                          tokenDecimals,
                        )
                      : 0,
                  priceChange24h: candidate.etokenDbToken.hasPriceChange24h
                    ? candidate.etokenDbToken.priceChange24h
                    : 0,
                  last24HoursXECAmount: candidate.etokenDbToken.last24HoursXECAmount,
                  last30DaysXECAmount: candidate.etokenDbToken.last7DaysXECAmount,
                  last30DaysVolumeXECAmount: candidate.etokenDbToken.last30DaysVolumeXECAmount,
                  totalTransactions: candidate.etokenDbToken.recent7dTradeCount,
                  totalXECAmount: candidate.etokenDbToken.last30DaysVolumeXECAmount,
                  has30DayVolume: candidate.etokenDbToken.has30DayVolume,
                  hasInitialMarketData: true,
                  hasResolvedTokenInfo,
                }
              : {
                  hasInitialMarketData: false,
                  hasResolvedTokenInfo,
                }

            return createInitialTokenRow(candidate.tokenId, tokenName, {
              ...(candidate.patch || {}),
              ...(etokenDbPatch || {}),
            })
          })

          return {
            bootstrapCandidates,
            initialTokens,
            deferredWatchlistTokenIds,
          }
        }

        const renderBootstrapRows = (
          etokenDbTokens: Awaited<ReturnType<typeof fetchEtokenDbTopVolumeTokens>>,
          shouldUseConfiguredFallback: boolean,
        ) => {
          const bootstrapRows = createBootstrapRows(
            etokenDbTokens,
            shouldUseConfiguredFallback,
          )

          if (isCancelled) {
            return bootstrapRows
          }

          setData(bootstrapRows.initialTokens)
          setLoadedTokens(
            new Set(
              bootstrapRows.initialTokens
                .filter((token) => token.hasInitialMarketData)
                .map((token) => token.tokenId),
            ),
          )
          setIsLoading(false)

          return bootstrapRows
        }

        const cachedTopVolumeTokens = getCachedTopVolumeTokens()
        let hasRenderedCachedRows = false
        if (cachedTopVolumeTokens?.length) {
          renderBootstrapRows(cachedTopVolumeTokens, false)
          hasRenderedCachedRows = true
        }

        let shouldUseConfiguredFallback = true
        let etokenDbTokens: Awaited<ReturnType<typeof fetchEtokenDbTopVolumeTokens>> = []
        try {
          etokenDbTokens = await fetchEtokenDbTopVolumeTokens()
          if (etokenDbTokens.length > 0) {
            shouldUseConfiguredFallback = false
            setCachedTopVolumeTokens(etokenDbTokens)
          }
        } catch (err) {
          console.error("[etokendb token list] Failed to fetch top-volume tokens:", err)
        }

        const bootstrapRows =
          shouldUseConfiguredFallback && hasRenderedCachedRows
            ? createBootstrapRows(cachedTopVolumeTokens || [], false)
            : renderBootstrapRows(etokenDbTokens, shouldUseConfiguredFallback)

        if (!isCancelled) {
          setIsLocalFallbackMode(
            shouldUseConfiguredFallback && !hasRenderedCachedRows,
          )
        }

        const {
          bootstrapCandidates,
          initialTokens,
          deferredWatchlistTokenIds,
        } = bootstrapRows

        if (isCancelled) return

        const tokensMissingTokenInfo = bootstrapCandidates.filter((candidate) => {
          if (!candidate.etokenDbToken) {
            return false
          }

          const tokenConfig = configuredTokensById.get(candidate.tokenId)
          if (typeof tokenConfig?.decimals === "number") {
            return false
          }

          return !getCachedTokenDetails(candidate.tokenId)
        })

        const hydrateMissingTokenInfo = async () => {
          let hydrateIndex = 0
          const hydrateNextCandidate = async () => {
            while (hydrateIndex < tokensMissingTokenInfo.length && !isCancelled) {
              const currentIndex = hydrateIndex++
              const candidate = tokensMissingTokenInfo[currentIndex]

              try {
                const tokenInfo = await fetchTokenDetails(candidate.tokenId, chronikClient)
                const tokenName =
                  getTokenNameFromDetails(tokenInfo, candidate.fallbackName) ||
                  getTokenDisplayFallbackName(candidate.tokenId, candidate.fallbackName)
                const tokenDecimals = getTokenDecimalsFromDetails(tokenInfo, 0)
                const latestPrice =
                  candidate.etokenDbToken && candidate.etokenDbToken.hasLatestPrice
                    ? nanosatsPerAtomToXec(
                        candidate.etokenDbToken.latestPriceNanosatsPerAtom,
                        tokenDecimals,
                      )
                    : 0

                if (!cancelledRef.current) {
                  applyTokenUpdate(candidate.tokenId, {
                    name: tokenName,
                    latestPrice,
                    hasResolvedTokenInfo: true,
                  })
                }
              } catch (err) {
                console.error(
                  `[token info] Failed to fetch token info for ${candidate.tokenId}:`,
                  err,
                )
              }
            }
          }

          await Promise.all([
            hydrateNextCandidate(),
            hydrateNextCandidate(),
            hydrateNextCandidate(),
            hydrateNextCandidate(),
          ])
        }

        void hydrateMissingTokenInfo()

        const loadDeferredWatchlistTokens = async () => {
          for (const tokenId of deferredWatchlistTokenIds) {
            if (isCancelled) {
              return
            }

            try {
              const details = await fetchTokenDetails(tokenId, chronikClient)
              const name = getTokenNameFromDetails(details)
              if (!name) {
                continue
              }

              if (!cancelledRef.current) {
                setData((prev) =>
                  prev.some((token) => token.tokenId === tokenId)
                    ? prev
                    : [
                        ...prev,
                        createInitialTokenRow(tokenId, name, {
                          watchlist: true,
                          hasResolvedTokenInfo: true,
                        }),
                      ],
                )
              }

              await loadTokenStatsRef.current?.(tokenId, name, { ignoreFilter: true })
            } catch (_err) {
              console.error(`[watchlist bootstrap] Failed to fetch token info for ${tokenId}`)
            }
          }
        }

        void loadDeferredWatchlistTokens()

        const tokensNeedingLoad = initialTokens.filter(
          (token) => !token.hasInitialMarketData,
        )

        if (tokensNeedingLoad.length === 0) {
          return
        }

        let index = 0
        const loadNext = async () => {
          while (index < tokensNeedingLoad.length && !isCancelled) {
            const currentIndex = index++
            const token = tokensNeedingLoad[currentIndex]
            await loadTokenStats(token.tokenId, token.name)
          }
        }

        // Start 3 concurrent workers
        await Promise.all([loadNext(), loadNext(), loadNext()])
      } catch (_error) {
        setIsLoading(false)
      }
    }

    bootstrap()
    return () => {
      isCancelled = true
      cancelledRef.current = true
      
      loadingTimeouts.current.forEach((timeoutId) => {
        clearTimeout(timeoutId)
      })
      loadingTimeouts.current.clear()
      loadingTokens.current.clear()
    }
  }, [refreshNonce, chronikClient, isChronikLoading])

  React.useEffect(() => {
    const tokenIds = data.map((t) => t.tokenId)
    const unsubscribe = watchAgoraTokens(tokenIds, (tokenId) => {
      if (cancelledRef.current) return
      if (filteredTokensRef.current.has(tokenId)) return

      const name =
        data.find((t) => t.tokenId === tokenId)?.name ||
        Object.values(tokens).find((t) => t.tokenId === tokenId)?.name ||
        tokenId.substring(0, 6)

      const scheduleReload = async () => {
        const delayMs = (await isEtokenDbAvailable()) ? 2000 : 0
        const existingTimeout = wsReloadTimeouts.current.get(tokenId)
        if (existingTimeout) {
          clearTimeout(existingTimeout)
        }

        const timeoutId = setTimeout(() => {
          wsReloadTimeouts.current.delete(tokenId)
          if (cancelledRef.current) return
          if (filteredTokensRef.current.has(tokenId)) return

          setLoadedTokens((prev) => {
            const next = new Set(prev)
            next.delete(tokenId)
            return next
          })

          loadTokenStatsRef.current?.(tokenId, name)
        }, delayMs)

        wsReloadTimeouts.current.set(tokenId, timeoutId)
      }

      void scheduleReload()
    })

    return () => {
      unsubscribe()
    }
  }, [data])

  React.useEffect(() => {
    if (filterOption === 'all') {
      setFilteredTokens(new Set())
      return
    }

    setFilteredTokens((prevFiltered) => {
      const tokensToFilter = new Set<string>()

      data.forEach((token) => {
        if (token.watchlist) return

        const hasUsableData =
          hasRowMarketData(token) || prevFiltered.has(token.tokenId)
        if (!hasUsableData) return
        
        if (filterOption === 'no-trades-30d') {
          if (token.totalTransactions === 0) {
            tokensToFilter.add(token.tokenId)
          }
        } else if (filterOption === 'low-volume-30d') {
          if (!token.has30DayVolume || token.totalXECAmount < 1000000) {
            tokensToFilter.add(token.tokenId)
          }
        } else if (filterOption === 'low-trades-30d') {
          if (token.totalTransactions < 50) {
            tokensToFilter.add(token.tokenId)
          }
        }
      })

      return tokensToFilter
    })
  }, [filterOption, data, loadedTokens, hasRowMarketData])

  React.useEffect(() => {
    filteredTokensRef.current = filteredTokens
  }, [filteredTokens])

  React.useEffect(() => {
    const prev = prevFilteredTokensRef.current
    const newlyUnfiltered = Array.from(prev).filter(
      (id) => !filteredTokens.has(id),
    )

    if (newlyUnfiltered.length > 0) {
      setLoadedTokens((prevLoaded) => {
        const next = new Set(prevLoaded)
        newlyUnfiltered.forEach((id) => next.delete(id))
        return next
      })

      newlyUnfiltered.forEach((id) => {
        const name =
          data.find((t) => t.tokenId === id)?.name ||
          Object.values(tokens).find((t) => t.tokenId === id)?.name ||
          id.substring(0, 6)

        loadTokenStatsRef.current?.(id, name)
      })
    }

    prevFilteredTokensRef.current = filteredTokens
  }, [filteredTokens, data])

  const sortedData = React.useMemo(() => {
    const filteredData = data.filter(token => !filteredTokens.has(token.tokenId));

    const sortFunction = (a: Token, b: Token) => {
      if (sortBy === '24h') {
        return b.last24HoursXECAmount - a.last24HoursXECAmount;
      } else if (sortBy === 'history') {
        return b.totalXECAmount - a.totalXECAmount;
      }
      return b.last30DaysXECAmount - a.last30DaysXECAmount;
    };

    return [...filteredData].sort((a, b) => {
      const aCustomTokenIndex = customTokenOrder.get(a.tokenId)
      const bCustomTokenIndex = customTokenOrder.get(b.tokenId)
      const aIsCustomToken = typeof aCustomTokenIndex === "number"
      const bIsCustomToken = typeof bCustomTokenIndex === "number"

      if (aIsCustomToken !== bIsCustomToken) {
        return aIsCustomToken ? -1 : 1
      }

      if (aIsCustomToken && bIsCustomToken) {
        const customOrderSort = bCustomTokenIndex! - aCustomTokenIndex!
        if (customOrderSort !== 0) {
          return customOrderSort
        }
      }

      const primarySort = sortFunction(a, b)
      if (primarySort !== 0) {
        return primarySort
      }

      const officialSort = Number(Boolean(b.official)) - Number(Boolean(a.official))
      if (officialSort !== 0) {
        return officialSort
      }

      const watchlistSort = Number(Boolean(b.watchlist)) - Number(Boolean(a.watchlist))
      if (watchlistSort !== 0) {
        return watchlistSort
      }

      return a.name.localeCompare(b.name)
    });
  }, [data, sortBy, filteredTokens, customTokenOrder]);

  const tableData = React.useMemo(() => {
    return sortedData
  }, [sortedData])

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.tokenId,
  })

  const MemoizedTableRow = React.memo(
    function TokenTableRow({ row, router, showUSD, xecPrice }: {
      row: any;
      router: any;
      showUSD: boolean;
      xecPrice: number;
    }) {
      return (
        <TableRow
          key={row.id}
          onClick={() => {
            router.push(
              `/${getTokenRouteParam(row.original)}`,
            )
          }}
        >
          {row.getVisibleCells().map((cell: any) => (
            <TableCell key={cell.id}>
              <div className={cn(
                highlightFields.get(row.original.tokenId)?.has(cell.column.id) && 
                "animate-highlight-fade"
              )}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </div>
            </TableCell>
          ))}
        </TableRow>
      )
    },
    (prevProps, nextProps) => {
      const prevData = prevProps.row.original;
      const nextData = nextProps.row.original;
      
      const dataFields = ['totalTransactions', 'last24HoursXECAmount', 'last30DaysXECAmount',
                          'priceChange24h', 'latestPrice', 'totalXECAmount',
                          'name', 'hasResolvedTokenInfo', 'hasInitialMarketData'] as const;
      const hasDataChanged = dataFields.some(field => prevData[field] !== nextData[field]);

      const hasDisplayModeChanged = prevProps.showUSD !== nextProps.showUSD;

      const hasPriceChanged = 
        prevProps.showUSD && 
        nextProps.showUSD && 
        (prevProps.xecPrice !== nextProps.xecPrice || prevData.latestPrice !== nextData.latestPrice);

      return !hasDataChanged && !hasDisplayModeChanged && !hasPriceChanged;
    }
  )

  MemoizedTableRow.displayName = 'MemoizedTableRow'

  if (isLoading || isChronikLoading || !chronikClient) {
    return (
      <Card className="relative overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="flex items-baseline gap-2">
              <AuroraText className="text-2xl font-semibold tracking-tight">eToken Market</AuroraText>
            </CardTitle>
            <CardDescription className="font-normal tracking-tight">Loading market data...</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-8"></div>
                <div className="h-8 w-8 bg-muted rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-32"></div>
                </div>
                <div className="h-4 bg-muted rounded w-20"></div>
                <div className="h-4 bg-muted rounded w-16"></div>
                <div className="h-4 bg-muted rounded w-24"></div>
                <div className="h-4 bg-muted rounded w-24"></div>
                <div className="h-4 bg-muted rounded w-16"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const styles = `
    @keyframes highlightFade {
      0% { color: rgb(59 130 246); }
      100% { color: inherit; }
    }

    .animate-highlight-fade {
      animation: highlightFade 1s ease-out;
    }
  `

  const lookupTokenName =
    tokenLookup.tokenInfo?.genesisInfo?.tokenName?.trim() || "Unknown token"
  const lookupTokenTicker = tokenLookup.tokenInfo?.genesisInfo?.tokenTicker?.trim()
  const lookupTokenUrl = tokenLookup.tokenInfo?.genesisInfo?.url?.trim()
  const lookupActionTokenId = tokenLookup.tokenInfo?.tokenId || tokenLookup.tokenId
  const listedLookupToken =
    tokenLookup.status === "listed"
      ? data.find(
          (token) => token.tokenId.toLowerCase() === tokenLookup.tokenId.toLowerCase(),
        ) ?? null
      : null
  const isLookupTokenAlreadyInData = Boolean(
    lookupActionTokenId &&
      data.some(
        (token) => token.tokenId.toLowerCase() === lookupActionTokenId.toLowerCase(),
      ),
  )
  const isLookupTokenInCustomList = Boolean(
    lookupActionTokenId && customTokenOrder.has(lookupActionTokenId),
  )
  const isLookupTokenAlreadyTracked =
    isLookupTokenAlreadyInData || isLookupTokenInCustomList
  const lookupStatusBadgeLabel =
    tokenLookup.status === "listed"
      ? "Already listed"
      : tokenLookup.status === "not-found"
          ? "Unavailable"
          : null
  const lookupDialogTitle =
    tokenLookup.status === "loading"
      ? "Searching token"
      : tokenLookup.status === "listed"
        ? "Token already listed"
        : tokenLookup.status === "found"
          ? "Token details"
          : "Token lookup"

  return (
    <>
      <style>{styles}</style>
      <TooltipProvider delayDuration={0} skipDelayDuration={0}>
      <Card className="relative overflow-hidden">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-baseline gap-2">
                <AuroraText className="text-2xl font-semibold tracking-tight">eToken Market</AuroraText>
                {chainTipHeight && (
                  <span className="text-xs font-normal tracking-tight text-muted-foreground">
                    # {chainTipHeight.toLocaleString()}
                  </span>
                )}
              </CardTitle>
              <CardDescription className="font-normal tracking-tight">
                Agora sales data. Showing the 100 tokens with the highest 7-day trading volume.
              </CardDescription>
            </div>

            <div className="flex w-full flex-col gap-3 lg:max-w-3xl lg:items-end">
              <div className="flex w-full flex-wrap items-center gap-2 lg:justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Filter tokens"
                      title="Filter tokens"
                      className={cn(
                        filterOption !== "all" &&
                          "border-primary/30 text-primary hover:text-primary",
                      )}
                    >
                      <Filter className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72">
                    {FILTER_OPTIONS.map((option) => (
                      <DropdownMenuItem
                        key={option.value}
                        onSelect={() => setFilterOption(option.value)}
                        className={cn(
                          "cursor-pointer",
                          filterOption === option.value && "bg-accent",
                        )}
                      >
                        <div className="flex w-full items-center justify-between gap-3">
                          <div className="flex flex-col gap-0.5">
                            <span>{option.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {option.summary}
                            </span>
                          </div>
                          {filterOption === option.value && (
                            <CheckCircle className="size-4 text-primary" />
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {isLocalFallbackMode ? (
                  <AlertDialog
                    open={showClearCacheConfirm}
                    onOpenChange={setShowClearCacheConfirm}
                  >
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="icon" aria-label="Rebuild table">
                        <RotateCcw className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Clear cached token data?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This rebuilds the market table from scratch and refreshes cached token stats and icons.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={clearCacheAndReload}>
                          Clear cache
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}

                {searchExpanded ? (
                  <div
                    ref={searchContainerRef}
                    className="flex w-full items-center gap-2 rounded-2xl border border-border/60 bg-background/70 px-3 py-2 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-background/55 dark:border-white/[0.08] dark:bg-white/[0.03] sm:w-auto sm:min-w-[19rem]"
                  >
                    <Search className="size-4 shrink-0 text-muted-foreground/70" />
                    <Input
                      type="text"
                      placeholder="Enter token ID"
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      className="h-8 w-full border-0 bg-transparent px-0 text-sm shadow-none placeholder:text-muted-foreground/55 focus-visible:ring-0 focus-visible:ring-offset-0"
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && isSearchTokenId) {
                          event.preventDefault()
                          void handleSearchToken()
                        }
                      }}
                    />
                    {isSearchTokenId && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-xl text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                        onClick={() => void handleSearchToken()}
                        disabled={
                          isChronikLoading ||
                          (tokenLookup.status === "loading" &&
                            tokenLookup.tokenId === trimmedSearchInput)
                        }
                        aria-label="Search token"
                      >
                        {tokenLookup.status === "loading" &&
                        tokenLookup.tokenId === trimmedSearchInput
                          ? "..."
                          : <Search className="size-4" />}
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-xl text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                      onClick={() => {
                        setSearchExpanded(false)
                        setSearchInput("")
                      }}
                      aria-label="Close token search"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSearchExpanded(true)}
                    aria-label="Search by token ID"
                  >
                    <Search className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tableData.length > 0 ? (
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const sortType = 
                        header.id === 'last24HoursXECAmount'
                          ? '24h'
                          : header.id === 'last30DaysXECAmount'
                          ? '7d'
                          : header.id === 'totalXECAmount'
                          ? 'history'
                          : null;
                      return (
                        <TableHead key={header.id}>
                          {sortType ? (
                            <div className="flex items-center">
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                              <button
                                className={cn(
                                  "ml-2 rounded p-1 transition-colors hover:bg-accent",
                                  sortBy === sortType && "bg-accent/60",
                                )}
                                onClick={() => sortType && setSortBy(sortType)}
                              >
                                {sortBy === sortType ? (
                                  <ArrowDown className="h-4 w-4 text-foreground" />
                                ) : (
                                  <ArrowUp className="h-4 w-4 text-muted-foreground/70" />
                                )}
                              </button>
                            </div>
                          ) : (
                            flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )
                          )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <MemoizedTableRow 
                    key={row.id} 
                    row={row} 
                    router={router}
                    showUSD={showUSD}
                    xecPrice={xecPrice}
                  />
                ))}
              </TableBody>
            </Table>
          ) : (
            <div>No data available.</div>
          )}
        </CardContent>
      </Card>
      </TooltipProvider>

      <Dialog
        open={lookupDialogOpen}
        onOpenChange={(open) => {
          setLookupDialogOpen(open)
          if (!open) {
            setTokenLookup(EMPTY_TOKEN_LOOKUP_STATE)
          }
        }}
      >
        <DialogContent className="overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="gap-3 border-b bg-muted/10 px-6 py-5 pr-14">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle>{lookupDialogTitle}</DialogTitle>
              {lookupStatusBadgeLabel ? (
                <Badge
                  variant={tokenLookup.status === "not-found" ? "outline" : "secondary"}
                >
                  {lookupStatusBadgeLabel}
                </Badge>
              ) : null}
            </div>
            <DialogDescription className="max-w-2xl">
              Search for an on-chain token by full token ID.
            </DialogDescription>
          </DialogHeader>

          {tokenLookup.status === "loading" ? (
            <div className="flex min-h-[18rem] flex-col items-center justify-center gap-5 px-6 py-10 text-center">
              <div className="flex size-14 items-center justify-center rounded-full border bg-muted/20">
                <Spinner className="size-6" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-base font-semibold">Fetching token metadata</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Looking up this token on Chronik and checking whether it already appears in the market table.
                </p>
              </div>
              <div className="w-full max-w-xl">
                <LookupMetaCard label="Token ID" value={tokenLookup.tokenId} mono />
              </div>
            </div>
          ) : tokenLookup.status === "listed" ? (
            <div className="flex flex-col gap-5 px-6 py-5">
              <Alert className="border-primary/15 bg-primary/5">
                <CheckCircle className="size-4 text-primary" />
                <AlertTitle>
                  {listedLookupToken?.name || "This token is already listed"}
                </AlertTitle>
                <AlertDescription>
                  It already appears in the market table, so you can jump straight to the token page instead of listing it again.
                </AlertDescription>
              </Alert>

              <div className="grid gap-3 sm:grid-cols-2">
                <LookupMetaCard label="Token ID" value={tokenLookup.tokenId} mono />
                <LookupMetaCard
                  label="Market status"
                  value="Listed and available in Agora market"
                />
              </div>

              <DialogFooter className="gap-2 border-t pt-4 sm:justify-between">
                <Button variant="outline" onClick={closeLookupDialog}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    closeLookupDialog()
                    router.push(`/${getTokenRouteParam({ tokenId: tokenLookup.tokenId })}`)
                  }}
                >
                  Open token
                </Button>
              </DialogFooter>
            </div>
          ) : tokenLookup.status === "found" && tokenLookup.tokenInfo ? (
            <div className="flex flex-col gap-5 px-6 py-5">
              <div className="rounded-2xl border bg-muted/15 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <p className="text-xl font-semibold tracking-tight">
                      {lookupTokenName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {lookupTokenTicker || "No ticker available"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      {tokenLookup.tokenInfo.tokenType?.protocol || "Unknown"}
                    </Badge>
                    <Badge variant="outline">
                      {tokenLookup.tokenInfo.tokenType?.type || "Unknown"}
                    </Badge>
                    <Badge variant="outline">
                      {tokenLookup.tokenInfo.genesisInfo?.decimals ?? "N/A"} decimals
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <LookupMetaCard
                  label="Token ID"
                  value={tokenLookup.tokenInfo.tokenId}
                  mono
                />
                <LookupMetaCard
                  label="Block height"
                  value={tokenLookup.tokenInfo.block?.height ?? "N/A"}
                />
                <LookupMetaCard label="Name" value={lookupTokenName} />
                <LookupMetaCard label="Ticker" value={lookupTokenTicker || "N/A"} />
              </div>

              {lookupTokenUrl && (
                <LookupMetaCard
                  label="Project URL"
                  value={
                    <a
                      href={lookupTokenUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block break-all font-mono text-xs text-primary underline-offset-4 hover:underline sm:text-sm"
                    >
                      {lookupTokenUrl}
                    </a>
                  }
                />
              )}

              <DialogFooter className="gap-2 border-t pt-4 sm:justify-between">
                <Button variant="outline" onClick={closeLookupDialog}>
                  Close
                </Button>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    onClick={handleAddToWatchlist}
                    disabled={isAddingToWatchlist || isLookupTokenAlreadyTracked}
                    className="gap-2"
                  >
                    {isAddingToWatchlist ? (
                      <Spinner data-icon="inline-start" />
                    ) : isLookupTokenAlreadyTracked ? (
                      <CheckCircle data-icon="inline-start" />
                    ) : (
                      <Plus data-icon="inline-start" />
                    )}
                    {isAddingToWatchlist
                      ? "Adding..."
                      : isLookupTokenAlreadyTracked
                        ? "Already in list"
                        : "Add to Watchlist"}
                  </Button>
                </div>
              </DialogFooter>
            </div>
          ) : (
            <div className="flex flex-col gap-5 px-6 py-5">
              <Alert className="bg-muted/20">
                <AlertTriangle className="size-4 text-amber-500" />
                <AlertTitle>Token metadata unavailable</AlertTitle>
                <AlertDescription>
                  We could not fetch metadata for this token ID from Chronik. The token may be invalid, not indexed yet, or temporarily unavailable.
                </AlertDescription>
              </Alert>

              <LookupMetaCard label="Token ID" value={tokenLookup.tokenId} mono />

              <DialogFooter className="gap-2 border-t pt-4 sm:justify-between">
                <Button variant="outline" onClick={closeLookupDialog}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
