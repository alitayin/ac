"use client";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useWallet } from "./WalletContext";
import { watchOrderTokens } from "../swap-ws";
import {
  ORDERS_UPDATED_EVENT,
  OrdersUpdatedDetail,
  OrdersUpdatedReason,
  getActiveOnlineOrderTokenIdsForAddress,
  hasActiveOnlineOrdersForAddress,
  readSwapOrders,
} from "../swap-order-utils";

interface AutoExecutionContextType {
  executeOrders: () => Promise<void>;
}

const AutoExecutionContext = createContext<AutoExecutionContextType | null>(null);
const AUTO_EXECUTION_INTERVAL_MS = 60000;

export const AutoExecutionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { isWalletConnected, ecashAddress } = useWallet();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasActiveOrdersRef = useRef(false);
  const previousAddressRef = useRef("");
  const [ordersSignal, setOrdersSignal] = useState<{
    version: number;
    reason?: OrdersUpdatedReason;
  }>({
    version: 0,
  });

  const executeOrders = useCallback(async () => {
    try {
      const { processOrders } = await import("@/lib/Auto.js");
      await processOrders();
    } catch (error) {
      console.error("Failed to process orders:", error);
      throw error;
    }
  }, []);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!isWalletConnected || !ecashAddress) {
      hasActiveOrdersRef.current = false;
      previousAddressRef.current = "";
      return;
    }

    const activeOrderTokenIds = getActiveOnlineOrderTokenIdsForAddress(
      ecashAddress,
      readSwapOrders(),
    );
    const hasActiveOrders = activeOrderTokenIds.length > 0;
    const addressChanged = previousAddressRef.current !== ecashAddress;
    const shouldRunImmediately =
      hasActiveOrders &&
      (ordersSignal.reason === "created" ||
        !hasActiveOrdersRef.current ||
        addressChanged);

    hasActiveOrdersRef.current = hasActiveOrders;
    previousAddressRef.current = ecashAddress;

    if (!hasActiveOrders) {
      return;
    }

    if (shouldRunImmediately) {
      executeOrders().catch(() => {});
    }

    intervalRef.current = setInterval(() => {
      if (!hasActiveOnlineOrdersForAddress(ecashAddress, readSwapOrders())) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        hasActiveOrdersRef.current = false;
        return;
      }

      executeOrders().catch(() => {});
    }, AUTO_EXECUTION_INTERVAL_MS);

    const cleanupWatch = watchOrderTokens(activeOrderTokenIds, () => {
      if (!hasActiveOnlineOrdersForAddress(ecashAddress, readSwapOrders())) {
        return;
      }

      executeOrders().catch(() => {});
    });

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      cleanupWatch();
    };
  }, [ecashAddress, executeOrders, isWalletConnected, ordersSignal]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleOrdersUpdated = (event: Event) => {
      const detail = (event as CustomEvent<OrdersUpdatedDetail>).detail;
      setOrdersSignal((currentSignal) => ({
        version: currentSignal.version + 1,
        reason: detail?.reason,
      }));
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== "swap_orders") {
        return;
      }

      setOrdersSignal((currentSignal) => ({
        version: currentSignal.version + 1,
        reason: "synced",
      }));
    };

    window.addEventListener(
      ORDERS_UPDATED_EVENT,
      handleOrdersUpdated as EventListener,
    );
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(
        ORDERS_UPDATED_EVENT,
        handleOrdersUpdated as EventListener,
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const contextValue = useMemo(() => ({
    executeOrders
  }), [executeOrders]);

  return (
    <AutoExecutionContext.Provider value={contextValue}>
      {children}
    </AutoExecutionContext.Provider>
  );
};

export const useAutoExecution = () => {
  const ctx = useContext(AutoExecutionContext);
  if (!ctx)
    throw new Error(
      "useAutoExecution must be used within a <AutoExecutionProvider>",
    );
  return ctx;
};
