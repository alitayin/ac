const makerPk = Object.fromEntries(
  Array.from({ length: 33 }, (_, index) => [index.toString(), index + 1]),
)

export const agoraPartialOffer = {
  token: {
    tokenId: 'mock-token-id',
    amount: BigInt(1000000),
    atoms: BigInt(1000000),
  },
  variant: {
    type: 'PARTIAL',
    params: {
      makerPk,
    },
  },
  askedSats: vi.fn(function askedSats() {
    return BigInt(100000)
  }),
}

export const agoraHigherPriceOffer = {
  token: {
    tokenId: 'mock-token-id',
    amount: BigInt(500000),
    atoms: BigInt(500000),
  },
  variant: {
    type: 'PARTIAL',
    params: {
      makerPk,
    },
  },
  askedSats: vi.fn(function askedSats() {
    return BigInt(150000)
  }),
}

export const agoraInvalidMakerPkOffer = {
  token: {
    tokenId: 'mock-token-id',
    amount: BigInt(1000000),
    atoms: BigInt(1000000),
  },
  variant: {
    type: 'PARTIAL',
    params: {
      makerPk: {
        '0': 2,
      },
    },
  },
  askedSats: vi.fn(function askedSats() {
    return BigInt(100000)
  }),
}

export const agoraFallbackDecimalsOffer = {
  token: {
    tokenId: 'fallback-token-id',
    amount: BigInt(1234567),
    atoms: BigInt(1234567),
  },
  variant: {
    type: 'PARTIAL',
    params: {
      makerPk,
    },
  },
  askedSats: vi.fn(function askedSats() {
    return BigInt(24690)
  }),
}

export const agoraInvalidOffer = {
  token: {
    tokenId: 'mock-token-id',
    amount: BigInt(0),
    atoms: BigInt(0),
  },
  variant: {
    type: 'PARTIAL',
    params: {
      makerPk,
    },
  },
  askedSats: vi.fn(function askedSats() {
    return BigInt(100000)
  }),
}
