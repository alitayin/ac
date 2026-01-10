"use client";
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useAddressNotifier } from "@/lib/websocket-client";

interface WebSocketContextType {
  isNotifying: boolean;
  address?: string;
}

const WebSocketContext = createContext<WebSocketContextType>({
  isNotifying: false,
  address: undefined,
});

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const [address, setAddress] = useState<string | undefined>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("wallet_address") || undefined;
    }
    return undefined;
  });

  useEffect(() => {
    const onStorage = () => {
      setAddress(localStorage.getItem("wallet_address") || undefined);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isNotifying = useAddressNotifier(address);

  return (
    <WebSocketContext.Provider value={{ isNotifying, address }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketStatus = () => useContext(WebSocketContext); 