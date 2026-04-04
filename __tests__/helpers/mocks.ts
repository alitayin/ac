import { Transaction } from '@/lib/types'

// Mock Chronik client
export const mockChronikClient = {
  tokenId: vi.fn().mockReturnThis(),
  history: vi.fn(),
  address: vi.fn().mockReturnThis(),
  utxos: vi.fn(),
  ws: vi.fn(),
}

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
