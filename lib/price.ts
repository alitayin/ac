import { useEffect, useState } from "react"
let cachedPrice: number | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 60000;
const MAX_RETRIES = 6;

interface BinanceResponse {
  symbol: string;
  price: string;
}

interface CoingeckoResponse {
  ecash: {
    usd: number;
  };
}

async function fetchBinancePrice(): Promise<number> {
  const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=XECUSDT');
  const data: BinanceResponse = await response.json();
  if (!data.price) throw new Error('Invalid Binance response');
  return parseFloat(data.price);
}

async function fetchCoingeckoPrice(): Promise<number> {
  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ecash&vs_currencies=usd');
  const data: CoingeckoResponse = await response.json();
  if (!data?.ecash?.usd) throw new Error('Invalid Coingecko response');
  return data.ecash.usd;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function getXECPrice(): Promise<number> {
  const now = Date.now();

  if (cachedPrice && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedPrice;
  }

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const price = await fetchBinancePrice();
      if (price > 0) {
        cachedPrice = price;
        lastFetchTime = now;
        return price;
      }
    } catch (_error) {
      try {
        const price = await fetchCoingeckoPrice();
        if (price > 0) {
          cachedPrice = price;
          lastFetchTime = now;
          return price;
        }
      } catch (_coingeckoError) {}
    }

    if (i < MAX_RETRIES - 1) {
      await delay(1000 * (i + 1));
    }
  }

  if (cachedPrice !== null) {
    return cachedPrice;
  }

  return 0;
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