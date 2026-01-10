import { main } from './Buy.js';
import crypto from 'crypto';
import { ChronikClient } from 'chronik-client';

const chronik = new ChronikClient(['https://chronik1.alitayin.com']);
const SERVER_URL = 'https://api.agora.cash'; 
const REMAINING_VALUE_AUTO_COMPLETE_XEC = 100; // auto-complete dust remainders
const tokenInfoCache = {};

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

async function getTokenInfo(tokenId, maxRetries = 5, retryDelay = 2000) {
  if (tokenInfoCache[tokenId]) {
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
  return crypto.createHash('md5').update(str).digest('hex');
}

async function checkServerDataHash(orders, address, maxRetries = 3, retryDelay = 1000) {
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

      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
      });

      const responseText = await response.text();

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

async function pushOrdersToServer(orders, address) {
  try {
    const validationResult = validateOrdersData(orders);
    if (validationResult.errors.length > 0) {
      orders = validationResult.fixedOrders;
      localStorage.setItem('swap_orders', JSON.stringify(orders));
    }

    const hashCheck = await checkServerDataHash(orders, address);

    if (hashCheck.match) {
      return true;
    }

    if (hashCheck.diffKeys && hashCheck.diffKeys.length > 0) {
      try {
        const offlineResponse = await fetch(`${SERVER_URL}/orders/offline`);
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
            window.dispatchEvent(new Event('orderUpdated'));
          }
        }
      } catch (_error) {}
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

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: requestBody,
    });

    const responseText = await response.text();

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (_parseError) {
      return false;
    }

    if (result.success) {
      return true;
    } else {
      return false;
    }
  } catch (_error) {
    return false;
  }
}

function calculatePriceWithSlippage(price, slippagePercent = 0.2) {
  return price * (1 + slippagePercent / 100);
}

export async function processOrders() {
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
        await pushOrdersToServer(orders, currentAddress);
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

      const orderToProcess = tokenOrders.find(order => order.remainingAmount > 0);
      if (!orderToProcess) {
        continue;
      }

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
        
        orderToProcess.remainingAmount -= result.actualAmount;
        
        if (!orderToProcess.transactions) orderToProcess.transactions = [];
        orderToProcess.transactions.push({
          txid: result.txid,
          amount: result.actualAmount
        });

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
        
        window.dispatchEvent(new Event('orderUpdated'));
        
        if (hasOrderUpdates) {
          const address = orderToProcess.buyerAddress;
          await pushOrdersToServer(orders, address);
        }

      } catch (_error) {}
    }

    if (ordersList.length > 0) {
      const firstOrder = ordersList[0];
      const address = firstOrder.buyerAddress;
      await pushOrdersToServer(orders, address);
    }
    
  } catch (error) {
    throw error;
  }
}

export { getTokenInfo, pushOrdersToServer, validateOrdersData, checkServerDataHash };
