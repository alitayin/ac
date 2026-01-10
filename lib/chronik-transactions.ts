import { tokens } from "@/config/tokens"
import {
  chronik,
  fetchTokenDetails,
  getTokenAmountFromToken,
  getTokenDecimalsFromDetails,
} from "./chronik"
import { Transaction } from "./types"

const AGORA_MARKERS = {
  REQUIRED_A: "514d",
  REQUIRED_B: "075041525449414c",
  CANCEL_FLAG: "004d",
}

const FALLBACK_TIMESTAMP = () => Math.floor(Date.now() / 1000)

type TransactionWithStatus = Transaction

const toNumber = (value: any): number => {
  if (typeof value === "bigint") return Number(value)
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const getTokenDecimals = async (tokenId: string): Promise<number> => {
  const tokenConfig = Object.values(tokens).find(t => t.tokenId === tokenId)
  if (tokenConfig && typeof tokenConfig.decimals === "number") {
    return tokenConfig.decimals
  }

  try {
    const tokenDetails = await fetchTokenDetails(tokenId)
    return getTokenDecimalsFromDetails(tokenDetails, 0)
  } catch (_error) {}

  return 0
}

export const isAgoraCanceled = (inputScriptHex: string): boolean => {
  const bytes: string[] = []
  for (let i = 0; i < inputScriptHex.length; i += 2) {
    bytes.push(inputScriptHex.substr(i, 2))
  }

  let pos = 0
  let foundIndependentOP0 = false

  while (pos < bytes.length) {
    const byte = bytes[pos++]

    if (byte === "00") {
      foundIndependentOP0 = true
      continue
    }

    const parsed = parseInt(byte, 16)
    if (parsed > 0 && parsed <= 0x4b) {
      pos += parsed
    } else if (byte === "4c") {
      const dataLength = parseInt(bytes[pos++] || "0", 16)
      pos += dataLength
    } else if (byte === "4d") {
      const dataLength =
        parseInt(bytes[pos++] || "0", 16) +
        (parseInt(bytes[pos++] || "0", 16) << 8)
      pos += dataLength
    } else if (byte === "4e") {
      const dataLength =
        parseInt(bytes[pos++] || "0", 16) +
        (parseInt(bytes[pos++] || "0", 16) << 8) +
        (parseInt(bytes[pos++] || "0", 16) << 16) +
        (parseInt(bytes[pos++] || "0", 16) << 24)
      pos += dataLength
    }
  }

  return foundIndependentOP0
}

export const detectAgoraTokenId = (tx: any): string | null => {
  if (
    !tx ||
    !Array.isArray(tx.inputs) ||
    !Array.isArray(tx.outputs) ||
    !(tx.inputs as any[]).every(
      (input: any) => input && typeof input.inputScript === "string",
    )
  ) {
    return null
  }

  const inputs = tx.inputs
  const outputs = tx.outputs

  const hasRequiredScripts = inputs.some(
    (input: any) =>
      input.inputScript.includes(AGORA_MARKERS.REQUIRED_A) &&
      input.inputScript.includes(AGORA_MARKERS.REQUIRED_B),
  )
  if (!hasRequiredScripts) return null

  const has004d = inputs.some((input: any) =>
    (input.inputScript || "").includes(AGORA_MARKERS.CANCEL_FLAG),
  )
  const isCanceledTx = inputs.some((input: any) =>
    isAgoraCanceled(input.inputScript || ""),
  )
  if (has004d && isCanceledTx) {
    return null
  }

  const tokenOutput =
    outputs[3]?.token || outputs[2]?.token
      ? outputs[3]?.token ?? outputs[2]?.token
      : null
  if (!tokenOutput) return null

  const tokenId =
    (tokenOutput as any).tokenId ||
    (tokenOutput as any).tokenIdHex ||
    (tokenOutput as any).tokenIdStr ||
    null
  if (!tokenId) return null

  const rawTokenAmount = getTokenAmountFromToken(tokenOutput)
  if (rawTokenAmount <= BigInt(0)) {
    return null
  }

  return tokenId
}

const processMatchedTransaction = (
  tx: any,
  divisor: number,
): TransactionWithStatus | null => {
  if (
    !tx ||
    !Array.isArray(tx.inputs) ||
    !Array.isArray(tx.outputs) ||
    !(tx.inputs as any[]).every(
      (input: any) => input && typeof input.inputScript === "string",
    )
  ) {
    return null
  }

  const inputs = tx.inputs
  const outputs = tx.outputs

  const hasRequiredScripts = inputs.some(
    (input: any) =>
      input.inputScript.includes(AGORA_MARKERS.REQUIRED_A) &&
      input.inputScript.includes(AGORA_MARKERS.REQUIRED_B),
  )
  if (!hasRequiredScripts) return null

  const has004d = inputs.some((input: any) =>
    (input.inputScript || "").includes(AGORA_MARKERS.CANCEL_FLAG),
  )
  const isCanceledTx = inputs.some((input: any) =>
    isAgoraCanceled(input.inputScript || ""),
  )
  if (has004d && isCanceledTx) {
    return null
  }

  const tokenOutput =
    outputs[3]?.token || outputs[2]?.token
      ? outputs[3]?.token ?? outputs[2]?.token
      : null
  if (!tokenOutput) return null

  const xecOutput = outputs[1]
  if (!xecOutput) return null

  const xecSats =
    typeof xecOutput.sats !== "undefined"
      ? xecOutput.sats
      : typeof xecOutput.value !== "undefined"
        ? xecOutput.value
        : 0
  const xecAmountSats = toNumber(xecSats)

  const rawTokenAmount = getTokenAmountFromToken(tokenOutput)
  const tokenAmount = divisor > 0 ? Number(rawTokenAmount) / divisor : 0
  if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) {
    return null
  }

  const price = (xecAmountSats / tokenAmount) / 100
  const timestamp = (() => {
    const candidates = [tx.block?.timestamp, tx.timeFirstSeen].filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value) && value > 0,
    )

    if (candidates.length === 0) {
      return FALLBACK_TIMESTAMP()
    }

    const best = Math.min(...candidates)
    const nowSec = Math.floor(Date.now() / 1000)
    return Math.min(best, nowSec)
  })()
  const blockHeight = typeof tx.block?.height === "number" ? tx.block.height : undefined

  const txid = tx.txid || tx.hash
  if (!txid) return null

  return {
    txid,
    price,
    amount: tokenAmount,
    time: new Date(timestamp * 1000).toISOString(),
    timestamp,
    blockHeight,
    status: "sold",
  }
}

type BatchHandler = (batch: Transaction[], meta: { page: number }) => void

interface FetchOptions {
  pageSize?: number
  targetCount?: number
  maxBlocksBack?: number
  stopBelowHeight?: number
  failOnError?: boolean
}


export const fetchAgoraTransactionsFromChronik = async (
  tokenId: string,
  onBatch?: BatchHandler,
  options: FetchOptions = {},
): Promise<TransactionWithStatus[]> => {
  if (!tokenId) return []

  const pageSize = options.pageSize ?? 200
  const targetCount = options.targetCount ?? 100
  const maxBlocksBack = options.maxBlocksBack
  const stopBelowHeight = options.stopBelowHeight
  const failOnError = options.failOnError ?? false

  const decimals = await getTokenDecimals(tokenId)
  const divisor = Math.pow(10, decimals || 0)

  const result: TransactionWithStatus[] = []
  let latestBlockHeight: number | null = null

  for (let page = 0; ; page++) {
    try {
      const history = await (chronik.tokenId(tokenId) as any).history(
        page,
        pageSize,
      )
      const txs = history?.txs || []

      const batch: TransactionWithStatus[] = []
      let shouldStop = false
      txs.forEach((tx: any) => {
        const matchedTx = processMatchedTransaction(tx, divisor)
        if (matchedTx) {
          if (!latestBlockHeight && typeof matchedTx.blockHeight === "number") {
            latestBlockHeight = matchedTx.blockHeight
          }

          if (
            maxBlocksBack &&
            latestBlockHeight &&
            typeof matchedTx.blockHeight === "number"
          ) {
            const cutoffHeight = latestBlockHeight - maxBlocksBack
            if (matchedTx.blockHeight < cutoffHeight) {
              shouldStop = true
              return
            }
          }

          if (
            typeof stopBelowHeight === "number" &&
            typeof matchedTx.blockHeight === "number" &&
            matchedTx.blockHeight <= stopBelowHeight
          ) {
            shouldStop = true
            return
          }

          batch.push(matchedTx)
          result.push(matchedTx)
        }
      })

      if (batch.length > 0 && onBatch) {
        onBatch(batch, { page })
      }

      const reachedTarget = result.length >= targetCount
      const noMorePages = txs.length < pageSize
      if (reachedTarget || noMorePages || shouldStop) {
        break
      }
    } catch (error) {
      if (failOnError) {
        throw error
      }
      break
    }
  }

  return result.sort((a, b) => b.timestamp - a.timestamp)
}

