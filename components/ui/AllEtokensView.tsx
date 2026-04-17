"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { tokens } from "@/config/tokens"
import { fetchTokenDetails } from "@/lib/chronik"
import { useChronik } from "@/lib/context/ChronikContext"
import { Agora } from "ecash-agora"
import { Plus } from "lucide-react"

const ITEMS_PER_PAGE = 10

type ActiveToken = {
  tokenId: string
  tokenTicker: string
  tokenName: string
  decimals: number
  url: string
  loading: boolean
}

const getPlaceholderToken = (tokenId: string): ActiveToken => ({
  tokenId,
  tokenTicker: "",
  tokenName: `${tokenId.substring(0, 8)}...`,
  decimals: 0,
  url: "",
  loading: true,
})

const getResolvedToken = (tokenId: string, tokenDetails?: any): ActiveToken => ({
  tokenId,
  tokenTicker: tokenDetails?.genesisInfo?.tokenTicker || "",
  tokenName: tokenDetails?.genesisInfo?.tokenName || tokenId.substring(0, 6),
  decimals: tokenDetails?.genesisInfo?.decimals ?? 0,
  url: tokenDetails?.genesisInfo?.url || "",
  loading: false,
})

const AllEtokensLoadingSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-4 w-20" />
      </div>

      <div className="px-3 text-sm text-muted-foreground">
        Loading token list...
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-[640px] flex-col gap-1">
          {Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 rounded-lg border p-2"
            >
              <Skeleton className="size-4 flex-shrink-0 rounded-full" />
              <div className="w-40 flex-shrink-0">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="hidden h-4 w-16 flex-shrink-0 sm:block" />
              <Skeleton className="hidden h-4 w-20 flex-shrink-0 sm:block" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-8 w-24 flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const AllEtokensView: React.FC = () => {
  const { chronik: chronikClient, isLoading: isChronikLoading } = useChronik()
  const [allTokenIds, setAllTokenIds] = React.useState<string[]>([])
  const [activeTokens, setActiveTokens] = React.useState<ActiveToken[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [addedTokens, setAddedTokens] = React.useState<Set<string>>(new Set())
  const [isLoadingMoreTokens, setIsLoadingMoreTokens] = React.useState(true)
  const pageRequestIdRef = React.useRef(0)
  const router = useRouter()

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
    if (isChronikLoading || !chronikClient) return

    const loadTokenIds = async () => {
      try {
        setIsLoading(true)
        setIsLoadingMoreTokens(true)

        const agora = new Agora(chronikClient as any)
        const tokenIds = await agora.offeredFungibleTokenIds()

        setAllTokenIds(tokenIds)
      } catch (_error) {
      } finally {
        setIsLoading(false)
        setIsLoadingMoreTokens(false)
      }
    }

    loadTokenIds()
  }, [chronikClient, isChronikLoading])

  React.useEffect(() => {
    if (!chronikClient || allTokenIds.length === 0) return

    const activeChronik = chronikClient
    const requestId = pageRequestIdRef.current + 1
    pageRequestIdRef.current = requestId
    let cancelled = false

    const pageTokenIds = allTokenIds.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE,
    )

    const initialTokens = pageTokenIds.map((tokenId) => getPlaceholderToken(tokenId))
    setActiveTokens(initialTokens)

    const updateTokenFromRetry = async (tokenId: string, retryKey: string) => {
      try {
        const tokenDetails = await fetchTokenDetails(tokenId, activeChronik)
        if (cancelled || pageRequestIdRef.current !== requestId) return

        setActiveTokens((prev) =>
          prev.map((token) =>
            token.tokenId === tokenId ? getResolvedToken(tokenId, tokenDetails) : token,
          ),
        )
        sessionStorage.removeItem(retryKey)
      } catch (_retryError) {
      }
    }

    const loadToken = async (tokenId: string): Promise<ActiveToken> => {
      try {
        const tokenDetails = await fetchTokenDetails(tokenId, activeChronik)
        return getResolvedToken(tokenId, tokenDetails)
      } catch (_error) {
        const retryKey = `allTokens_${tokenId}_retry`
        const hasRetried = sessionStorage.getItem(retryKey)

        if (!hasRetried) {
          sessionStorage.setItem(retryKey, "true")
          window.setTimeout(() => {
            void updateTokenFromRetry(tokenId, retryKey)
          }, 5000)
        }

        return getResolvedToken(tokenId)
      }
    }

    const loadCurrentPageTokens = async () => {
      const resolvedTokens = await Promise.all(pageTokenIds.map((tokenId) => loadToken(tokenId)))

      if (cancelled || pageRequestIdRef.current !== requestId) {
        return
      }

      setActiveTokens(resolvedTokens)
    }

    void loadCurrentPageTokens()

    return () => {
      cancelled = true
    }
  }, [allTokenIds, currentPage, chronikClient])

  const isInitialLoading =
    isChronikLoading ||
    !chronikClient ||
    isLoading ||
    (isLoadingMoreTokens && allTokenIds.length === 0)

  if (isInitialLoading) {
    return <AllEtokensLoadingSkeleton />
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
        <div className="mt-6 flex items-center justify-center">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="h-9 px-3"
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="h-9 px-3"
            >
              Previous
            </Button>

            <div className="flex items-center gap-1">
              {currentPage > 2 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    className="h-9 w-9 p-0"
                  >
                    1
                  </Button>
                  {currentPage > 3 && (
                    <span className="px-2 text-muted-foreground">...</span>
                  )}
                </>
              )}

              {currentPage > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  className="h-9 w-9 p-0"
                >
                  {currentPage - 1}
                </Button>
              )}

              <Button
                variant="default"
                size="sm"
                className="h-9 w-9 p-0 bg-primary text-primary-foreground"
              >
                {currentPage}
              </Button>

              {currentPage < totalPages && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  className="h-9 w-9 p-0"
                >
                  {currentPage + 1}
                </Button>
              )}

              {currentPage < totalPages - 1 && (
                <>
                  {currentPage < totalPages - 2 && (
                    <span className="px-2 text-muted-foreground">...</span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    className="h-9 w-9 p-0"
                  >
                    {totalPages}
                  </Button>
                </>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="h-9 px-3"
            >
              Next
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="h-9 px-3"
            >
              Last
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AllEtokensView
