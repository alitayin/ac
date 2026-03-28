"use client";
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { processOrders } from '@/lib/Auto.js'; 
import { useToast } from "@/hooks/use-toast";
import { useWebSocketStatus } from "./WebSocketContext";
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
  const { isNotifying } = useWebSocketStatus();
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
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    

    if (isAutoProcessing && isNotifying && hasActiveOrders()) {
      
      executeOrders();

      intervalRef.current = setInterval(async () => {
        try {
          if (!isAutoProcessing || !isNotifying || !hasActiveOrders()) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            return;
          }
          
          await executeOrders();
        } catch (error) {
        }
      }, 3000);
    }
    
    return () => {
      // Cleanup interval on unmount or dependency change
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAutoProcessing, isNotifying]);

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