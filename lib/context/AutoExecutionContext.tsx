"use client";
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { processOrders } from '@/lib/Auto.js';
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();
  const { isAutoProcessing } = useOrderProcessing();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const hasActiveOrders = () => {
    if (typeof window === "undefined") return false;
    
    const orders = JSON.parse(localStorage.getItem('swap_orders') || '{}');
    return Object.keys(orders).length > 0;
  };

  const executeOrders = async () => {
    try {
      await processOrders();
      return Promise.resolve();
    } catch (error) {
      console.error('Failed to process orders:', error);
      return Promise.reject(error);
    }
  };


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

      // Start polling interval
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
      }, 3000);
    }

    // Cleanup function - runs when component unmounts or dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAutoProcessing]);

  return (
    <AutoExecutionContext.Provider value={{ executeOrders }}>
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