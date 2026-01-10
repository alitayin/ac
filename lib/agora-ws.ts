import { chronik } from "./chronik"
import { detectAgoraTokenId } from "./chronik-transactions"
import { deleteSummaryCache, refreshSummaryCacheTimestamps } from "./token-stats"

type TokenInvalidateHandler = (tokenId: string) => void

const watchedTokenIds = new Set<string>()
const handlers = new Set<TokenInvalidateHandler>()
const processingTxids = new Set<string>()
let wsClient: ReturnType<typeof chronik.ws> | null = null
let wsConnected = false

// Cache refresh tracking
const WS_MESSAGE_THRESHOLD = 5
const WS_MESSAGE_TIMEOUT_MS = 3 * 60 * 1000 // 5 minutes
let wsMessageCount = 0
let lastWsMessageTime: number | null = null

const subscribeAll = () => {
  if (!wsClient) return
  
  // Subscribe to mempool for cache refresh tracking
  try {
    wsClient.subscribeToTxs()
  } catch (_err) {}
  
  // Subscribe to watched tokens for invalidation
  watchedTokenIds.forEach((id) => {
    try {
      wsClient?.subscribeToTokenId(id)
    } catch (_err) {}
  })
}

const notifyInvalidation = (tokenId: string) => {
  handlers.forEach((handler) => {
    try {
      handler(tokenId)
    } catch (_err) {}
  })
}

const trackMempoolMessage = () => {
  const now = Date.now()
  
  // Check if message is within timeout window
  if (lastWsMessageTime !== null && (now - lastWsMessageTime) > WS_MESSAGE_TIMEOUT_MS) {
    // Timeout exceeded, reset counter
    console.log(`[WS Cache] ⚠️ Message timeout exceeded (${Math.round((now - lastWsMessageTime) / 1000)}s), resetting counter from ${wsMessageCount} to 0`)
    wsMessageCount = 0
  }
  
  // Update tracking
  lastWsMessageTime = now
  wsMessageCount++
  
  console.log(`[WS Cache] 📊 Mempool message received | Counter: ${wsMessageCount}/${WS_MESSAGE_THRESHOLD}`)
  
  // Check if threshold reached
  if (wsMessageCount >= WS_MESSAGE_THRESHOLD) {
    // Refresh all watched tokens' summary cache timestamps
    const tokenIdsArray = Array.from(watchedTokenIds)
    
    console.log(`[WS Cache] 🎯 Threshold reached! Refreshing ${tokenIdsArray.length} token summary caches...`)
    
    refreshSummaryCacheTimestamps(tokenIdsArray)
    
    // Reset counter
    wsMessageCount = 0
    
    console.log(`[WS Cache] ✅ Cache refresh complete! Counter reset to 0. Next refresh at 20 messages.`)
  }
}

const handleTx = async (txid: string) => {
  if (processingTxids.has(txid)) return
  processingTxids.add(txid)

  try {
    const tx = await chronik.tx(txid)
    const tokenId = detectAgoraTokenId(tx)
    if (tokenId && watchedTokenIds.has(tokenId)) {
      deleteSummaryCache(tokenId)
      notifyInvalidation(tokenId)
    }
  } catch (_err) {
  } finally {
    processingTxids.delete(txid)
  }
}

const ensureWebSocket = () => {
  if (typeof window === "undefined") return
  if (wsClient) return

  wsClient = chronik.ws({
    onMessage: (msg) => {
      const msgType = (msg as any)?.msgType
      
      // Track mempool messages for cache refresh (any TX_ADDED_TO_MEMPOOL message)
      if (msgType === "TX_ADDED_TO_MEMPOOL") {
        trackMempoolMessage()
        return
      }
      
      // Handle token-specific finalized transactions for cache invalidation
      if (msgType && msgType !== "TX_FINALIZED") {
        return
      }
      
      const txid =
        (msg as any)?.txid ||
        (msg as any)?.tx?.txid ||
        (msg as any)?.tx?.hash ||
        null
      if (txid) {
        handleTx(txid)
      }
    },
    onConnect: () => {
      wsConnected = true
      subscribeAll()
    },
    onReconnect: () => {
      wsConnected = true
      subscribeAll()
    },
    onError: (err) => {
      wsConnected = false
    },
    onEnd: () => {
      wsConnected = false
      wsClient = null
      setTimeout(() => ensureWebSocket(), 1000)
    },
  })

  wsClient.waitForOpen().catch(() => {
    wsConnected = false
    wsClient = null
  })
  subscribeAll()
}

export const watchAgoraTokens = (
  tokenIds: string[],
  onInvalidate: TokenInvalidateHandler,
) => {
  tokenIds
    .filter((id) => typeof id === "string" && id.length > 0)
    .forEach((id) => watchedTokenIds.add(id))

  handlers.add(onInvalidate)
  ensureWebSocket()
  subscribeAll()

  return () => {
    handlers.delete(onInvalidate)
  }
}

export const addTokenWatch = (tokenId: string) => {
  if (!tokenId) return
  watchedTokenIds.add(tokenId)
  ensureWebSocket()
  try {
    wsClient?.subscribeToTokenId(tokenId)
  } catch (_err) {}
}

