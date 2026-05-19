import { API_BASE_URL, API_ENDPOINTS } from "./constants";

/**
 * Fetch buy orders for a specific token
 * @param tokenId - The token ID to fetch buy orders for
 */
export const fetchTokenOrders = async (
  tokenId: string,
  options: { signal?: AbortSignal } = {},
) => {
  const response = await fetch(
    `${API_BASE_URL}${API_ENDPOINTS.TOKEN_ORDERS(tokenId)}`,
    options.signal ? { signal: options.signal } : undefined,
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch token orders: ${response.status}`);
  }
  return response.json();
};
