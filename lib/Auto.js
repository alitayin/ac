import { main } from './Buy.js';
import { chronik, getCachedTokenDetails, getTokenDecimalsFromDetails } from './chronik.ts';
import { dispatchOrdersUpdated } from './swap-order-utils';
import { API_BASE_URL } from './constants.ts';
import { tokens } from '@/config/tokens';
const SERVER_URL = API_BASE_URL;
const SERVER_SYNC_TIMEOUT_MS = 5000;
const REMAINING_VALUE_AUTO_COMPLETE_XEC = 100; // auto-complete dust remainders
const tokenInfoCache = {};

// Execution lock to prevent concurrent processOrders calls
let isProcessingOrders = false;
let processingPromise = null;
const processingOrders = new Set(); // Track individual orders being processed
const pendingOrderSyncQueue = [];
let isDrainingOrderSyncQueue = false;

function cloneOrdersSnapshot(orders) {
  try {
    return JSON.parse(JSON.stringify(orders || {}));
  } catch (_error) {
    if (!orders || typeof orders !== 'object') {
      return {};
    }
    return { ...orders };
  }
}

function isAbortError(error) {
  return (
    error?.name === 'AbortError' ||
    error?.code === 20 ||
    error?.message === 'The operation was aborted.'
  );
}

async function fetchWithTimeout(url, options = {}, timeoutMs = SERVER_SYNC_TIMEOUT_MS) {
  if (typeof AbortController === 'undefined' || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return fetch(url, options);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function drainOrderSyncQueue() {
  if (isDrainingOrderSyncQueue) {
    return;
  }

  isDrainingOrderSyncQueue = true;

  try {
    while (pendingOrderSyncQueue.length > 0) {
      const task = pendingOrderSyncQueue.shift();
      if (!task) {
        continue;
      }

      try {
        const synced = await pushOrdersToServer(task.orders, task.address);
        task.resolve(synced);
      } catch (_error) {
        task.resolve(false);
      }
    }
  } finally {
    isDrainingOrderSyncQueue = false;

    if (pendingOrderSyncQueue.length > 0) {
      void drainOrderSyncQueue();
    }
  }
}

async function getBuyerMnemonic() {
  try {
    const savedMnemonic = localStorage.getItem('wallet_mnemonic');
    if (!savedMnemonic) {
      throw new Error('Mnemonic not found, please connect the wallet first');
    }
    return savedMnemonic;
  } catch (_error) {
    throw new Error('Unable to get a valid mnemonic, please ensure the wallet is connected');
  }
}

async function getTokenInfo(tokenId, maxRetries = 5, retryDelay = 500) {
  if (tokenInfoCache[tokenId]) {
    return tokenInfoCache[tokenId];
  }

  const configuredToken = Object.values(tokens).find(
    (token) => token.tokenId === tokenId,
  );
  const fallbackDecimals =
    typeof configuredToken?.decimals === 'number' ? configuredToken.decimals : 0;
  const cachedTokenDetails = getCachedTokenDetails(tokenId);

  if (cachedTokenDetails) {
    tokenInfoCache[tokenId] = {
      decimals: getTokenDecimalsFromDetails(cachedTokenDetails, fallbackDecimals),
      ticker:
        cachedTokenDetails.genesisInfo?.tokenTicker ||
        configuredToken?.symbol ||
        'UNKNOWN',
      name:
        cachedTokenDetails.genesisInfo?.tokenName ||
        configuredToken?.name ||
        'Unknown Token',
    };
    return tokenInfoCache[tokenId];
  }

  if (typeof configuredToken?.decimals === 'number') {
    tokenInfoCache[tokenId] = {
      decimals: configuredToken.decimals,
      ticker: configuredToken.symbol || 'UNKNOWN',
      name: configuredToken.name || 'Unknown Token',
    };
    return tokenInfoCache[tokenId];
  }

  let retries = 0;

  while (retries < maxRetries) {
    try {
      const tokenInfo = await chronik.token(tokenId);

      tokenInfoCache[tokenId] = {
        decimals: tokenInfo.genesisInfo.decimals,
        ticker: tokenInfo.genesisInfo.tokenTicker,
        name: tokenInfo.genesisInfo.tokenName
      };

      return tokenInfoCache[tokenId];
    } catch (_error) {
      retries++;

      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay *= 1.5;
      } else {
        return { decimals: 0, ticker: 'UNKNOWN', name: 'Unknown Token' };
      }
    }
  }

  return { decimals: 0, ticker: 'UNKNOWN', name: 'Unknown Token' };
}

function sortObjectDeep(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectDeep);
  }

  const sortedObj = {};
  Object.keys(obj).sort().forEach(key => {
    sortedObj[key] = sortObjectDeep(obj[key]);
  });

  return sortedObj;
}

function getObjectHash(obj) {
  const sortedObj = sortObjectDeep(obj);
  const str = JSON.stringify(sortedObj);
  let hash = 2166136261;

  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

function isBrowserOrderSyncRuntime() {
  return typeof window !== 'undefined';
}

function logOrderSyncFailure(stage, details) {
  console.error(`[OrderSync] ${stage}`, details);
}

async function checkServerDataHash(
  orders,
  address,
  maxRetries = 3,
  retryDelay = 1000,
  requestTimeoutMs = SERVER_SYNC_TIMEOUT_MS,
) {
  const orderHashes = {};
  for (const [key, value] of Object.entries(orders)) {
    if (key.includes(`|${address}|`)) {
      orderHashes[key] = getObjectHash(value);
    }
  }

  let retries = 0;

  while (retries <= maxRetries) {
    try {
      const requestUrl = `${SERVER_URL}/orders/check-hash/${address}`;
      const requestBody = JSON.stringify({ orderHashes });

      const response = await fetchWithTimeout(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
      }, requestTimeoutMs);

      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(
          `Hash check failed with ${response.status}: ${responseText.substring(0, 200)}`,
        );
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (_parseError) {
        throw new Error(`Server response cannot be parsed: ${responseText.substring(0, 100)}`);
      }

      return {
        match: result.match,
        message: result.message,
        diffKeys: result.diffKeys || []
      };
    } catch (error) {
      retries++;

      if (retries <= maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay *= 1.5;
      } else {
        return { 
          match: false, 
          message: `Failed to connect to server: ${error.message}`, 
          diffKeys: [],
          error: error
        };
      }
    }
  }
}

function validateOrdersData(orders) {
  const errors = [];
  const keys = Object.keys(orders);

  if (keys.length !== new Set(keys).size) {
    errors.push('Duplicate order keys found');
  }

  for (const [key, order] of Object.entries(orders)) {
    if (order.status === 'completed' && order.remainingAmount !== 0) {
      if (order.orderType === 'online' && order.maxPrice > 0) {
        const remainingValue = order.remainingAmount * order.maxPrice;
        if (remainingValue < REMAINING_VALUE_AUTO_COMPLETE_XEC) {
          order.remainingAmount = 0;
        } else {
          errors.push(`Order ${key} is completed but remainingAmount is not 0`);
          order.remainingAmount = 0;
        }
      } else {
        errors.push(`Order ${key} is completed but remainingAmount is not 0`);
        order.remainingAmount = 0;
      }
    }

    if (order.status === 'pending' && order.transactions && order.transactions.length > 0) {
      errors.push(`Order ${key} is pending but has transaction records`);
      if (order.remainingAmount === 0) {
        order.status = 'completed';
      } else {
        order.status = 'partial';
      }
    }

    if (order.status === 'partial' && order.remainingAmount === 0) {
      errors.push(`Order ${key} is partial but remainingAmount is 0`);
      order.status = 'completed';
    }
  }

  return {
    valid: true,
    errors,
    fixedOrders: orders
  };
}

async function pushOrdersToServer(orders, address, requestTimeoutMs = SERVER_SYNC_TIMEOUT_MS) {
  try {
    const validationResult = validateOrdersData(orders);
    if (validationResult.errors.length > 0) {
      orders = validationResult.fixedOrders;
      localStorage.setItem('swap_orders', JSON.stringify(orders));
    }

    if (!isBrowserOrderSyncRuntime()) {
      const hashCheck = await checkServerDataHash(
        orders,
        address,
        3,
        1000,
        requestTimeoutMs,
      );

      if (hashCheck.match) {
        return true;
      }

      if (hashCheck.diffKeys && hashCheck.diffKeys.length > 0) {
        try {
          const offlineResponse = await fetchWithTimeout(
            `${SERVER_URL}/orders/offline`,
            {},
            requestTimeoutMs,
          );
          if (offlineResponse.ok) {
            const offlineData = await offlineResponse.json();
            const serverOfflineOrders = offlineData.orders || [];

            let hasOfflineUpdates = false;
            for (const diffKey of hashCheck.diffKeys) {
              const localOrder = orders[diffKey];
              if (localOrder && localOrder.orderType === 'offline') {
                const serverOrder = serverOfflineOrders.find(order => order.key === diffKey);
                if (serverOrder && serverOrder.status !== 'pending') {
                  orders[diffKey] = {
                    ...localOrder,
                    status: serverOrder.status,
                    remainingAmount: serverOrder.remainingAmount,
                    transactions: serverOrder.transactions || localOrder.transactions,
                    ...(serverOrder.failureReason && { failureReason: serverOrder.failureReason })
                  };
                  hasOfflineUpdates = true;
                }
              }
            }

            if (hasOfflineUpdates) {
              localStorage.setItem('swap_orders', JSON.stringify(orders));
              dispatchOrdersUpdated('synced');
            }
          }
        } catch (_error) {}
      }
    }

    const addressOrders = {};
    for (const [key, order] of Object.entries(orders)) {
      if (key.includes(`|${address}|`)) {
        addressOrders[key] = order;
      }
    }

    if (Object.keys(addressOrders).length === 0) {
      return true;
    }

    const requestUrl = `${SERVER_URL}/orders/push/${address}`;
    const requestBody = JSON.stringify(addressOrders);

    const response = await fetchWithTimeout(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: requestBody,
    }, requestTimeoutMs);

    const responseText = await response.text();
    if (!response.ok) {
      logOrderSyncFailure('push request failed', {
        address,
        status: response.status,
        body: responseText.substring(0, 200),
      });
      return false;
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (_parseError) {
      logOrderSyncFailure('push response parse failed', {
        address,
        body: responseText.substring(0, 200),
      });
      return false;
    }

    if (result.success) {
      return true;
    } else {
      logOrderSyncFailure('push rejected by server', {
        address,
        response: result,
      });
      return false;
    }
  } catch (error) {
    logOrderSyncFailure('push request threw', {
      address,
      error: error?.message || String(error),
    });
    return false;
  }
}

function queueOrdersSync(orders, address) {
  if (!address) {
    return Promise.resolve(false);
  }

  const snapshot = cloneOrdersSnapshot(orders);

  return new Promise((resolve) => {
    pendingOrderSyncQueue.push({
      orders: snapshot,
      address,
      resolve,
    });

    void drainOrderSyncQueue();
  });
}

function calculatePriceWithSlippage(price, slippagePercent = 0.2) {
  return price * (1 + slippagePercent / 100);
}

export async function processOrders() {
  // If already processing, return the existing promise to avoid concurrent execution
  if (isProcessingOrders && processingPromise) {
    console.log('[Auto.js] processOrders already running, returning existing promise');
    return processingPromise;
  }

  // Set lock
  isProcessingOrders = true;
  console.log('[Auto.js] processOrders lock acquired');

  // Create promise that will be shared across concurrent callers
  processingPromise = (async () => {
    try {
      const ordersData = localStorage.getItem('swap_orders') || '{}';
      let orders = JSON.parse(ordersData);

      const currentAddress = localStorage.getItem('wallet_address');
      if (!currentAddress) {
        return;
      }

      const validationResult = validateOrdersData(orders);
      if (validationResult.errors.length > 0) {
        orders = validationResult.fixedOrders;
        localStorage.setItem('swap_orders', JSON.stringify(orders));
      }

      const ordersList = Object.entries(orders).map(([key, value]) => {
        const parts = key.split('|');
        const tokenId = parts[0];
        const address = parts[1];
        return {
          ...value,
          tokenId,
          buyerAddress: address,
          key
        };
      }).filter(order => order.buyerAddress === currentAddress);

      const pendingOrders = ordersList.filter(order =>
        order.remainingAmount > 0 &&
        (!order.orderType || order.orderType === 'online')
      );

      if (pendingOrders.length === 0) {
        if (ordersList.length > 0) {
          void queueOrdersSync(orders, currentAddress);
        }
        return;
      }

      const ordersByToken = {};
      pendingOrders.forEach(order => {
        if (!ordersByToken[order.tokenId]) {
          ordersByToken[order.tokenId] = [];
        }
        ordersByToken[order.tokenId].push(order);
      });

      let hasOrderUpdates = false;
      const buyerMnemonic = await getBuyerMnemonic();

      for (const tokenId in ordersByToken) {
        const tokenOrders = ordersByToken[tokenId];

        const tokenInfo = await getTokenInfo(tokenId);

        tokenOrders.sort((a, b) => {
          if (b.maxPrice !== a.maxPrice) {
            return calculatePriceWithSlippage(b.maxPrice) - calculatePriceWithSlippage(a.maxPrice);
          }
          return b.remainingAmount - a.remainingAmount;
        });

        // Find order that is not currently being processed
        const orderToProcess = tokenOrders.find(order => {
          if (processingOrders.has(order.key)) {
            console.log(`[Auto.js] Order ${order.key} already being processed, skipping`);
            return false;
          }
          return order.remainingAmount > 0;
        });

        if (!orderToProcess) {
          continue;
        }

        // Mark order as being processed
        processingOrders.add(orderToProcess.key);
        console.log(`[Auto.js] Processing order ${orderToProcess.key}`);

        const buyConfig = {
          tokenId: orderToProcess.tokenId,
          tokenDecimals: tokenInfo.decimals,
          amount: orderToProcess.remainingAmount,
          maxPrice: calculatePriceWithSlippage(orderToProcess.maxPrice),
          buyerAddress: orderToProcess.buyerAddress,
          buyerMnemonic: buyerMnemonic
        };

        try {
          const result = await main(buyConfig);

          if (!result.success) {
            if (result.reason === 'INSUFFICIENT_BALANCE' || result.reason === 'INSUFFICIENT_BALANCE_WITH_FEE') {
              orderToProcess.status = 'pending';
            }
            continue;
          }

          hasOrderUpdates = true;
          const executedTransactions = Array.isArray(result.transactions) && result.transactions.length > 0
            ? result.transactions
            : [{
                txid: result.txid,
                amount: result.actualAmount,
                networkFee: result.networkFee || 0,
                swapFee: result.swapFee || 0,
                totalFees: result.totalFees || ((result.networkFee || 0) + (result.swapFee || 0)),
                totalXECPaid: result.totalXECPaid || 0,
              }];
          const totalExecutedAmount = executedTransactions.reduce(
            (sum, tx) => sum + (Number(tx.amount) || 0),
            0,
          );

          orderToProcess.remainingAmount -= totalExecutedAmount;
          if (!orderToProcess.transactions) orderToProcess.transactions = [];
          orderToProcess.transactions.push(...executedTransactions);

          if (orderToProcess.remainingAmount <= 0) {
            orderToProcess.status = 'completed';
          } else {
            const remainingValue = orderToProcess.remainingAmount * orderToProcess.maxPrice;
            if (orderToProcess.orderType === 'online' && orderToProcess.maxPrice > 0 && remainingValue < REMAINING_VALUE_AUTO_COMPLETE_XEC) {
              orderToProcess.status = 'completed';
              orderToProcess.remainingAmount = 0;
            } else {
              orderToProcess.status = 'partial';
            }
          }

          const updatedOrderData = {
            ...orders[orderToProcess.key],
            remainingAmount: orderToProcess.remainingAmount,
            status: orderToProcess.status,
            transactions: orderToProcess.transactions
          };

          orders[orderToProcess.key] = updatedOrderData;

          const updatedValidation = validateOrdersData(orders);
          if (updatedValidation.errors.length > 0) {
            orders = updatedValidation.fixedOrders;
          }

          localStorage.setItem('swap_orders', JSON.stringify(orders));

          dispatchOrdersUpdated('processed');

          if (hasOrderUpdates) {
            const address = orderToProcess.buyerAddress;
            void queueOrdersSync(orders, address);
          }

        } catch (_error) {
          console.error('Order processing failed for order', orderToProcess?.key, ':', _error);
        } finally {
          // Always remove from processing set
          processingOrders.delete(orderToProcess.key);
          console.log(`[Auto.js] Order ${orderToProcess.key} processing complete`);
        }
      }

      if (ordersList.length > 0) {
        const firstOrder = ordersList[0];
        const address = firstOrder.buyerAddress;
        void queueOrdersSync(orders, address);
      }

    } catch (error) {
      console.error('[Auto.js] processOrders error:', error);
      throw error;
    } finally {
      // Always release lock
      isProcessingOrders = false;
      processingPromise = null;
      console.log('[Auto.js] processOrders lock released');
    }
  })();

  return processingPromise;
}

export {
  checkServerDataHash,
  getTokenInfo,
  pushOrdersToServer,
  queueOrdersSync,
  validateOrdersData,
};
