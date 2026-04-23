import { estimateAgoraTokenCostFromBudget } from "@/lib/agora-swap-fee";

interface AgoraSweepOrder {
  price: number;
  amount: number;
}

interface AgoraSweepOrderBook {
  orders?: AgoraSweepOrder[];
  stats?: {
    total_value?: number;
  };
}

type AgoraSweepBuyErrorReason =
  | "INVALID_INPUT"
  | "NO_ORDERBOOK"
  | "INSUFFICIENT_BUDGET"
  | "EXCEEDS_AVAILABLE_AMOUNT"
  | "NO_LIQUIDITY";

interface AgoraSweepBuyBaseResult {
  availableSpendXec: number;
  marketPrice: number;
  totalValueXec: number;
}

interface AgoraSweepBuySuccessResult extends AgoraSweepBuyBaseResult {
  ok: true;
  avgExecutionPrice: number;
  maxPrice: number;
  receiveAmount: number;
  slippagePercent: number;
  totalCostXec: number;
}

interface AgoraSweepBuyErrorResult extends AgoraSweepBuyBaseResult {
  ok: false;
  reason: AgoraSweepBuyErrorReason;
}

export type AgoraSweepBuyResult =
  | AgoraSweepBuySuccessResult
  | AgoraSweepBuyErrorResult;

interface CalculateAgoraSweepBuyParams {
  networkFeeXec: number;
  orderBook: AgoraSweepOrderBook | null | undefined;
  spendAmountXec: number;
}

const EMPTY_ERROR_RESULT: AgoraSweepBuyErrorResult = {
  ok: false,
  reason: "INVALID_INPUT",
  availableSpendXec: 0,
  marketPrice: 0,
  totalValueXec: 0,
};

export function calculateAgoraSweepBuy({
  networkFeeXec,
  orderBook,
  spendAmountXec,
}: CalculateAgoraSweepBuyParams): AgoraSweepBuyResult {
  if (!Number.isFinite(spendAmountXec) || spendAmountXec <= 0) {
    return EMPTY_ERROR_RESULT;
  }

  const sortedOrders = [...(orderBook?.orders || [])].sort(
    (a, b) => a.price - b.price,
  );
  const marketPrice = sortedOrders[0]?.price || 0;
  const totalValueXec =
    Number(orderBook?.stats?.total_value || 0) ||
    sortedOrders.reduce((sum, order) => sum + order.price * order.amount, 0);

  if (sortedOrders.length === 0 || marketPrice <= 0) {
    return {
      ok: false,
      reason: "NO_ORDERBOOK",
      availableSpendXec: 0,
      marketPrice,
      totalValueXec,
    };
  }

  const availableSpendXec = estimateAgoraTokenCostFromBudget(
    spendAmountXec,
    networkFeeXec,
  );

  if (availableSpendXec <= 0) {
    return {
      ok: false,
      reason: "INSUFFICIENT_BUDGET",
      availableSpendXec,
      marketPrice,
      totalValueXec,
    };
  }

  if (availableSpendXec > totalValueXec) {
    return {
      ok: false,
      reason: "EXCEEDS_AVAILABLE_AMOUNT",
      availableSpendXec,
      marketPrice,
      totalValueXec,
    };
  }

  let remainingXec = availableSpendXec;
  let totalTokens = 0;
  let totalCost = 0;
  let highestPrice = 0;

  for (const order of sortedOrders) {
    const orderCost = order.price * order.amount;

    if (remainingXec >= orderCost) {
      totalTokens += order.amount;
      totalCost += orderCost;
      remainingXec -= orderCost;
      highestPrice = order.price;
    } else {
      const partialAmount = remainingXec / order.price;
      totalTokens += partialAmount;
      totalCost += remainingXec;
      highestPrice = order.price;
      break;
    }

    if (remainingXec <= 0) {
      break;
    }
  }

  if (totalTokens <= 0 || totalCost <= 0 || highestPrice <= 0) {
    return {
      ok: false,
      reason: "NO_LIQUIDITY",
      availableSpendXec,
      marketPrice,
      totalValueXec,
    };
  }

  const avgExecutionPrice = totalCost / totalTokens;
  const slippagePercent =
    marketPrice > 0
      ? Math.max(0, ((avgExecutionPrice - marketPrice) / marketPrice) * 100)
      : 0;

  return {
    ok: true,
    availableSpendXec,
    avgExecutionPrice,
    marketPrice,
    maxPrice: highestPrice,
    receiveAmount: totalTokens,
    slippagePercent,
    totalCostXec: totalCost,
    totalValueXec,
  };
}
