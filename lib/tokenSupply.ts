import { fetchTokenUtxos, getTokenAmountFromToken } from "@/lib/chronik"

const SUPPLY_CACHE_KEY = "token_supply_cache"
const SUPPLY_TTL_MS = 24 * 60 * 60 * 1000

type SupplyCacheEntry = {
  supply: string
  updatedAt: number
}

type SupplyCache = Record<string, SupplyCacheEntry>

const loadSupplyCache = (): SupplyCache => {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(SUPPLY_CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as SupplyCache
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

const saveSupplyCache = (cache: SupplyCache) => {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(SUPPLY_CACHE_KEY, JSON.stringify(cache))
  } catch {}
}

const getCachedSupply = (tokenId: string): string | null => {
  const cache = loadSupplyCache()
  const entry = cache[tokenId]
  if (!entry) return null

  const now = Date.now()
  if (now - entry.updatedAt > SUPPLY_TTL_MS) {
    delete cache[tokenId]
    saveSupplyCache(cache)
    return null
  }

  return entry.supply
}

const setCachedSupply = (tokenId: string, supply: string) => {
  const cache = loadSupplyCache()
  cache[tokenId] = {
    supply,
    updatedAt: Date.now(),
  }
  saveSupplyCache(cache)
}

const fetchSupplyFromChronik = async (tokenId: string): Promise<string> => {
  if (!tokenId) return "0"

  try {
    const utxos = await fetchTokenUtxos(tokenId)
    let totalAmount = BigInt(0)

    for (const utxo of utxos as any[]) {
      const token = (utxo as any).token
      if (!token) continue

      const rawAmount = getTokenAmountFromToken(token)
      if (rawAmount === BigInt(0)) continue

      totalAmount += rawAmount
    }

    return totalAmount.toString()
  } catch (_error) {
    return "0"
  }
}

export const getTokenSupply = async (tokenId: string): Promise<string> => {
  const cached = getCachedSupply(tokenId)
  if (cached !== null) {
    return cached
  }

  const supply = await fetchSupplyFromChronik(tokenId)
  setCachedSupply(tokenId, supply)
  return supply
}


