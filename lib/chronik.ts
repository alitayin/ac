import { ChronikClient } from "chronik-client"
import { tokens } from "@/config/tokens"
import { storageManager } from './storage-manager'

// Legacy synchronous export (keep during migration)
export const chronik = new ChronikClient([
  "https://chronik-native1.fabien.cash",
  "https://chronik-native2.fabien.cash",
  "https://chronik-native3.fabien.cash",
])

export const fetchBlockchainInfo = async (
  client?: ChronikClient
): Promise<{ tipHash: string; tipHeight: number }> => {
  const c = client || chronik
  const info = await c.blockchainInfo()
  return {
    tipHash: info?.tipHash ?? "",
    tipHeight: typeof info?.tipHeight === "number" ? info.tipHeight : 0,
  }
}

export const fetchTokenUtxos = async (tokenId: string, client?: ChronikClient): Promise<any[]> => {
  if (!tokenId) {
    throw new Error("tokenId is required")
  }

  const c = client || chronik
  const utxosResp = await c.tokenId(tokenId).utxos()
  return utxosResp?.utxos || []
}

export const fetchAddressXecUtxos = async (address: string, client?: ChronikClient): Promise<any[]> => {
  if (!address) {
    throw new Error("address is required")
  }

  const c = client || chronik
  const utxosResp = await c.address(address).utxos()
  const utxos = utxosResp?.utxos || []

  return utxos.filter((utxo: any) => !utxo.token)
}

export const getTokenAmountFromToken = (token: any): bigint => {
  if (!token) return BigInt(0)

  try {
    if (typeof token.atoms !== "undefined") {
      return BigInt(token.atoms)
    }
    if (typeof token.amount !== "undefined") {
      return BigInt(token.amount)
    }
    if (typeof (token as any).value !== "undefined") {
      return BigInt((token as any).value)
    }
  } catch {
    return BigInt(0)
  }

  return BigInt(0)
}

const TOKEN_DETAILS_CACHE_KEY = 'token_details_cache'

export const getCachedTokenDetails = (tokenId: string): any | null => {
  try {
    const cache = storageManager.get<Record<string, any>>(TOKEN_DETAILS_CACHE_KEY)
    if (!cache) return null

    return cache[tokenId] || null
  } catch (error) {
    console.error('Failed to read token detail cache:', error)
    return null
  }
}

const setCachedTokenDetails = (tokenId: string, data: any) => {
  try {
    const cache = storageManager.get<Record<string, any>>(TOKEN_DETAILS_CACHE_KEY) || {}

    cache[tokenId] = data

    storageManager.set(TOKEN_DETAILS_CACHE_KEY, cache)
  } catch (error) {
    console.error('Failed to save token detail cache:', error)
  }
}

// In-memory pending requests map for deduplication
const pendingRequests = new Map<string, Promise<any>>()

export const fetchTokenDetails = async (tokenId: string, client?: ChronikClient) => {
  if (!tokenId) {
    throw new Error("tokenId is required")
  }

  const cached = getCachedTokenDetails(tokenId)
  if (cached) {
    return cached
  }

  // Check if there's already a pending request for this token
  const pending = pendingRequests.get(tokenId)
  if (pending) {
    return pending
  }

  // Create new request and store it
  const c = client || chronik
  const requestPromise = c.token(tokenId).then(tokenData => {
    if (tokenData) {
      setCachedTokenDetails(tokenId, tokenData)
    }
    // Remove from pending after completion
    pendingRequests.delete(tokenId)
    return tokenData
  }).catch(error => {
    // Remove from pending on error too
    pendingRequests.delete(tokenId)
    throw error
  })

  pendingRequests.set(tokenId, requestPromise)
  return requestPromise
}

export const getTokenDecimalsFromDetails = (
  tokenData: any | undefined | null,
  fallbackDecimals: number = 0,
): number => {
  if (!tokenData) return fallbackDecimals
  const chronikDecimals = tokenData.genesisInfo?.decimals
  return typeof chronikDecimals === "number" ? chronikDecimals : fallbackDecimals
}

export const resolveTokenDecimals = async (
  tokenId: string,
  client?: ChronikClient,
): Promise<number> => {
  if (!tokenId) return 0

  const tokenConfig = Object.values(tokens).find((token) => token.tokenId === tokenId)
  if (typeof tokenConfig?.decimals === "number") {
    return tokenConfig.decimals
  }

  const cached = getCachedTokenDetails(tokenId)
  if (cached) {
    return getTokenDecimalsFromDetails(cached, 0)
  }

  try {
    const tokenDetails = await fetchTokenDetails(tokenId, client)
    return getTokenDecimalsFromDetails(tokenDetails, 0)
  } catch (_error) {
    return 0
  }
}
