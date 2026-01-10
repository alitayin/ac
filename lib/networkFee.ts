import { fetchAddressXecUtxos } from "@/lib/chronik"

export const DEFAULT_BASE_NETWORK_FEE_XEC = 20
export const DEFAULT_PER_UTXO_FEE_XEC = 6

export const estimateNetworkFeeXecFromAddress = async (
  address: string,
  baseFee: number = DEFAULT_BASE_NETWORK_FEE_XEC,
  perUtxoFee: number = DEFAULT_PER_UTXO_FEE_XEC,
): Promise<{ fee: number; utxoCount: number }> => {
  if (!address) {
    throw new Error("address is required")
  }

  const xecUtxos = await fetchAddressXecUtxos(address)
  const utxoCount = xecUtxos.length
  const rawFee = baseFee + perUtxoFee * utxoCount
  const fee = Math.max(rawFee, baseFee)

  return { fee, utxoCount }
}


