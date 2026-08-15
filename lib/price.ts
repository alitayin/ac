import { useEffect, useState } from "react"
let cachedPrice: number | null = null;
let lastFetchTime: number = 0;
let inFlightPriceRequest: Promise<number> | null = null;
const CACHE_DURATION = 60000;
const MAX_RETRIES = 6;
const PRICE_REQUEST_TIMEOUT_MS = 5_000;

interface BinanceResponse {
  symbol: string;
  price: string;
}

interface CoingeckoResponse {
  ecash: {
    usd: number;
  };
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchPriceJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PRICE_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Price endpoint returned ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchBinancePrice(): Promise<number> {
  const data = await fetchPriceJson<BinanceResponse>(
    'https://api.binance.com/api/v3/ticker/price?symbol=XECUSDT',
  );
  if (!data.price) throw new Error('Invalid Binance response');
  return parseFloat(data.price);
}

async function fetchCoingeckoPrice(): Promise<number> {
  const data = await fetchPriceJson<CoingeckoResponse>(
    'https://api.coingecko.com/api/v3/simple/price?ids=ecash&vs_currencies=usd',
  );
  if (!data?.ecash?.usd) throw new Error('Invalid Coingecko response');
  return data.ecash.usd;
}

async function fetchXECPriceWithRetries(): Promise<number> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const price = await fetchBinancePrice();
      if (price > 0) {
        cachedPrice = price;
        lastFetchTime = Date.now();
        return price;
      }
    } catch (_error) {
      try {
        const price = await fetchCoingeckoPrice();
        if (price > 0) {
          cachedPrice = price;
          lastFetchTime = Date.now();
          return price;
        }
      } catch (_coingeckoError) {}
    }

    if (i < MAX_RETRIES - 1) {
      // Exponential backoff with jitter: 500ms * 2^i + random(0-300ms)
      const backoff = 500 * Math.pow(2, i) + Math.random() * 300;
      await delay(Math.min(backoff, 15000));
    }
  }

  if (cachedPrice !== null) {
    return cachedPrice;
  }

  return 0;
}

export function getXECPrice(): Promise<number> {
  const now = Date.now();

  if (cachedPrice !== null && (now - lastFetchTime) < CACHE_DURATION) {
    return Promise.resolve(cachedPrice);
  }

  if (!inFlightPriceRequest) {
    inFlightPriceRequest = fetchXECPriceWithRetries().finally(() => {
      inFlightPriceRequest = null;
    });
  }

  return inFlightPriceRequest;
}

export function useXECPrice() {
  const [price, setPrice] = useState<number>(0);

  useEffect(() => {
    const fetchPrice = async () => {
      const newPrice = await getXECPrice();
      setPrice(newPrice);
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, CACHE_DURATION);
    return () => clearInterval(interval);
  }, []);

  return price;
}
