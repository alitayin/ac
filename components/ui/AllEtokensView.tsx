"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { tokens } from "@/config/tokens"
import { paidTokenIds } from "@/config/paidSC"
import { TOKEN_IDS } from "@/lib/constants"
import { chronik, fetchTokenDetails, getTokenDecimalsFromDetails } from "@/lib/chronik"
import { Agora } from "ecash-agora"
import { useToast } from "@/hooks/use-toast"
import { useWallet } from "@/lib/context/WalletContext"
import { Plus } from "lucide-react"

type AllEtokensViewProps = {
  watchlistFreeLimit: number
  ssUnlockThreshold: number
}

const AllEtokensView: React.FC<AllEtokensViewProps> = ({
  watchlistFreeLimit,
  ssUnlockThreshold,
}) => {
  const ITEMS_PER_PAGE = 10
  const [allTokenIds, setAllTokenIds] = React.useState<string[]>([])
  const [activeTokens, setActiveTokens] = React.useState<any[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [loadingTokenIds, setLoadingTokenIds] = React.useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = React.useState(1)
  const [addedTokens, setAddedTokens] = React.useState<Set<string>>(new Set())
  const [isLoadingMoreTokens, setIsLoadingMoreTokens] = React.useState(true)
  const router = useRouter()
  const { toast } = useToast()
  const { isWalletConnected, userTokens } = useWallet()
  const [ssDecimals, setSsDecimals] = React.useState<number | null>(null)

  React.useEffect(() => {
    let cancelled = false
    const loadSsMeta = async () => {
      try {
        const detail = await fetchTokenDetails(TOKEN_IDS.STAR_SHARD)
        const decimals = getTokenDecimalsFromDetails(detail, 0)
        if (!cancelled) setSsDecimals(decimals)
      } catch (_e) {
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
      const required = BigInt(ssUnlockThreshold) * factor
      return atoms >= required
    } catch {
      return false
    }
  }, [isWalletConnected, userTokens, ssDecimals, ssUnlockThreshold])

  const CUSTOM_TOKENS_KEY = "custom_watchlist_tokens"

  React.useEffect(() => {
    const checkAddedTokens = () => {
      try {
        const stored = localStorage.getItem(CUSTOM_TOKENS_KEY)
        const customTokens = stored ? JSON.parse(stored) : []
        const configTokenIds = Object.values(tokens).map((t) => t.tokenId)
        const allAddedTokens = new Set([...customTokens, ...configTokenIds])
        setAddedTokens(allAddedTokens)
      } catch (_error) {}
    }
    checkAddedTokens()
    const handleWatchlistAdd = (event: Event) => {
      const customEvent = event as CustomEvent<{ tokenId?: string }>
      const tokenId = customEvent.detail?.tokenId
      if (!tokenId) return
      setAddedTokens((prev) => {
        const next = new Set(prev)
        next.add(tokenId)
        return next
      })
    }
    const handleWatchlistRemove = (event: Event) => {
      const customEvent = event as CustomEvent<{ tokenId?: string }>
      const tokenId = customEvent.detail?.tokenId
      if (!tokenId) return
      setAddedTokens((prev) => {
        const next = new Set(prev)
        next.delete(tokenId)
        return next
      })
    }
    window.addEventListener("token-watchlist-added", handleWatchlistAdd as EventListener)
    window.addEventListener("token-watchlist-removed", handleWatchlistRemove as EventListener)
    return () => {
      window.removeEventListener("token-watchlist-added", handleWatchlistAdd as EventListener)
      window.removeEventListener("token-watchlist-removed", handleWatchlistRemove as EventListener)
    }
  }, [])

  const handleAddToList = (tokenId: string) => {
    try {
      const isInConfig = Object.values(tokens).some((t) => t.tokenId === tokenId)
      if (isInConfig) {
        return
      }

      const stored = localStorage.getItem(CUSTOM_TOKENS_KEY)
      const current = stored ? JSON.parse(stored) : []

      if (!current.includes(tokenId)) {
        if (
          !isSsUnlocked &&
          Array.isArray(current) &&
          current.length >= watchlistFreeLimit
        ) {
          toast({
            variant: "destructive",
            title: "Watchlist limit reached",
            description: `Free users can add up to ${watchlistFreeLimit} custom tokens. Connect wallet and hold at least ${ssUnlockThreshold.toLocaleString()} SS to unlock unlimited watchlist.`,
          })
          return
        }

        const updated = [...current, tokenId]
        localStorage.setItem(CUSTOM_TOKENS_KEY, JSON.stringify(updated))
        setAddedTokens(new Set(updated))
        try {
          window.dispatchEvent(
            new CustomEvent("token-watchlist-added", {
              detail: { tokenId },
            }),
          )
        } catch (_error) {}
      }
    } catch (_error) {}
  }

  React.useEffect(() => {
    const loadTokenIds = async () => {
      try {
        setAllTokenIds(paidTokenIds)
        setIsLoading(false)
        setIsLoadingMoreTokens(true)

        const agora = new Agora(chronik)
        const tokenIds = await agora.offeredFungibleTokenIds()

        const paidInList = paidTokenIds.filter((id) => tokenIds.includes(id))
        const paidInListSet = new Set(paidInList)
        const otherTokens = tokenIds.filter((id) => !paidInListSet.has(id))

        const sortedTokenIds = [...paidInList, ...otherTokens]

        setAllTokenIds(sortedTokenIds)
        setIsLoadingMoreTokens(false)
      } catch (_error) {
        setIsLoadingMoreTokens(false)
      }
    }

    loadTokenIds()
  }, [])

  React.useEffect(() => {
    if (allTokenIds.length === 0) return

    const loadCurrentPageTokens = async () => {
      const startIdx = (currentPage - 1) * ITEMS_PER_PAGE
      const endIdx = startIdx + ITEMS_PER_PAGE
      const pageTokenIds = allTokenIds.slice(startIdx, endIdx)
      const initialTokens = pageTokenIds.map((tokenId: string) => ({
        tokenId,
        tokenTicker: "",
        tokenName: tokenId.substring(0, 8) + "...",
        decimals: 0,
        url: "",
        loading: true,
      }))

      setActiveTokens(initialTokens)

      for (const tokenId of pageTokenIds) {
        setLoadingTokenIds((prev) => new Set(prev).add(tokenId))

        try {
          const tokenDetails = await fetchTokenDetails(tokenId)

          setActiveTokens((prev) =>
            prev.map((token) =>
              token.tokenId === tokenId
                ? {
                    tokenId,
                    tokenTicker: tokenDetails.genesisInfo?.tokenTicker || "",
                    tokenName: tokenDetails.genesisInfo?.tokenName || tokenId.substring(0, 6),
                    decimals: tokenDetails.genesisInfo?.decimals ?? 0,
                    url: tokenDetails.genesisInfo?.url || "",
                    loading: false,
                  }
                : token,
            ),
          )
        } catch (_error) {
          const retryKey = `allTokens_${tokenId}_retry`
          const hasRetried = sessionStorage.getItem(retryKey)

          if (!hasRetried) {
            sessionStorage.setItem(retryKey, "true")

            setTimeout(async () => {
              try {
                const tokenDetails = await fetchTokenDetails(tokenId)
                setActiveTokens((prev) =>
                  prev.map((token) =>
                    token.tokenId === tokenId
                      ? {
                          tokenId,
                          tokenTicker: tokenDetails.genesisInfo?.tokenTicker || "",
                          tokenName:
                            tokenDetails.genesisInfo?.tokenName || tokenId.substring(0, 6),
                          decimals: tokenDetails.genesisInfo?.decimals ?? 0,
                          url: tokenDetails.genesisInfo?.url || "",
                          loading: false,
                        }
                      : token,
                  ),
                )
                sessionStorage.removeItem(retryKey)
              } catch (_retryError) {
                setActiveTokens((prev) =>
                  prev.map((token) =>
                    token.tokenId === tokenId
                      ? {
                          ...token,
                          tokenName: tokenId.substring(0, 6),
                          loading: false,
                        }
                      : token,
                  ),
                )
              }
            }, 5000)
          } else {
            setActiveTokens((prev) =>
              prev.map((token) =>
                token.tokenId === tokenId
                  ? {
                      ...token,
                      tokenName: tokenId.substring(0, 6),
                      loading: false,
                    }
                  : token,
              ),
            )
          }
        } finally {
          setLoadingTokenIds((prev) => {
            const next = new Set(prev)
            next.delete(tokenId)
            return next
          })
        }
      }
    }

    loadCurrentPageTokens()
  }, [allTokenIds, currentPage])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Loading token list...</div>
      </div>
    )
  }

  const totalTokens = allTokenIds.length
  const totalPages = Math.ceil(totalTokens / ITEMS_PER_PAGE)
  const loadedCount = activeTokens.filter((t) => !t.loading).length
  const currentPageCount = activeTokens.length
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE + 1
  const endIdx = Math.min(currentPage * ITEMS_PER_PAGE, totalTokens)

  return (
    <div className="space-y-3">
      {totalTokens > 0 && (
        <div className="flex items-center justify-between px-3">
          <div className="text-sm text-muted-foreground">
            Found {totalTokens} fungible tokens with active offers
            <span className="ml-2">(Showing {startIdx}-{endIdx})</span>
            {loadedCount < currentPageCount && (
              <span className="ml-2">• Loading: {loadedCount}/{currentPageCount}</span>
            )}
            {isLoadingMoreTokens && (
              <span className="ml-2 text-blue-600 dark:text-blue-500">
                • Loading more tokens in background, may take ~60 seconds
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
        </div>
      )}
      <div className="space-y-1 overflow-x-auto pb-1">
        <div className="space-y-1 min-w-[640px]">
          {activeTokens.map((token) => (
            <div
              key={token.tokenId}
              className="flex items-center gap-4 p-2 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
              onClick={() => router.push(`/${token.tokenId}`)}
            >
              <Avatar className="h-4 w-4 flex-shrink-0">
                <AvatarImage
                  src={`https://icons.etokens.cash/32/${token.tokenId}.png`}
                  alt={token.tokenName}
                />
                <AvatarFallback className="text-xs">
                  {token.tokenTicker
                    ? token.tokenTicker.substring(0, 2)
                    : token.tokenName.substring(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="w-40 flex-shrink-0">
                <div className="text-sm font-semibold truncate">{token.tokenName}</div>
                {token.loading && (
                  <span className="text-xs text-muted-foreground">(loading...)</span>
                )}
              </div>
              <div className="w-24 flex-shrink-0 hidden sm:block">
                <div className="text-sm text-muted-foreground truncate">
                  {token.tokenTicker || "-"}
                </div>
              </div>
              <div className="w-20 flex-shrink-0 hidden sm:block">
                <div className="text-sm text-muted-foreground">
                  {token.loading ? "-" : `${token.decimals} decimals`}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                {token.url ? (
                  <a
                    href={token.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm text-blue-500 hover:underline truncate block"
                    title={token.url}
                  >
                    {token.url}
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </div>
              <div className="flex-shrink-0 flex items-center gap-2 justify-end">
                {paidTokenIds.includes(token.tokenId) && (
                  <Badge
                    variant="default"
                    className="text-xs whitespace-nowrap bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0"
                  >
                    SC Premium
                  </Badge>
                )}
                {addedTokens.has(token.tokenId) ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled
                    className="text-xs text-muted-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Added
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs hover:bg-accent"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAddToList(token.tokenId)
                    }}
                  >
                    <Plus className="h-2 w-2" />
                    Add to List
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (currentPage > 1) {
                      setCurrentPage(currentPage - 1)
                    }
                  }}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>

              {currentPage > 2 && (
                <>
                  <PaginationItem>
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        setCurrentPage(1)
                      }}
                    >
                      1
                    </PaginationLink>
                  </PaginationItem>
                  {currentPage > 3 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}
                </>
              )}

              {currentPage > 1 && (
                <PaginationItem>
                  <PaginationLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      setCurrentPage(currentPage - 1)
                    }}
                  >
                    {currentPage - 1}
                  </PaginationLink>
                </PaginationItem>
              )}

              <PaginationItem>
                <PaginationLink href="#" isActive>
                  {currentPage}
                </PaginationLink>
              </PaginationItem>

              {currentPage < totalPages && (
                <PaginationItem>
                  <PaginationLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      setCurrentPage(currentPage + 1)
                    }}
                  >
                    {currentPage + 1}
                  </PaginationLink>
                </PaginationItem>
              )}

              {currentPage < totalPages - 1 && (
                <>
                  {currentPage < totalPages - 2 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}
                  <PaginationItem>
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        setCurrentPage(totalPages)
                      }}
                    >
                      {totalPages}
                    </PaginationLink>
                  </PaginationItem>
                </>
              )}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (currentPage < totalPages) {
                      setCurrentPage(currentPage + 1)
                    }
                  }}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  )
}

export default AllEtokensView

