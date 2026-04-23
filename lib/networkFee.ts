import { fetchAddressXecUtxos } from "@/lib/chronik"

export const DEFAULT_BASE_NETWORK_FEE_XEC = 10
export const DEFAULT_PER_UTXO_FEE_XEC = 6

type XecUtxoLike = {
  sats?: bigint | number | string
  value?: bigint | number | string
}

const toSatsBigInt = (value: bigint | number | string | undefined): bigint => {
  if (typeof value === "bigint") {
    return value
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) {
      return 0n
    }

    return BigInt(Math.floor(value))
  }

  if (typeof value === "string") {
    try {
      const normalized = value.trim()
      if (!normalized) {
        return 0n
      }

      return BigInt(normalized)
    } catch {
      return 0n
    }
  }

  return 0n
}

const getUtxoSats = (utxo: XecUtxoLike): bigint => {
  const sats = toSatsBigInt(utxo.sats)
  if (sats > 0n) {
    return sats
  }

  return toSatsBigInt(utxo.value)
}

const getSpendableUtxoCount = (xecUtxos: XecUtxoLike[]): number => {
  return xecUtxos.filter((utxo) => getUtxoSats(utxo) > 0n).length
}

export const estimateAgoraNetworkFeeXec = (
  utxoCount: number = 0,
  baseFee: number = DEFAULT_BASE_NETWORK_FEE_XEC,
  perUtxoFee: number = DEFAULT_PER_UTXO_FEE_XEC,
): number => {
  const normalizedUtxoCount = Number.isFinite(utxoCount)
    ? Math.max(0, Math.floor(utxoCount))
    : 0

  return Math.max(baseFee, baseFee + perUtxoFee * normalizedUtxoCount)
}

export const estimateNetworkFeeXecFromUtxos = (
  xecUtxos: XecUtxoLike[],
  _referenceSpendXec = 0,
): { fee: number; utxoCount: number; selectedInputCount: number } => {
  const utxoCount = getSpendableUtxoCount(xecUtxos)

  return {
    fee: estimateAgoraNetworkFeeXec(utxoCount),
    utxoCount,
    selectedInputCount: utxoCount,
  }
}

export const estimateNetworkFeeXecFromAddress = async (
  address: string,
  _referenceSpendXec = 0,
): Promise<{ fee: number; utxoCount: number; selectedInputCount: number }> => {
  if (!address) {
    throw new Error("address is required")
  }

  const xecUtxos = await fetchAddressXecUtxos(address)
  return estimateNetworkFeeXecFromUtxos(xecUtxos)
}
