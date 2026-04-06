"use client";
import React, { createContext, useContext, useEffect, useRef, useMemo, useCallback } from "react";
import { processOrders } from '@/lib/Auto.js';
import { useOrderProcessing } from "./OrderProcessingContext";

interface AutoExecutionContextType {
  executeOrders: () => Promise<void>;
}

const AutoExecutionContext = createContext<AutoExecutionContextType | null>(null);

export const AutoExecutionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { isAutoProcessing } = useOrderProcessing();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const hasActiveOrders = () => {
    if (typeof window === "undefined") return false;

    const orders = JSON.parse(localStorage.getItem('swap_orders') || '{}');
    return Object.keys(orders).length > 0;
  };

  const executeOrders = useCallback(async () => {
    try {
      await processOrders();
      return Promise.resolve();
    } catch (error) {
      console.error('Failed to process orders:', error);
      return Promise.reject(error);
    }
  }, []);

  useEffect(() => {
    // Clear any existing interval FIRST to prevent accumulation
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Only start interval if conditions are met
    if (isAutoProcessing && hasActiveOrders()) {
      // Initial execution
      executeOrders();

      // Start polling interval - 60 seconds
      intervalRef.current = setInterval(async () => {
        // Double-check conditions inside interval callback
        if (!isAutoProcessing || !hasActiveOrders()) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return;
        }

        await executeOrders();
      }, 60000); // Changed from 3000ms to 60000ms (60 seconds)
    }

    // Cleanup function - runs when component unmounts or dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAutoProcessing, executeOrders]);

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