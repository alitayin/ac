export const chronikTxAgoraSale = {
  txid: 'mock-txid-123',
  inputs: [
    {
      inputScript: '514d075041525449414c',
    },
  ],
  outputs: [
    {},
    { sats: 100000, value: 100000 },
    {},
    {
      token: {
        tokenId: 'mock-token-id',
        amount: BigInt(1000000),
        atoms: BigInt(1000000),
      },
    },
  ],
  block: {
    height: 800000,
    timestamp: 1700000000,
  },
  timeFirstSeen: 1700000000,
}

export const chronikTxAgoraCanceled = {
  txid: 'canceled-txid-456',
  inputs: [
    {
      inputScript: '004d514d075041525449414c',
    },
  ],
  outputs: [
    {},
    { sats: 100000 },
    {},
    {
      token: {
        tokenId: 'mock-token-id',
        amount: BigInt(1000000),
      },
    },
  ],
  block: {
    height: 800000,
    timestamp: 1700000000,
  },
}

export const chronikTxTokenFromOutput2 = {
  ...chronikTxAgoraSale,
  outputs: [
    {},
    { sats: 100000 },
    {
      token: {
        tokenId: 'token-from-output-2',
        amount: BigInt(5000),
      },
    },
    {},
  ],
}

export const chronikTxTokenIdHex = {
  ...chronikTxAgoraSale,
  outputs: [
    {},
    { sats: 100000 },
    {},
    {
      token: {
        tokenIdHex: 'token-id-hex-format',
        amount: BigInt(1000),
      },
    },
  ],
}

export const chronikTxTokenIdStr = {
  ...chronikTxAgoraSale,
  outputs: [
    {},
    { sats: 100000 },
    {},
    {
      token: {
        tokenIdStr: 'token-id-str-format',
        amount: BigInt(1000),
      },
    },
  ],
}

export const chronikTxInvalidTimestamps = {
  ...chronikTxAgoraSale,
  block: {
    height: 800000,
    timestamp: -1,
  },
  timeFirstSeen: 0,
}

export const chronikTxWithoutTxid = {
  ...chronikTxAgoraSale,
  hash: 'fallback-hash-value',
}

delete (chronikTxWithoutTxid as any).txid

export const chronikHistoryPageTargetCount = Array.from({ length: 5 }, (_, index) => ({
  ...chronikTxAgoraSale,
  txid: `target-count-${index}`,
}))

export const chronikHistoryPageShort = Array.from({ length: 50 }, (_, index) => ({
  ...chronikTxAgoraSale,
  txid: `short-page-${index}`,
}))

export const chronikHistoryPageMaxBlocksBackFirst = [
  { ...chronikTxAgoraSale, block: { height: 800000, timestamp: 1000 }, txid: 'max-back-1' },
  { ...chronikTxAgoraSale, block: { height: 799900, timestamp: 1000 }, txid: 'max-back-2' },
]

export const chronikHistoryPageMaxBlocksBackSecond = [
  { ...chronikTxAgoraSale, block: { height: 799800, timestamp: 1000 }, txid: 'max-back-3' },
]

export const chronikHistoryPageStopBelowHeight = [
  { ...chronikTxAgoraSale, block: { height: 800100, timestamp: 1000 }, txid: 'stop-height-1' },
  { ...chronikTxAgoraSale, block: { height: 800001, timestamp: 1000 }, txid: 'stop-height-2' },
  { ...chronikTxAgoraSale, block: { height: 799999, timestamp: 1000 }, txid: 'stop-height-3' },
]

export const cloneChronikTx = <T>(tx: T, overrides?: Partial<T>): T => ({
  ...tx,
  ...overrides,
})
