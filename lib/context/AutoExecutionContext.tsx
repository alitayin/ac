"use client";
import React, { createContext, useContext, useMemo, useCallback } from "react";
import { processOrders } from '@/lib/Auto.js';

interface AutoExecutionContextType {
  executeOrders: () => Promise<void>;
}

const AutoExecutionContext = createContext<AutoExecutionContextType | null>(null);

export const AutoExecutionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const executeOrders = useCallback(async () => {
    try {
      await processOrders();
      return Promise.resolve();
    } catch (error) {
      console.error('Failed to process orders:', error);
      return Promise.reject(error);
    }
  }, []);


  // Removed polling interval - WebSocket in header.tsx handles real-time order processing
  // This prevents duplicate processOrders calls and excessive lock contention

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