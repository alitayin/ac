// Clean orders fixture
export const autoOrdersClean = {
  'token1|addr1|100|rand1': {
    status: 'pending',
    remainingAmount: 100,
    maxPrice: 1,
    transactions: [],
  },
  'token2|addr1|200|rand2': {
    status: 'completed',
    remainingAmount: 0,
    maxPrice: 2,
    transactions: [{ txid: 'tx1', amount: 200 }],
  },
}

// Completed order with non-zero remaining (needs fix)
export const autoOrderCompletedNonZeroRemaining = {
  'token1|addr1|100|rand1': {
    status: 'completed',
    remainingAmount: 50,
    maxPrice: 1,
    orderType: 'online',
    transactions: [{ txid: 'tx1', amount: 50 }],
  },
}

// Completed order with dust remainder (< 100 XEC)
export const autoOrderCompletedDustRemainder = {
  'token1|addr1|100|rand1': {
    status: 'completed',
    remainingAmount: 0.5, // 0.5 * 100 = 50 XEC < 100
    maxPrice: 100,
    orderType: 'online',
    transactions: [{ txid: 'tx1', amount: 99.5 }],
  },
}

// Completed order with non-dust remainder (>= 100 XEC)
export const autoOrderCompletedNonDustRemainder = {
  'token1|addr1|100|rand1': {
    status: 'completed',
    remainingAmount: 2, // 2 * 100 = 200 XEC >= 100
    maxPrice: 100,
    orderType: 'online',
    transactions: [{ txid: 'tx1', amount: 98 }],
  },
}

// Pending order with transactions (needs fix)
export const autoOrderPendingWithTransactions = {
  'token1|addr1|100|rand1': {
    status: 'pending',
    remainingAmount: 50,
    maxPrice: 1,
    transactions: [{ txid: 'tx1', amount: 50 }],
  },
}

// Pending order with transactions and zero remaining
export const autoOrderPendingZeroRemaining = {
  'token1|addr1|100|rand1': {
    status: 'pending',
    remainingAmount: 0,
    maxPrice: 1,
    transactions: [{ txid: 'tx1', amount: 100 }],
  },
}

// Partial order with zero remaining (needs fix)
export const autoOrderPartialZeroRemaining = {
  'token1|addr1|100|rand1': {
    status: 'partial',
    remainingAmount: 0,
    maxPrice: 1,
    transactions: [{ txid: 'tx1', amount: 100 }],
  },
}

// Single pending order (for duplicate test)
export const autoOrderSinglePending = {
  'token1|addr1|100|rand1': {
    status: 'pending',
    remainingAmount: 100,
    maxPrice: 1,
  },
}

// Empty orders
export const autoOrdersEmpty = {}

// Multiple validation errors
export const autoOrdersMultipleErrors = {
  'token1|addr1|100|rand1': {
    status: 'completed',
    remainingAmount: 50,
    maxPrice: 1,
    orderType: 'online',
    transactions: [],
  },
  'token2|addr1|200|rand2': {
    status: 'pending',
    remainingAmount: 100,
    maxPrice: 2,
    transactions: [{ txid: 'tx1', amount: 100 }],
  },
  'token3|addr1|300|rand3': {
    status: 'partial',
    remainingAmount: 0,
    maxPrice: 3,
    transactions: [{ txid: 'tx2', amount: 300 }],
  },
}

// Clone helper for mutation-safe usage
export const cloneOrders = <T>(orders: T): T => JSON.parse(JSON.stringify(orders))
