"use client";
import React, { createContext, useContext, useEffect, useState } from "react";

interface OrderProcessingContextType {
  isAutoProcessing: boolean;
  setIsAutoProcessing: (v: boolean) => void;
}

const OrderProcessingContext = createContext<OrderProcessingContextType | null>(
  null,
);

export const OrderProcessingProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isAutoProcessing, setIsAutoProcessing] = useState<boolean>(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedValue = localStorage.getItem("auto_processing");
      if (savedValue === 'false') {
        // On refresh, if there are unfinished orders for the current address, try enabling auto processing once
        try {
          const address = localStorage.getItem('wallet_address');
          const ordersRaw = localStorage.getItem('swap_orders') || '{}';
          const orders = JSON.parse(ordersRaw);
          const hasActiveOrders = !!address && Object.entries(orders).some(([key, value]) => {
            const parts = (key as string).split('|');
            const orderAddress = parts[1];
            const order: any = value;
            return (
              orderAddress === address &&
              order && typeof order.remainingAmount === 'number' && order.remainingAmount > 0 &&
              order.status !== 'completed'
            );
          });

          if (hasActiveOrders) {
            setIsAutoProcessing(true);
            localStorage.setItem('auto_processing', 'true');
          } else {
            setIsAutoProcessing(false);
          }
        } catch (e) {
          console.warn("Error while checking active orders, keeping auto_processing=false:", e);
          setIsAutoProcessing(false);
        }
      } else {
        setIsAutoProcessing(true);
      }
      setInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && initialized) {
      localStorage.setItem("auto_processing", String(isAutoProcessing));
    }
  }, [isAutoProcessing, initialized]);

  const setIsAutoProcessingWithLog = (v: boolean) => {
    setIsAutoProcessing(v);
  };

  return (
    <OrderProcessingContext.Provider
      value={{ isAutoProcessing, setIsAutoProcessing: setIsAutoProcessingWithLog }}
    >
      {children}
    </OrderProcessingContext.Provider>
  );
};

export const useOrderProcessing = () => {
  const ctx = useContext(OrderProcessingContext);
  if (!ctx)
    throw new Error(
      "useOrderProcessing must be used within <OrderProcessingProvider>",
    );
  return ctx;
};
