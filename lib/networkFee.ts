import { calcTxFee, DEFAULT_FEE_SATS_PER_KB } from "ecash-lib"

import { fetchAddressXecUtxos } from "@/lib/chronik"

const SATS_PER_XEC = 100n
const P2PKH_INPUT_BYTES = 148
const P2PKH_OUTPUT_BYTES = 34
const TX_OVERHEAD_BYTES = 10

// Agora accept txs include one offer input in addition to the buyer's XEC inputs.
const AGORA_FIXED_INPUT_COUNT = 1
const AGORA_OUTPUT_COUNT = 5
const DEFAULT_FUEL_INPUT_COUNT = 1
const DEFAULT_REFERENCE_SPEND_XEC = 100

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

const xecToSats = (value: number): bigint => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0n
  }

  return BigInt(Math.ceil(value * Number(SATS_PER_XEC)))
}

const satsToXec = (value: bigint): number => Number(value) / Number(SATS_PER_XEC)

export const estimateAgoraNetworkFeeXec = (
  fuelInputCount: number = DEFAULT_FUEL_INPUT_COUNT,
): number => {
  const normalizedFuelInputs = Math.max(DEFAULT_FUEL_INPUT_COUNT, Math.floor(fuelInputCount))
  const txBytes =
    (AGORA_FIXED_INPUT_COUNT + normalizedFuelInputs) * P2PKH_INPUT_BYTES +
    AGORA_OUTPUT_COUNT * P2PKH_OUTPUT_BYTES +
    TX_OVERHEAD_BYTES

  return satsToXec(calcTxFee(txBytes, DEFAULT_FEE_SATS_PER_KB))
}

export const DEFAULT_BASE_NETWORK_FEE_XEC = estimateAgoraNetworkFeeXec()

export const estimateNetworkFeeXecFromUtxos = (
  xecUtxos: XecUtxoLike[],
  referenceSpendXec: number = DEFAULT_REFERENCE_SPEND_XEC,
): { fee: number; utxoCount: number; selectedInputCount: number } => {
  const utxos = [...xecUtxos]
    .map((utxo) => ({
      sats: getUtxoSats(utxo),
    }))
    .filter((utxo) => utxo.sats > 0n)
    .sort((a, b) => (a.sats === b.sats ? 0 : a.sats > b.sats ? -1 : 1))

  const utxoCount = utxos.length

  if (utxoCount === 0) {
    return {
      fee: DEFAULT_BASE_NETWORK_FEE_XEC,
      utxoCount: 0,
      selectedInputCount: DEFAULT_FUEL_INPUT_COUNT,
    }
  }

  const spendTargetSats = xecToSats(referenceSpendXec)
  let selectedSats = 0n
  let selectedInputCount = 0

  for (const utxo of utxos) {
    selectedInputCount += 1
    selectedSats += utxo.sats

    if (spendTargetSats === 0n || selectedSats >= spendTargetSats) {
      break
    }
  }

  const normalizedInputCount = Math.max(DEFAULT_FUEL_INPUT_COUNT, selectedInputCount)

  return {
    fee: estimateAgoraNetworkFeeXec(normalizedInputCount),
    utxoCount,
    selectedInputCount: normalizedInputCount,
  }
}

export const estimateNetworkFeeXecFromAddress = async (
  address: string,
  referenceSpendXec: number = DEFAULT_REFERENCE_SPEND_XEC,
): Promise<{ fee: number; utxoCount: number; selectedInputCount: number }> => {
  if (!address) {
    throw new Error("address is required")
  }

  const xecUtxos = await fetchAddressXecUtxos(address)
  return estimateNetworkFeeXecFromUtxos(xecUtxos, referenceSpendXec)
}
