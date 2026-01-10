import { API_BASE_URL, API_ENDPOINTS } from "./constants";

/**
 * Fetch buy orders for a specific token
 * @param tokenId - The token ID to fetch buy orders for
 */
export const fetchTokenOrders = async (tokenId: string) => {
  const response = await fetch(
    `${API_BASE_URL}${API_ENDPOINTS.TOKEN_ORDERS(tokenId)}`,
  );
  return response.json();
};

