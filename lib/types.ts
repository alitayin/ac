/**
 * Shared type definitions for the application
 */

// Token Data Types
export interface Token {
  id: string;
  tokenId: string;
  name: string;
  totalTransactions: number;
  last24HoursXECAmount: number;
  last30DaysXECAmount: number;
  last30DaysVolumeXECAmount: number;
  priceChange24h: number;
  latestPrice: number;
  totalXECAmount: number;
  has30DayVolume?: boolean;
  hasInitialMarketData?: boolean;
  hasResolvedTokenInfo?: boolean;
  official?: boolean;
  gratitude?: boolean;
  community?: boolean;
  stablecoin?: boolean;
  apyTag?: string;
  watchlist?: boolean;
  reviewAverageScore: number | null;
  reviewScorerCount: number;
  reviewCountTotal: number;
  reviewCommentCountTotal: number;
  lastReviewAt: number | null;
}

// Transaction Data Types
export interface Transaction {
  txid: string;
  price: number;
  amount: number;
  time: string;
  timestamp: number;
  blockHeight?: number;
  status?: 'sold';
}

// Volume Chart Data Types
export interface VolumeData {
  date: string;
  amount: number;
  token: number;
  matchedTxCount: number;
  totalTxCount: number;
  highPrice: number | null;
  lowPrice: number | null;
  closePrice: number | null;
}

// Realtime Price Chart Data Types (extended VolumeData)
export interface RealtimePriceData {
  date: string;
  amount: number;
  token: number;
  matchedTxCount: number;
  totalTxCount: number;
  averagePrice: number;
  latestPrice: number;
}

// Sort Types
export type SortType = '24h' | '7d' | 'history' | 'score';

// Component Props Types
export interface TokenComponentProps {
  tokenId: string;
}

export interface TokenListComponentProps {
  tokenIds: string[];
}

// Holder Data Types
export interface Holder {
  address: string;
  amount: string;
}

export interface HoldersData {
  totalHolders: number;
  totalAmount: string;
  holders: Holder[];
}

// Chart Data Types
export interface PieChartData {
  browser: string;
  amount: number;
  fill: string;
}

// Order Book Types
export interface Order {
  price: number;
  amount: number;
  total: number;
  makerAddress?: string;
}

export interface OrderBookProps {
  orderBook: {
    orders: Order[];
  };
  className?: string;
  tokenId: string;
  latestPrice?: number;
}

export interface BuyOrderResponse {
  error?: boolean;
  orders?: Array<{
    maxPrice: number;
    remainingAmount: number;
    [key: string]: any;
  }>;
}
