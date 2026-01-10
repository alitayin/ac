import { chronik } from "./chronik"

type OrderProcessHandler = () => void

const watchedOrderTokenIds = new Set<string>()
const handlers = new Set<OrderProcessHandler>()
const processingTxids = new Set<string>()
let wsClient: ReturnType<typeof chronik.ws> | null = null
let wsConnected = false

const subscribeAll = () => {
  if (!wsClient) return
  watchedOrderTokenIds.forEach((id) => {
    try {
      wsClient?.subscribeToTokenId(id)
    } catch (_err) {}
  })
}

const notifyOrderProcess = () => {
  handlers.forEach((handler) => {
    try {
      handler()
    } catch (_err) {}
  })
}

const handleTx = async (txid: string) => {
  if (processingTxids.has(txid)) return
  processingTxids.add(txid)

  try {
    const tx = await chronik.tx(txid)
    let hasWatchedToken = false
    if (tx.tokenEntries && tx.tokenEntries.length > 0) {
      for (const entry of tx.tokenEntries) {
        if (entry.tokenId && watchedOrderTokenIds.has(entry.tokenId)) {
          hasWatchedToken = true
          break
        }
      }
    }
    
    if (hasWatchedToken) {
      notifyOrderProcess()
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

  wsClient.waitForOpen().catch((err) => {
    wsConnected = false
    wsClient = null
  })
  
  subscribeAll()
}

export const watchOrderTokens = (
  tokenIds: string[],
  onOrderProcess: OrderProcessHandler,
) => {
  tokenIds
    .filter((id) => typeof id === "string" && id.length > 0)
    .forEach((id) => {
      watchedOrderTokenIds.add(id)
    })

  handlers.add(onOrderProcess)
  ensureWebSocket()
  subscribeAll()

  return () => {
    handlers.delete(onOrderProcess)
  }
}

export const addOrderTokenWatch = (tokenId: string) => {
  if (!tokenId) return
  
  watchedOrderTokenIds.add(tokenId)
  ensureWebSocket()
  
  try {
    wsClient?.subscribeToTokenId(tokenId)
  } catch (_err) {}
}

export const removeOrderTokenWatch = (tokenId: string) => {
  if (!tokenId) return
  
  watchedOrderTokenIds.delete(tokenId)
  
  try {
    wsClient?.unsubscribeFromTokenId(tokenId)
  } catch (_err) {}
}

export const getWatchedOrderTokens = (): string[] => {
  return Array.from(watchedOrderTokenIds)
}

export const isSwapWsConnected = (): boolean => {
  return wsConnected
}

