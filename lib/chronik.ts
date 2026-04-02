import { ChronikClient } from "chronik-client"

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

const getCachedTokenDetails = (tokenId: string): any | null => {
  try {
    const cacheStr = localStorage.getItem(TOKEN_DETAILS_CACHE_KEY)
    if (!cacheStr) return null
    
    const cache = JSON.parse(cacheStr)
    return cache[tokenId] || null
  } catch (error) {
    console.error('Failed to read token detail cache:', error)
    return null
  }
}

const setCachedTokenDetails = (tokenId: string, data: any) => {
  try {
    const cacheStr = localStorage.getItem(TOKEN_DETAILS_CACHE_KEY)
    const cache = cacheStr ? JSON.parse(cacheStr) : {}
    
    cache[tokenId] = data
    
    localStorage.setItem(TOKEN_DETAILS_CACHE_KEY, JSON.stringify(cache))
  } catch (error) {
    console.error('Failed to save token detail cache:', error)
  }
}

export const fetchTokenDetails = async (tokenId: string, client?: ChronikClient) => {
  if (!tokenId) {
    throw new Error("tokenId is required")
  }

  const cached = getCachedTokenDetails(tokenId)
  if (cached) {
    return cached
  }

  const c = client || chronik
  const tokenData = await c.token(tokenId)

  if (tokenData) {
    setCachedTokenDetails(tokenId, tokenData)
  }

  return tokenData
}

export const getTokenDecimalsFromDetails = (
  tokenData: any | undefined | null,
  fallbackDecimals: number = 0,
): number => {
  if (!tokenData) return fallbackDecimals
  const chronikDecimals = tokenData.genesisInfo?.decimals
  return typeof chronikDecimals === "number" ? chronikDecimals : fallbackDecimals
}

