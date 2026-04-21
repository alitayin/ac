"use client";

export const ORDERS_UPDATED_EVENT = "orders-updated";

export type OrdersUpdatedReason =
  | "created"
  | "deleted"
  | "processed"
  | "synced"
  | "cleared";

export interface OrdersUpdatedDetail {
  reason: OrdersUpdatedReason;
}

export interface StoredSwapOrder {
  remainingAmount: number;
  maxPrice: number;
  status: string;
  orderType?: string;
  transactions: any[];
  createdAt?: string;
  raw?: string;
  selectedUtxos?: any[];
  failureReason?: string;
}

export type StoredSwapOrders = Record<string, StoredSwapOrder>;

const RANDOM_SUFFIX_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export const generateOrderKeySuffix = (length = 8): string => {
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += RANDOM_SUFFIX_ALPHABET.charAt(
      Math.floor(Math.random() * RANDOM_SUFFIX_ALPHABET.length),
    );
  }
  return result;
};

export const createSwapOrderKey = (
  tokenId: string,
  address: string,
  maxPrice: number,
  suffix = generateOrderKeySuffix(),
): string => `${tokenId}|${address}|${maxPrice}|${suffix}`;

export const readSwapOrders = (): StoredSwapOrders => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const storedOrders = localStorage.getItem("swap_orders");
    if (!storedOrders) {
      return {};
    }

    const parsedOrders = JSON.parse(storedOrders);
    return parsedOrders && typeof parsedOrders === "object" ? parsedOrders : {};
  } catch (error) {
    console.error("Failed to read swap orders:", error);
    return {};
  }
};

export const writeSwapOrders = (orders: StoredSwapOrders): void => {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem("swap_orders", JSON.stringify(orders));
};

export const dispatchOrdersUpdated = (reason: OrdersUpdatedReason): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<OrdersUpdatedDetail>(ORDERS_UPDATED_EVENT, {
      detail: { reason },
    }),
  );
};

export const saveSwapOrder = (
  orderKey: string,
  orderData: StoredSwapOrder,
  reason: OrdersUpdatedReason = "created",
): StoredSwapOrders => {
  const orders = readSwapOrders();
  orders[orderKey] = orderData;
  writeSwapOrders(orders);
  dispatchOrdersUpdated(reason);
  return orders;
};

export const deleteSwapOrder = (
  orderKey: string,
  reason: OrdersUpdatedReason = "deleted",
): StoredSwapOrders => {
  const orders = readSwapOrders();
  delete orders[orderKey];
  writeSwapOrders(orders);
  dispatchOrdersUpdated(reason);
  return orders;
};

export const isOnlineOrder = (order: StoredSwapOrder | undefined): boolean =>
  !!order && order.orderType !== "offline";

export const isActiveOnlineOrder = (
  order: StoredSwapOrder | undefined,
): boolean =>
  !!order && isOnlineOrder(order) && Number(order.remainingAmount) > 0;

export const getAddressFromOrderKey = (orderKey: string): string =>
  orderKey.split("|")[1] ?? "";

export const getTokenIdFromOrderKey = (orderKey: string): string =>
  orderKey.split("|")[0] ?? "";

export const getActiveOnlineOrdersForAddress = (
  address: string,
  orders: StoredSwapOrders = readSwapOrders(),
): StoredSwapOrders => {
  if (!address) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(orders).filter(
      ([orderKey, order]) =>
        getAddressFromOrderKey(orderKey) === address && isActiveOnlineOrder(order),
    ),
  );
};

export const hasActiveOnlineOrdersForAddress = (
  address: string,
  orders: StoredSwapOrders = readSwapOrders(),
): boolean => Object.keys(getActiveOnlineOrdersForAddress(address, orders)).length > 0;

export const getActiveOnlineOrderTokenIdsForAddress = (
  address: string,
  orders: StoredSwapOrders = readSwapOrders(),
): string[] =>
  Array.from(
    new Set(
      Object.keys(getActiveOnlineOrdersForAddress(address, orders)).map(
        getTokenIdFromOrderKey,
      ),
    ),
  );
