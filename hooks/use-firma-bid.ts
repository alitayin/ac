"use client";

import { useEffect, useState } from "react";

const REFRESH_INTERVAL_MS = 60_000;

type FirmaBidState = {
  bid: number;
  isLoading: boolean;
  error: string | null;
};

export const useFirmaBid = (): FirmaBidState => {
  const [state, setState] = useState<FirmaBidState>({
    bid: 0,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    const fetchBid = async () => {
      try {
        const response = await fetch("/api/firma-bid");
        const payload = await response.json().catch(() => null);
        const bid = Number(payload?.bid);

        if (!response.ok || !Number.isFinite(bid) || bid <= 0) {
          throw new Error("Firma buyback price is unavailable");
        }

        if (!cancelled) {
          setState({ bid, isLoading: false, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            bid: 0,
            isLoading: false,
            error: error instanceof Error ? error.message : "Failed to load Firma buyback price",
          });
        }
      }
    };

    void fetchBid();
    const intervalId = window.setInterval(fetchBid, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return state;
};
