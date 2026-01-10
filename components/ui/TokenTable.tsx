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

import { ArrowUp, ArrowDown, DollarSign, Youtube, RotateCcw, AlertTriangle, Search, X, CheckCircle, Plus, ListPlus, Filter, Check } from "lucide-react"
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
import AllEtokensView from "@/components/ui/AllEtokensView"
import {
  AdScheduleView,
  AdStatus,
  AD_ADDRESS,
  findCurrentAdSponsoredTokenIdV2,
} from "@/components/ui/AdScheduleView"
import { formatNumber, formatPrice } from "@/lib/formatters"
import { Token, SortType, Transaction } from "@/lib/types"
import { TOKEN_IDS, UI_CONSTANTS } from "@/lib/constants"
import { fetchAgoraTransactionsFromChronik } from "@/lib/chronik-transactions"
import { fetchBlockchainInfo, chronik, fetchTokenDetails, getTokenAmountFromToken, getTokenDecimalsFromDetails } from "@/lib/chronik"
import {
  clearTokenCache,
  getCachedTokenData,
  setCachedTokenData,
  getCachedTokenSummary,
  setCachedTokenSummary,
  CACHE_TTL_MS,
  SUMMARY_CACHE_TTL_MS,
  BLOCKS_PER_MONTH,
  BLOCKS_PER_DAY,
  compute24hStats,
} from "@/lib/token-stats"
import { watchAgoraTokens } from "@/lib/agora-ws"
import { useToast } from "@/hooks/use-toast"
import { useWallet } from "@/lib/context/WalletContext"

const WATCHLIST_FREE_LIMIT = 3
const SS_UNLOCK_THRESHOLD = 1_000_000
const FILTER_OPTION_STORAGE_KEY = "token_table_filter_option_v1"

type TokenTableRow = Token & {
  isAd?: boolean
  adStatus?: AdStatus
  adTokenId?: string | null
  adTokenName?: string
  adTokenTicker?: string
}

type FilterOption = "all" | "no-trades-30d" | "low-volume-30d" | "low-trades-30d"

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
  const { toast } = useToast()
  const { isWalletConnected, userTokens } = useWallet()
  const [ssDecimals, setSsDecimals] = React.useState<number | null>(null)

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
  const [searchDialogOpen, setSearchDialogOpen] = React.useState(false)
  const [searchTokenInfo, setSearchTokenInfo] = React.useState<any>(null)
  const [isSearching, setIsSearching] = React.useState(false)
  const [isTokenListed, setIsTokenListed] = React.useState(false)
  const [filterOption, setFilterOption] = React.useState<FilterOption>(getStoredFilterOption)
  const [filteredTokens, setFilteredTokens] = React.useState<Set<string>>(new Set())
  const [showClearCacheConfirm, setShowClearCacheConfirm] = React.useState(false)
  const [tokenUpdatedAt, setTokenUpdatedAt] = React.useState<Map<string, number>>(new Map())
  const [isAddingToWatchlist, setIsAddingToWatchlist] = React.useState(false)
  const [viewMode, setViewMode] = React.useState<
    "normal" | "all-etokens" | "ad-schedule"
  >("normal")
  const [isAdGuideOpen, setIsAdGuideOpen] = React.useState(false)
  const searchContainerRef = React.useRef<HTMLDivElement | null>(null)
  const router = useRouter()
  
  const loadingTokens = React.useRef<Set<string>>(new Set())
  const loadingTimeouts = React.useRef<Map<string, NodeJS.Timeout>>(new Map())
  const clearCacheConfirmRef = React.useRef<HTMLDivElement | null>(null)
  const filteredTokensRef = React.useRef<Set<string>>(new Set())
  const prevFilteredTokensRef = React.useRef<Set<string>>(new Set())

  const [sortBy, setSortBy] = React.useState<SortType>('30d');

  const [highlightFields, setHighlightFields] = React.useState<Map<string, Set<string>>>(new Map());

  const xecPrice = useXECPrice();
  const cancelledRef = React.useRef(false)

  const [adStatus, setAdStatus] = React.useState<AdStatus>("loading")
  const [adTokenId, setAdTokenId] = React.useState<string | null>(null)
  const [adTokenName, setAdTokenName] = React.useState<string>("Loading...")
  const [adTokenTicker, setAdTokenTicker] = React.useState<string>("")

  React.useEffect(() => {
    let cancelled = false
    const loadAd = async () => {
      setAdStatus("loading")
      setAdTokenId(null)
      setAdTokenName("Loading...")
      setAdTokenTicker("")

      try {
        const { tokenId: sponsoredTokenId, tipHeight } =
          await findCurrentAdSponsoredTokenIdV2()
        if (cancelled) return
        if (typeof tipHeight === "number") {
          setChainTipHeight(tipHeight)
        }

        if (!sponsoredTokenId) {
          setAdStatus("empty")
          setAdTokenId(null)
          setAdTokenName("No ad today")
          setAdTokenTicker("")
          return
        }

        setAdTokenId(sponsoredTokenId)
        try {
          const details = await fetchTokenDetails(sponsoredTokenId)
          if (cancelled) return
          const name = details?.genesisInfo?.tokenName || sponsoredTokenId.substring(0, 6)
          const ticker = details?.genesisInfo?.tokenTicker || ""
          setAdTokenName(name)
          setAdTokenTicker(ticker)
        } catch (_e) {
          if (cancelled) return
          setAdTokenName(sponsoredTokenId.substring(0, 6))
          setAdTokenTicker("")
        }

        setAdStatus("ready")
      } catch (_e) {
        if (cancelled) return
        setAdStatus("error")
        setAdTokenId(null)
        setAdTokenName("Failed to load sponsor")
        setAdTokenTicker("")
      }
    }

    loadAd()
    return () => {
      cancelled = true
    }
  }, [refreshNonce])

  React.useEffect(() => {
    let cancelled = false
    const loadSsMeta = async () => {
      try {
        const detail = await fetchTokenDetails(TOKEN_IDS.STAR_SHARD)
        const decimals = getTokenDecimalsFromDetails(detail, 0)
        if (!cancelled) setSsDecimals(decimals)
      } catch (e) {
        if (!cancelled) setSsDecimals(0)
      }
    }
    loadSsMeta()
    return () => {
      cancelled = true
    }
  }, [])

  const isSsUnlocked = React.useMemo(() => {
    if (!isWalletConnected) return false
    if (ssDecimals === null) return false
    const rawAtoms = userTokens?.[TOKEN_IDS.STAR_SHARD] || "0"
    try {
      const atoms = BigInt(rawAtoms)
      const factor = 10n ** BigInt(ssDecimals)
      const required = BigInt(SS_UNLOCK_THRESHOLD) * factor
      return atoms >= required
    } catch {
      return false
    }
  }, [isWalletConnected, userTokens, ssDecimals])

  React.useEffect(() => {
    if (!searchExpanded) return

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
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
    if (!showClearCacheConfirm) return

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (clearCacheConfirmRef.current && !clearCacheConfirmRef.current.contains(event.target as Node)) {
        setShowClearCacheConfirm(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowClearCacheConfirm(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("touchstart", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("touchstart", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [showClearCacheConfirm])

  React.useEffect(() => {
    try {
      localStorage.setItem(FILTER_OPTION_STORAGE_KEY, filterOption)
    } catch (_error) {}
  }, [filterOption])

  const clearCacheAndReload = () => {
    clearTokenCache()
    setLoadedTokens(new Set())
    setLoadedIcons(new Set())
    setFailedIcons(new Set())
    setHighlightFields(new Map())
    setData([])
    setIsLoading(true)
    setRefreshNonce((n) => n + 1)
    setShowClearCacheConfirm(false)
  }

  const openAdGuide = (event?: React.MouseEvent) => {
    event?.stopPropagation()
    setIsAdGuideOpen(true)
  }

  const columns: ColumnDef<TokenTableRow>[] = [
    {
      id: "index",
      header: "#",
      cell: ({ row }) => {
        if (row.original.isAd) {
          return (
            <button
              type="button"
              className="text-sm font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700"
              onClick={openAdGuide}
            >
              AD
            </button>
          )
        }
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
                {index}
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
        if (row.original.isAd) {
          const effectiveTokenId = row.original.adTokenId || ""
          return (
            <div
              className={cn(
                "flex items-center gap-2 cursor-pointer hover:opacity-80",
                !effectiveTokenId && "cursor-default hover:opacity-100",
              )}
              onClick={() => {
                if (!effectiveTokenId) return
                router.push(`/${effectiveTokenId}`)
              }}
            >
              <Avatar className="h-8 w-8 relative overflow-hidden">
                {effectiveTokenId ? (
                  <img
                    src={`https://icons.etokens.cash/32/${effectiveTokenId}.png`}
                    alt={row.original.adTokenName || "Sponsored"}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <AvatarFallback>AD</AvatarFallback>
                )}
              </Avatar>
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {row.original.adTokenName || "Sponsored"}
                </span>
                {row.original.adTokenTicker ? (
                  <span className="text-xs text-muted-foreground">
                    {row.original.adTokenTicker}
                  </span>
                ) : null}
                <Badge
                  variant="default"
                  className="text-xs whitespace-nowrap bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 cursor-pointer"
                  onClick={openAdGuide}
                >
                  AD
                </Badge>
              </div>
            </div>
          )
        }
        const isRowLoading = isLoading || !loadedTokens.has(row.original.tokenId)
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
            onClick={() => router.push(`/${row.original.watchlist ? row.original.tokenId : row.original.name}`)}
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
        const isAdRow = row.original.isAd
        const tokenIdForLoad = isAdRow && row.original.adTokenId ? row.original.adTokenId : row.original.tokenId
        const isRowLoading = isAdRow
          ? !!row.original.adTokenId && (isLoading || !loadedTokens.has(tokenIdForLoad))
          : isLoading || !loadedTokens.has(tokenIdForLoad)
        if (isAdRow && !row.original.adTokenId) {
          return <div className="text-left text-muted-foreground"></div>
        }
        if (isRowLoading) {
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
        const isAdRow = row.original.isAd
        const tokenIdForLoad = isAdRow && row.original.adTokenId ? row.original.adTokenId : row.original.tokenId
        const isRowLoading = isAdRow
          ? !!row.original.adTokenId && (isLoading || !loadedTokens.has(tokenIdForLoad))
          : isLoading || !loadedTokens.has(tokenIdForLoad)
        if (isAdRow && !row.original.adTokenId) {
          return <div className="text-left text-muted-foreground"></div>
        }
        if (isRowLoading) {
          return <div className="text-left text-muted-foreground">Loading</div>
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
        const isAdRow = row.original.isAd
        const tokenIdForLoad = isAdRow && row.original.adTokenId ? row.original.adTokenId : row.original.tokenId
        const isRowLoading = isAdRow
          ? !!row.original.adTokenId && (isLoading || !loadedTokens.has(tokenIdForLoad))
          : isLoading || !loadedTokens.has(tokenIdForLoad)
        if (isAdRow && !row.original.adTokenId) {
          return <div className="text-left text-muted-foreground"></div>
        }
        if (isRowLoading) {
          return <div className="text-left text-muted-foreground">Loading</div>
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
      header: "30D Volume",
      cell: ({ row }) => {
        const isAdRow = row.original.isAd
        const tokenIdForLoad = isAdRow && row.original.adTokenId ? row.original.adTokenId : row.original.tokenId
        const isRowLoading = isAdRow
          ? !!row.original.adTokenId && (isLoading || !loadedTokens.has(tokenIdForLoad))
          : isLoading || !loadedTokens.has(tokenIdForLoad)
        if (isAdRow && !row.original.adTokenId) {
          return <div className="text-left text-muted-foreground"></div>
        }
        if (isRowLoading) {
          return <div className="text-left text-muted-foreground">Loading</div>
        }
        return (
          <div className="text-left">
            {formatNumber(row.original.last30DaysXECAmount || 0)} XEC
          </div>
        )
      },
    },
    {
      accessorKey: "totalTransactions",
      header: "Sales in 30D",
      cell: ({ row }) => {
        const isAdRow = row.original.isAd
        const tokenIdForLoad = isAdRow && row.original.adTokenId ? row.original.adTokenId : row.original.tokenId
        const isRowLoading = isAdRow
          ? !!row.original.adTokenId && (isLoading || !loadedTokens.has(tokenIdForLoad))
          : isLoading || !loadedTokens.has(tokenIdForLoad)
        if (isAdRow && !row.original.adTokenId) {
          return <div className="text-left text-muted-foreground"></div>
        }
        if (isRowLoading) {
          return <div className="text-left text-muted-foreground">loading</div>
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
      
      const summaryCached = getCachedTokenSummary(tokenId)
      const summaryCacheValid = !!summaryCached && now - summaryCached.computedAt < SUMMARY_CACHE_TTL_MS
    
      if (summaryCacheValid) {
        const tokenConfig = Object.values(tokens).find((t) => t.tokenId === tokenId)
        const customTokens = getCustomTokens()
        if (!cancelledRef.current) {
          applyTokenUpdate(tokenId, {
            ...summaryCached!.data,
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
      
      const cached = getCachedTokenData(tokenId)
      const cacheValid = !!cached && now - cached.computedAt < CACHE_TTL_MS

      let effectiveTipHeight = chainTipHeight
      if (typeof effectiveTipHeight !== "number") {
        try {
          const info = await fetchBlockchainInfo()
          if (typeof info?.tipHeight === "number") {
            effectiveTipHeight = info.tipHeight
            setChainTipHeight(info.tipHeight)
          }
        } catch (_err) {}
      }

      let last30DaysXECAmount = cacheValid ? cached!.last30DaysXECAmount : 0
      let totalTransactions30d = cacheValid ? cached!.totalTransactions : 0
      let latestProcessedHeight: number | null =
        typeof cached?.latestProcessedHeight === "number" ? cached.latestProcessedHeight : null

      let fetchError = false
      const tx24h: Transaction[] = []

      try {
        await fetchAgoraTransactionsFromChronik(
          tokenId,
          (batch) => {
            tx24h.push(...batch)
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
        )
      } catch (err) {
        fetchError = true
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
        }, 5000)

        return
      }

      let latestTx: Transaction[] = []
      try {
        latestTx = await fetchAgoraTransactionsFromChronik(
          tokenId,
          undefined,
          {
            targetCount: 1,
            pageSize: 50,
            failOnError: false,
          },
        )
      } catch (err) {
        if (!fetchError) {
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
          }, 5000)
          
          return
        }
      }

      const {
        latestPrice: price24h,
        priceChange24h,
        last24HoursXECAmount,
        latestBlockHeight,
      } = compute24hStats(tx24h, effectiveTipHeight ?? chainTipHeight, null)

      const rawLatestPrice = price24h > 0 ? price24h : (latestTx[0]?.price || 0)

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
        try {
          const tx30d = await fetchAgoraTransactionsFromChronik(tokenId, undefined, {
            targetCount: 800,
            pageSize: 200,
            maxBlocksBack: BLOCKS_PER_MONTH,
            stopBelowHeight:
              typeof effectiveTipHeight === "number"
                ? Math.max(effectiveTipHeight - BLOCKS_PER_MONTH, 0)
                : undefined,
            failOnError: false,
          })
          const confirmed30d = tx30d.filter((tx) => typeof tx.blockHeight === "number")
          last30DaysXECAmount = confirmed30d.reduce(
            (sum, tx) => sum + (tx.price || 0) * (tx.amount || 0),
            0,
          )
          totalTransactions30d = confirmed30d.length
          const maxHeight = confirmed30d.reduce<number | null>((max, tx) => {
            if (typeof tx.blockHeight !== "number") return max
            if (max === null) return tx.blockHeight
            return Math.max(max, tx.blockHeight)
          }, null)
          if (typeof maxHeight === "number") {
            latestProcessedHeight = maxHeight
          }
        } catch (err) {
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
          }, 5000)
          
          return
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

      if (!cancelledRef.current) {
        applyTokenUpdate(tokenId, {
          id: tokenId,
          tokenId,
          name,
          latestPrice,
          priceChange24h,
          last24HoursXECAmount,
          last30DaysXECAmount,
          totalTransactions: totalTransactions30d,
          totalXECAmount: last30DaysXECAmount,
          official: tokenConfig?.official || false,
          gratitude: tokenConfig?.gratitude || false,
          community: tokenConfig?.community || false,
          stablecoin: tokenConfig?.stablecoin || false,
          apyTag: tokenConfig?.apyTag,
          watchlist: customTokens.includes(tokenId),
        })
      }

      if (!fetchError && !cancelledRef.current) {
        setCachedTokenData(tokenId, {
          computedAt: Date.now(),
          latestProcessedHeight: latestProcessedHeight || 0,
          last30DaysXECAmount,
          totalTransactions: totalTransactions30d,
        })
        setCachedTokenSummary(tokenId, {
          computedAt: Date.now(),
          data: {
            id: tokenId,
            tokenId,
            name,
            latestPrice,
            priceChange24h,
            last24HoursXECAmount,
            last30DaysXECAmount,
            totalTransactions: totalTransactions30d,
            totalXECAmount: last30DaysXECAmount,
            official: tokenConfig?.official || false,
            gratitude: tokenConfig?.gratitude || false,
            community: tokenConfig?.community || false,
            stablecoin: tokenConfig?.stablecoin || false,
            apyTag: tokenConfig?.apyTag,
            watchlist: customTokens.includes(tokenId),
          },
        })
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

  React.useEffect(() => {
    if (!adTokenId) return
    const name = adTokenName || adTokenId.substring(0, 6)

    setData((prev) => {
      if (prev.some((t) => t.tokenId === adTokenId)) return prev
      return [
        ...prev,
        {
          id: adTokenId,
          tokenId: adTokenId,
          name,
          totalTransactions: 0,
          last24HoursXECAmount: 0,
          last30DaysXECAmount: 0,
          priceChange24h: 0,
          latestPrice: 0,
          totalXECAmount: 0,
          official: false,
          gratitude: false,
          community: false,
          stablecoin: false,
          apyTag: undefined,
          watchlist: false,
        },
      ]
    })

    setLoadedTokens((prev) => {
      const next = new Set(prev)
      next.delete(adTokenId)
      return next
    })

    loadTokenStatsRef.current?.(adTokenId, name, { ignoreFilter: true })
  }, [adTokenId, adTokenName])

  const CUSTOM_TOKENS_KEY = 'custom_watchlist_tokens'

  const getCustomTokens = (): string[] => {
    try {
      const stored = localStorage.getItem(CUSTOM_TOKENS_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (_error) {
      return []
    }
  }

  const addCustomToken = (tokenId: string): boolean => {
    try {
      const isInConfig = Object.values(tokens).some(t => t.tokenId === tokenId)
      if (isInConfig) {
        throw new Error('Token already exists in the default list')
      }

      const current = getCustomTokens()
      
      if (!current.includes(tokenId)) {
        if (!isSsUnlocked && current.length >= WATCHLIST_FREE_LIMIT) {
          toast({
            variant: "destructive",
            title: "Watchlist limit reached",
            description:
              `Free users can add up to ${WATCHLIST_FREE_LIMIT} custom tokens. Connect wallet and hold at least ${SS_UNLOCK_THRESHOLD.toLocaleString()} SS to unlock unlimited watchlist.`,
          })
          return false
        }

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

  const closeSearchDialog = () => {
    setSearchDialogOpen(false)
    setSearchInput("")
    setSearchExpanded(false)
    setSearchTokenInfo(null)
    setIsTokenListed(false)
  }

  const handleSearchToken = async () => {
    if (!isValidTokenId(searchInput)) {
      return
    }

    setIsSearching(true)
    setSearchTokenInfo(null)
    setIsTokenListed(false)

    try {
      const isListed = data.some(token => token.tokenId === searchInput)
      setIsTokenListed(isListed)

      if (!isListed) {
        const tokenInfo = await fetchTokenDetails(searchInput)
        setSearchTokenInfo(tokenInfo)
      }

      setSearchDialogOpen(true)
    } catch (_error) {
      setSearchDialogOpen(true)
    } finally {
      setIsSearching(false)
    }
  }

  const handleAddToWatchlist = async () => {
    const tokenIdToAdd = searchTokenInfo?.tokenId || searchInput

    if (!tokenIdToAdd || !isValidTokenId(tokenIdToAdd)) {
      return
    }

    setIsAddingToWatchlist(true)
    
    try {
      const added = addCustomToken(tokenIdToAdd)
      if (!added) return
      
      closeSearchDialog()
      
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
    const handleWatchlistAdd = async (event: Event) => {
      const customEvent = event as CustomEvent<{ tokenId?: string }>
      const tokenId = customEvent.detail?.tokenId
      if (!tokenId) return

      setData((prev) => {
        if (prev.some((t) => t.tokenId === tokenId)) return prev
        return [
          ...prev,
          {
            id: tokenId,
            tokenId,
            name: tokenId.substring(0, 6),
            totalTransactions: 0,
            last24HoursXECAmount: 0,
            last30DaysXECAmount: 0,
            priceChange24h: 0,
            latestPrice: 0,
            totalXECAmount: 0,
            official: false,
            gratitude: false,
            community: false,
            stablecoin: false,
            apyTag: undefined,
            watchlist: true,
          },
        ]
      })

      setLoadedTokens((prev) => {
        const next = new Set(prev)
        next.delete(tokenId)
        return next
      })

      try {
        const details = await fetchTokenDetails(tokenId)
        const name = details?.genesisInfo?.tokenName || tokenId.substring(0, 6)
        setData((prev) =>
          prev.map((t) =>
            t.tokenId === tokenId
              ? {
                  ...t,
                  name,
                  watchlist: true,
                }
              : t,
          ),
        )
        loadTokenStatsRef.current?.(tokenId, name, { ignoreFilter: true })
      } catch (_err) {
        const name = tokenId.substring(0, 6)
        loadTokenStatsRef.current?.(tokenId, name, { ignoreFilter: true })
      }
    }

    window.addEventListener("token-watchlist-added", handleWatchlistAdd as EventListener)
    return () => {
      window.removeEventListener("token-watchlist-added", handleWatchlistAdd as EventListener)
    }
  }, [])

  React.useEffect(() => {
    let isCancelled = false

    cancelledRef.current = false

    const bootstrap = async () => {
      try {
        try {
          const info = await fetchBlockchainInfo()
          setChainTipHeight(
            typeof info?.tipHeight === "number" ? info.tipHeight : null,
          )
        } catch (_err) {
          setChainTipHeight(null)
        }

        const customTokenIds = getCustomTokens()

        const initialTokens = Object.values(tokens).map((tokenConfig: any) => ({
          id: tokenConfig.tokenId,
          tokenId: tokenConfig.tokenId,
          name: tokenConfig.name,
          totalTransactions: 0,
          last24HoursXECAmount: 0,
          last30DaysXECAmount: 0,
          priceChange24h: 0,
          latestPrice: 0,
          totalXECAmount: 0,
          official: tokenConfig?.official || false,
          gratitude: tokenConfig?.gratitude || false,
          community: tokenConfig?.community || false,
          stablecoin: tokenConfig?.stablecoin || false,
          apyTag: tokenConfig?.apyTag,
          watchlist: customTokenIds.includes(tokenConfig.tokenId),
        }))

        for (const customTokenId of customTokenIds) {
          if (initialTokens.some(t => t.tokenId === customTokenId)) {
            continue
          }
          
          try {
            const tokenInfo = await fetchTokenDetails(customTokenId)
            
            const tokenName = tokenInfo?.genesisInfo?.tokenName || customTokenId.substring(0, 6)
            
            initialTokens.push({
              id: customTokenId,
              tokenId: customTokenId,
              name: tokenName,
              totalTransactions: 0,
              last24HoursXECAmount: 0,
              last30DaysXECAmount: 0,
              priceChange24h: 0,
              latestPrice: 0,
              totalXECAmount: 0,
              official: false,
              gratitude: false,
              community: false,
              stablecoin: false,
              apyTag: undefined,
              watchlist: true,
            })
          } catch (_error) {
            initialTokens.push({
              id: customTokenId,
              tokenId: customTokenId,
              name: customTokenId.substring(0, 6),
              totalTransactions: 0,
              last24HoursXECAmount: 0,
              last30DaysXECAmount: 0,
              priceChange24h: 0,
              latestPrice: 0,
              totalXECAmount: 0,
              official: false,
              gratitude: false,
              community: false,
              stablecoin: false,
              apyTag: undefined,
              watchlist: true,
            })
          }
        }

        if (isCancelled) return
        setData(initialTokens)
        setIsLoading(false)

        for (const token of initialTokens) {
          if (isCancelled) break
          await loadTokenStats(token.tokenId, token.name)
        }
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
  }, [refreshNonce])

  React.useEffect(() => {
    const tokenIds = Object.values(tokens).map((t) => t.tokenId)
    const unsubscribe = watchAgoraTokens(tokenIds, (tokenId) => {
      if (cancelledRef.current) return
      if (filteredTokensRef.current.has(tokenId)) return

      const name =
        data.find((t) => t.tokenId === tokenId)?.name ||
        Object.values(tokens).find((t) => t.tokenId === tokenId)?.name ||
        tokenId.substring(0, 6)

      setLoadedTokens((prev) => {
        const next = new Set(prev)
        next.delete(tokenId)
        return next
      })

      loadTokenStatsRef.current?.(tokenId, name)
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
          loadedTokens.has(token.tokenId) || prevFiltered.has(token.tokenId)
        if (!hasUsableData) return
        
        if (filterOption === 'no-trades-30d') {
          if (token.totalTransactions === 0) {
            tokensToFilter.add(token.tokenId)
          }
        } else if (filterOption === 'low-volume-30d') {
          if (token.last30DaysXECAmount < 1000000) {
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
  }, [filterOption, data, loadedTokens])

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
    
    const starshardToken = filteredData.find(token => token.tokenId === TOKEN_IDS.STAR_SHARD);
    
    const officialTokens = filteredData.filter(token => token.official === true && token.tokenId !== TOKEN_IDS.STAR_SHARD);
    const watchlistTokens = filteredData.filter(token => !token.official && token.watchlist === true && token.tokenId !== TOKEN_IDS.STAR_SHARD);
    const normalTokens = filteredData.filter(token => !token.official && !token.watchlist && token.tokenId !== TOKEN_IDS.STAR_SHARD);

    const sortFunction = (a: Token, b: Token) => {
      if (sortBy === '24h') {
        return b.last24HoursXECAmount - a.last24HoursXECAmount;
      } else if (sortBy === 'history') {
        return b.totalXECAmount - a.totalXECAmount;
      }
      return b.last30DaysXECAmount - a.last30DaysXECAmount;
    };

    const sortedWatchlist = [...watchlistTokens].sort(sortFunction);
    const sortedNormal = [...normalTokens].sort(sortFunction);

    const result = starshardToken 
      ? [starshardToken, ...officialTokens, ...sortedWatchlist, ...sortedNormal]
      : [...officialTokens, ...sortedWatchlist, ...sortedNormal];
    
    return result;
  }, [data, sortBy, filteredTokens]);

  const tableData = React.useMemo(() => {
    const adMetrics =
      adTokenId ? data.find((t) => t.tokenId === adTokenId) : undefined
    const adRow: TokenTableRow = {
      id: "AD",
      tokenId: adTokenId || "AD",
      name: adTokenName || "AD",
      totalTransactions: adMetrics?.totalTransactions ?? 0,
      last24HoursXECAmount: adMetrics?.last24HoursXECAmount ?? 0,
      last30DaysXECAmount: adMetrics?.last30DaysXECAmount ?? 0,
      priceChange24h: adMetrics?.priceChange24h ?? 0,
      latestPrice: adMetrics?.latestPrice ?? 0,
      totalXECAmount: adMetrics?.totalXECAmount ?? 0,
      official: false,
      gratitude: false,
      community: false,
      stablecoin: false,
      apyTag: undefined,
      watchlist: false,
      isAd: true,
      adStatus,
      adTokenId,
      adTokenName,
      adTokenTicker,
    }
    return [adRow, ...sortedData]
  }, [sortedData, adStatus, adTokenId, adTokenName, adTokenTicker, data])

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => (row.isAd ? "AD" : row.tokenId),
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
          className={cn(
            row.original.isAd &&
              "bg-gradient-to-r from-purple-500/10 to-pink-500/10",
          )}
          onClick={() => {
            if (row.original.isAd) {
              if (row.original.adTokenId) {
                router.push(`/${row.original.adTokenId}`)
              }
              return
            }
            router.push(
              `/${row.original.watchlist ? row.original.tokenId : row.original.name}`,
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
                          'priceChange24h', 'latestPrice', 'totalXECAmount'] as const;
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

  if (isLoading) {
    return <div>loading</div>
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

  return (
    <>
      <style>{styles}</style>
      <TooltipProvider delayDuration={0} skipDelayDuration={0}>
      <Dialog open={isAdGuideOpen} onOpenChange={setIsAdGuideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ad Creation Guide</DialogTitle>
            <DialogDescription>Use the same address for all steps:</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-foreground">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Hold 300,000 SS (StarShard) and the eToken you want to promote.</li>
              <li>Send 300,000 SS to the ad payment address (300k SS = 1 day; send more for multiple days).</li>
              <li>Send 1 unit of your eToken to the ad payment address.</li>
              <li>Ads run in payment order. Check "Ad Schedule" to see your slot. Your eToken displays when your turn comes.</li>
              <li>Important: You must send your eToken after payment, or it won't display.</li>
            </ol>
            <div className="space-y-1 text-sm font-semibold text-muted-foreground">
              <p>Ad payment address: <span className="font-mono break-all">{AD_ADDRESS}</span></p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdGuideOpen(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Card className="relative overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="flex items-baseline gap-2">
              <AuroraText className="text-lg font-bold tracking-tighter">eToken Market</AuroraText>
              {chainTipHeight && (
                <span className="text-xs text-muted-foreground font-normal">
                  # {chainTipHeight.toLocaleString()}
                </span>
              )}
            </CardTitle>
            <CardDescription>
              {viewMode === "normal"
                ? "Agora sales data"
                : viewMode === "all-etokens"
                  ? "All active eTokens on Agora"
                  : "Upcoming ad schedule (next 8 weeks)"}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1 border rounded-md p-1">
              <button
                onClick={() => setViewMode('normal')}
                className={cn(
                  "text-sm px-3 py-1  rounded-md transition-colors",
                  viewMode === 'normal' 
                    ? "bg-accent font-medium" 
                    : "hover:bg-accent/50 text-muted-foreground"
                )}
              >
                Listed Tokens
              </button>
              <button
                onClick={() => setViewMode("all-etokens")}
                className={cn(
                  "text-sm px-3 py-1 rounded-md transition-colors",
                  viewMode === "all-etokens"
                    ? "bg-accent font-medium"
                    : "hover:bg-accent/50 text-muted-foreground",
                )}
              >
                All eTokens
              </button>
              <button
                type="button"
                aria-label="Ad schedule"
                title="Ad schedule (next 8 weeks)"
                onClick={() => setViewMode("ad-schedule")}
                className={cn(
                  "text-sm px-3 py-1 rounded-md transition-colors",
                  viewMode === "ad-schedule"
                    ? "bg-accent font-medium"
                    : "hover:bg-accent/50 text-muted-foreground",
                )}
              >
                Ad Schedule
              </button>
            </div>
            
            {viewMode === 'normal' && (
            <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent transition-colors",
                    filterOption !== 'all' && "text-blue-500 border-blue-500"
                  )}
                >
                  <Filter className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem 
                  onClick={() => setFilterOption('all')}
                  className={cn(
                    "cursor-pointer",
                    filterOption === 'all' && "bg-accent"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>Show All</span>
                    {filterOption === 'all' && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setFilterOption('no-trades-30d')}
                  className={cn(
                    "cursor-pointer",
                    filterOption === 'no-trades-30d' && "bg-accent"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>Hide tokens with no trades in 30 days</span>
                    {filterOption === 'no-trades-30d' && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setFilterOption('low-volume-30d')}
                  className={cn(
                    "cursor-pointer",
                    filterOption === 'low-volume-30d' && "bg-accent"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>Hide tokens with volume &lt; 1M XEC in 30 days</span>
                    {filterOption === 'low-volume-30d' && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setFilterOption('low-trades-30d')}
                  className={cn(
                    "cursor-pointer",
                    filterOption === 'low-trades-30d' && "bg-accent"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>Hide tokens with &lt; 50 trades in 30 days</span>
                    {filterOption === 'low-trades-30d' && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {searchExpanded ? (
              <div
                ref={searchContainerRef}
                className="flex items-center gap-2 border rounded-md px-2 py-1 w-full sm:w-auto max-w-full"
              >
                <Input
                  type="text"
                  placeholder="Enter token ID"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="h-8 flex-1 min-w-0 w-full sm:w-64 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isValidTokenId(searchInput)) {
                      handleSearchToken()
                    }
                  }}
                />
                {isValidTokenId(searchInput) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2"
                    onClick={handleSearchToken}
                    disabled={isSearching}
                  >
                    {isSearching ? "..." : "Search"}
                  </Button>
                )}
                <button
                  onClick={() => {
                    setSearchExpanded(false)
                    setSearchInput("")
                  }}
                  className="p-1 hover:bg-accent rounded-md transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSearchExpanded(true)}
                className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent transition-colors"
              >
                <Search className="h-4 w-4" />
              </button>
            )}
            {showClearCacheConfirm ? (
              <div
                ref={clearCacheConfirmRef}
                className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm bg-accent/40 shadow-sm"
              >
                <RotateCcw className="h-4 w-4 text-muted-foreground" />
                <span className="whitespace-nowrap text-xs sm:text-sm">Clear cache and Rebuild table?</span>
                <div className="flex items-center gap-1">
                  <button
                    className="p-1 rounded-md hover:bg-accent text-green-600 transition-colors"
                    onClick={clearCacheAndReload}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    className="p-1 rounded-md hover:bg-accent text-muted-foreground transition-colors"
                    onClick={() => setShowClearCacheConfirm(false)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent transition-colors"
                onClick={() => setShowClearCacheConfirm(true)}
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
            </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className={viewMode === "all-etokens" ? "block" : "hidden"}>
            <AllEtokensView
              watchlistFreeLimit={WATCHLIST_FREE_LIMIT}
              ssUnlockThreshold={SS_UNLOCK_THRESHOLD}
            />
          </div>

          <div className={viewMode === "ad-schedule" ? "block" : "hidden"}>
            <AdScheduleView />
          </div>
          
          <div className={viewMode === "normal" ? "block" : "hidden"}>
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
                            ? '30d'
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
                                  className="ml-2 p-1 rounded hover:bg-gray-200"
                                  onClick={() => sortType && setSortBy(sortType)}
                                >
                                  {sortBy === sortType ? (
                                    <ArrowDown className="w-4 h-4" />
                                  ) : (
                                    <ArrowUp className="w-4 h-4" />
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
          </div>
        </CardContent>
      </Card>
      </TooltipProvider>

      <Dialog 
        open={searchDialogOpen} 
        onOpenChange={(open) => {
          setSearchDialogOpen(open)
          if (!open) {
            setSearchTokenInfo(null)
            setIsTokenListed(false)
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Token Search Result</DialogTitle>
            <DialogDescription>
              Information about token ID: {(searchTokenInfo?.tokenId || searchInput).substring(0, 10)}...
            </DialogDescription>
          </DialogHeader>
          
          {isTokenListed ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <CheckCircle className="h-16 w-16 text-green-500" />
              <div className="text-center">
                <p className="text-lg font-semibold">Token Already Listed</p>
                <p className="text-sm text-muted-foreground mt-2">
                  This token is already displayed in the market table
                </p>
              </div>
            </div>
          ) : searchTokenInfo ? (
            <div className="space-y-4">
              <div className="grid gap-3">
                <div className="flex items-start justify-between p-3 bg-accent/50 rounded-lg">
                  <span className="text-sm font-medium text-muted-foreground">Token ID:</span>
                  <span className="text-sm font-mono text-right break-all ml-2">
                    {searchTokenInfo.tokenId}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
                  <span className="text-sm font-medium text-muted-foreground">Name:</span>
                  <span className="text-sm font-semibold">
                    {searchTokenInfo.genesisInfo?.tokenName || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
                  <span className="text-sm font-medium text-muted-foreground">Ticker:</span>
                  <span className="text-sm font-semibold">
                    {searchTokenInfo.genesisInfo?.tokenTicker || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
                  <span className="text-sm font-medium text-muted-foreground">Decimals:</span>
                  <span className="text-sm">
                    {searchTokenInfo.genesisInfo?.decimals ?? 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
                  <span className="text-sm font-medium text-muted-foreground">Type:</span>
                  <span className="text-sm">
                    {searchTokenInfo.tokenType?.protocol || 'N/A'} - {searchTokenInfo.tokenType?.type || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
                  <span className="text-sm font-medium text-muted-foreground">Block Height:</span>
                  <span className="text-sm">
                    {searchTokenInfo.block?.height || 'N/A'}
                  </span>
                </div>
                {searchTokenInfo.genesisInfo?.url && (
                  <div className="flex items-start justify-between p-3 bg-accent/50 rounded-lg">
                    <span className="text-sm font-medium text-muted-foreground">URL:</span>
                    <a
                      href={searchTokenInfo.genesisInfo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-500 hover:underline break-all ml-2 text-right"
                    >
                      {searchTokenInfo.genesisInfo.url}
                    </a>
                  </div>
                )}
              </div>
              
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={closeSearchDialog}
                >
                  Close
                </Button>
                <Button
                  variant="default"
                  onClick={handleAddToWatchlist}
                  disabled={isAddingToWatchlist}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  {isAddingToWatchlist ? 'Adding...' : 'Add to Watchlist'}
                </Button>
                <Button
                  variant="default"
                  onClick={() => {
                    router.push('/list')
                  }}
                  className="gap-2"
                >
                  <ListPlus className="h-4 w-4" />
                  List This Token
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-6">
              <AlertTriangle className="h-16 w-16 text-yellow-500" />
              <div className="text-center">
                <p className="text-lg font-semibold">Token Not Found</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Unable to fetch information for this token ID
                </p>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={closeSearchDialog}
                >
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