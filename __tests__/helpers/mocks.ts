import { Transaction } from '@/lib/types'

// Mock Chronik client
export const mockChronikClient = {
  tokenId: vi.fn().mockReturnThis(),
  history: vi.fn(),
  address: vi.fn().mockReturnThis(),
  utxos: vi.fn(),
  ws: vi.fn(),
}

// Mock Agora client
export const mockAgoraClient = {
  activeOffersByTokenId: vi.fn(),
}

// Mock transaction data
export const createMockTransaction = (overrides?: Partial<any>) => ({
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
  ...overrides,
})

// Mock canceled transaction
export const createCanceledTransaction = () => ({
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
})

// Mock processed transaction
export const createMockProcessedTransaction = (overrides?: Partial<Transaction>): Transaction => ({
  txid: 'mock-txid-123',
  price: 0.1,
  amount: 1000,
  time: new Date(1700000000 * 1000).toISOString(),
  timestamp: 1700000000,
  blockHeight: 800000,
  status: 'sold',
  ...overrides,
})

// Mock Agora offer
export const createMockAgoraOffer = (overrides?: Partial<any>) => ({
  token: {
    tokenId: 'mock-token-id',
    amount: BigInt(1000000),
    atoms: BigInt(1000000),
  },
  variant: {
    type: 'PARTIAL',
    params: {
      makerPk: {
        '0': 2, '1': 123, '2': 45, '3': 67, '4': 89, '5': 12, '6': 34, '7': 56,
        '8': 78, '9': 90, '10': 11, '11': 22, '12': 33, '13': 44, '14': 55, '15': 66,
        '16': 77, '17': 88, '18': 99, '19': 10, '20': 20, '21': 30, '22': 40, '23': 50,
        '24': 60, '25': 70, '26': 80, '27': 90, '28': 100, '29': 110, '30': 120, '31': 130, '32': 140,
      },
    },
  },
  askedSats: vi.fn((tokens?: bigint) => BigInt(100000)),
  ...overrides,
})

// Mock token details
export const mockTokenDetails = {
  tokenId: 'mock-token-id',
  tokenType: {
    protocol: 'SLP',
    type: 'SLP_TOKEN_TYPE_FUNGIBLE',
    number: 1,
  },
  genesisInfo: {
    tokenTicker: 'MOCK',
    tokenName: 'Mock Token',
    decimals: 2,
  },
}

// Mock localStorage data
export const mockCachedTokenData = {
  computedAt: Date.now(),
  latestProcessedHeight: 800000,
  last30DaysXECAmount: 50000,
  totalTransactions: 100,
}

export const mockCachedTokenSummary = {
  computedAt: Date.now(),
  data: {
    latestPrice: 0.1,
    priceChange24h: 5.5,
    last24HoursXECAmount: 10000,
    totalTransactions: 50,
  },
}
