import { Agora } from "ecash-agora"
import { encodeCashAddress } from "ecashaddrjs"
import { shaRmd160 } from "ecash-lib"
import { chronik, fetchTokenDetails, getTokenDecimalsFromDetails, getTokenAmountFromToken } from "./chronik"
import { tokens } from "@/config/tokens"
import type { Order } from "./types"

type AgoraOrderBookStats = {
  count: number
  min_price: number
  max_price: number
  avg_price: number
  total_amount: number
  total_value: number
}

export type AgoraOrderBookResponse = {
  success: boolean
  data?: {
    orders: Order[]
    stats: AgoraOrderBookStats
  }
  error?: string
}

let agoraClient: Agora | null = null
const decimalsCache = new Map<string, number>()

const getAgoraClient = () => {
  if (!agoraClient) {
    agoraClient = new Agora(chronik)
  }
  return agoraClient
}

const makerPkToBytes = (makerPk: Record<string, number> | undefined | null): Uint8Array | null => {
  if (!makerPk || typeof makerPk !== "object") return null

  const bytes = new Uint8Array(33)
  for (let i = 0; i < 33; i++) {
    const value = makerPk[i.toString()]
    if (typeof value !== "number") return null
    bytes[i] = value
  }

  return bytes
}

const getMakerAddress = (makerPk: Record<string, number> | undefined | null): string | null => {
  try {
    const publicKeyBytes = makerPkToBytes(makerPk)
    if (!publicKeyBytes) return null
    const pkh = shaRmd160(publicKeyBytes)
    return encodeCashAddress("ecash", "p2pkh", pkh)
  } catch (error) {
    return null
  }
}

const getTokenDecimals = async (tokenId: string): Promise<number> => {
  if (decimalsCache.has(tokenId)) {
    return decimalsCache.get(tokenId) as number
  }

  const tokenConfig = Object.values(tokens).find((t) => t.tokenId === tokenId)
  if (typeof tokenConfig?.decimals === "number") {
    decimalsCache.set(tokenId, tokenConfig.decimals)
    return tokenConfig.decimals
  }

  try {
    const details = await fetchTokenDetails(tokenId)
    const decimals = getTokenDecimalsFromDetails(details, 0)
    decimalsCache.set(tokenId, decimals)
    return decimals
  } catch (error) {
  }

  decimalsCache.set(tokenId, 0)
  return 0
}

const formatOffer = (offer: any, divisor: number): Order | null => {
  try {
    const totalTokens = getTokenAmountFromToken(offer.token)
    if (totalTokens <= BigInt(0)) return null
    
    const totalSats = offer.variant.type === 'PARTIAL' 
      ? offer.askedSats(totalTokens)
      : offer.askedSats()
    
    const totalXEC = Number(totalSats) / 100
    const adjustedTokens = Number(totalTokens) / divisor
    const pricePerToken = totalXEC / adjustedTokens
    const makerAddress = getMakerAddress(offer?.variant?.params?.makerPk)

    return {
      price: Number(pricePerToken.toFixed(8)),
      amount: adjustedTokens,
      total: Number(totalXEC.toFixed(8)),
      makerAddress: makerAddress || undefined,
    }
  } catch (error) {
    return null
  }
}

const calculateStats = (orders: Order[]): AgoraOrderBookStats => {
  if (!orders.length) {
    return {
      count: 0,
      min_price: 0,
      max_price: 0,
      avg_price: 0,
      total_amount: 0,
      total_value: 0,
    }
  }

  const prices = orders.map((o) => o.price)
  const totals = orders.map((o) => o.total)
  const amounts = orders.map((o) => o.amount)

  const avgPrice = prices.reduce((a, b) => a + b, 0) / orders.length
  const totalAmount = amounts.reduce((a, b) => a + b, 0)
  const totalValue = totals.reduce((a, b) => a + b, 0)

  return {
    count: orders.length,
    min_price: Math.min(...prices),
    max_price: Math.max(...prices),
    avg_price: Number(avgPrice.toFixed(8)),
    total_amount: Number(totalAmount.toFixed(8)),
    total_value: Number(totalValue.toFixed(8)),
  }
}

export const fetchAgoraOrderBook = async (
  tokenId: string,
): Promise<AgoraOrderBookResponse> => {
  if (!tokenId) {
    return {
      success: false,
      error: "tokenId is required",
    }
  }

  try {
    const decimals = await getTokenDecimals(tokenId)
    const divisor = Math.pow(10, decimals || 0)
    const offers = await getAgoraClient().activeOffersByTokenId(tokenId)

    const orders = offers
      .map((offer: any) => formatOffer(offer, divisor))
      .filter(Boolean) as Order[]

    orders.sort((a, b) => b.price - a.price)

    return {
      success: true,
      data: {
        orders,
        stats: calculateStats(orders),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}


