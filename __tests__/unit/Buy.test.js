import { describe, it, expect, vi, beforeEach } from 'vitest';
import { main } from '@/lib/Buy.js';
import * as ecashQuicksend from 'ecash-quicksend';

vi.mock('ecash-quicksend', () => ({
  buyAgoraTokens: vi.fn(),
}));

describe('Buy.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('main', () => {
    it('should throw error if config is missing', async () => {
      const result = await main(null);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('EXECUTION_ERROR');
      expect(result.message).toContain('Configuration parameters are required');
    });

    it('should successfully buy tokens with valid config', async () => {
      const mockResult = {
        success: true,
        transactions: [
          {
            txid: 'abc123',
            amount: 1000000n, // 1 token with 6 decimals
            price: 0.0001, // XEC per atom
            fee: 10,
          },
        ],
        totalXECPaid: 110,
      };

      vi.mocked(ecashQuicksend.buyAgoraTokens).mockResolvedValue(mockResult);

      const config = {
        tokenId: 'token123',
        tokenDecimals: 6,
        amount: 1, // 1 token
        maxPrice: 100, // 100 XEC per token
        buyerAddress: 'ecash:test',
        buyerMnemonic: 'test mnemonic words here',
      };

      const result = await main(config);

      expect(result.success).toBe(true);
      expect(result.txid).toBe('abc123');
      expect(result.actualAmount).toBe(1); // 1000000 / 10^6
      expect(result.totalXECPaid).toBe(110);
      expect(result.pricePerToken).toBe(100); // 0.0001 * 10^6
      expect(result.networkFee).toBe(10);
      expect(result.explorerLink).toBe('https://explorer.e.cash/tx/abc123');
    });

    it('should handle token with 0 decimals', async () => {
      const mockResult = {
        success: true,
        transactions: [
          {
            txid: 'def456',
            amount: 100n,
            price: 1,
            fee: 5,
          },
        ],
        totalXECPaid: 105,
      };

      vi.mocked(ecashQuicksend.buyAgoraTokens).mockResolvedValue(mockResult);

      const config = {
        tokenId: 'token456',
        tokenDecimals: 0,
        amount: 100,
        maxPrice: 1,
        buyerAddress: 'ecash:test',
        buyerMnemonic: 'test mnemonic',
      };

      const result = await main(config);

      expect(result.success).toBe(true);
      expect(result.actualAmount).toBe(100);
      expect(result.pricePerToken).toBe(1);
    });

    it('should handle token with 8 decimals', async () => {
      const mockResult = {
        success: true,
        transactions: [
          {
            txid: 'ghi789',
            amount: 100000000n, // 1 token with 8 decimals
            price: 0.00000001, // XEC per atom
            fee: 15,
          },
        ],
        totalXECPaid: 16,
      };

      vi.mocked(ecashQuicksend.buyAgoraTokens).mockResolvedValue(mockResult);

      const config = {
        tokenId: 'token789',
        tokenDecimals: 8,
        amount: 1,
        maxPrice: 1,
        buyerAddress: 'ecash:test',
        buyerMnemonic: 'test mnemonic',
      };

      const result = await main(config);

      expect(result.success).toBe(true);
      expect(result.actualAmount).toBe(1);
    });

    it('should handle insufficient balance error', async () => {
      const mockResult = {
        success: false,
        message: 'Insufficient balance to complete transaction',
        skippedOffers: [],
      };

      vi.mocked(ecashQuicksend.buyAgoraTokens).mockResolvedValue(mockResult);

      const config = {
        tokenId: 'token123',
        tokenDecimals: 6,
        amount: 1000,
        maxPrice: 100,
        buyerAddress: 'ecash:test',
        buyerMnemonic: 'test mnemonic',
      };

      const result = await main(config);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('INSUFFICIENT_BALANCE');
      expect(result.message).toContain('balance');
    });

    it('should handle no suitable offers error', async () => {
      const mockResult = {
        success: false,
        message: 'No offers found matching criteria',
        skippedOffers: [{ reason: 'price too high' }],
      };

      vi.mocked(ecashQuicksend.buyAgoraTokens).mockResolvedValue(mockResult);

      const config = {
        tokenId: 'token123',
        tokenDecimals: 6,
        amount: 1,
        maxPrice: 0.01,
        buyerAddress: 'ecash:test',
        buyerMnemonic: 'test mnemonic',
      };

      const result = await main(config);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('NO_SUITABLE_OFFERS');
      expect(result.details.skippedOffers).toHaveLength(1);
    });

    it('should handle empty transactions array', async () => {
      const mockResult = {
        success: false,
        transactions: [],
        message: 'No transactions created',
      };

      vi.mocked(ecashQuicksend.buyAgoraTokens).mockResolvedValue(mockResult);

      const config = {
        tokenId: 'token123',
        tokenDecimals: 6,
        amount: 1,
        maxPrice: 100,
        buyerAddress: 'ecash:test',
        buyerMnemonic: 'test mnemonic',
      };

      const result = await main(config);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('NO_SUITABLE_OFFERS');
    });

    it('should handle exception with insufficient balance message', async () => {
      vi.mocked(ecashQuicksend.buyAgoraTokens).mockRejectedValue(
        new Error('Insufficient XEC balance for transaction')
      );

      const config = {
        tokenId: 'token123',
        tokenDecimals: 6,
        amount: 1,
        maxPrice: 100,
        buyerAddress: 'ecash:test',
        buyerMnemonic: 'test mnemonic',
      };

      const result = await main(config);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('INSUFFICIENT_BALANCE_WITH_FEE');
      expect(result.message).toContain('Insufficient');
    });

    it('should handle generic execution error', async () => {
      vi.mocked(ecashQuicksend.buyAgoraTokens).mockRejectedValue(
        new Error('Network timeout')
      );

      const config = {
        tokenId: 'token123',
        tokenDecimals: 6,
        amount: 1,
        maxPrice: 100,
        buyerAddress: 'ecash:test',
        buyerMnemonic: 'test mnemonic',
      };

      const result = await main(config);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('EXECUTION_ERROR');
      expect(result.message).toBe('Network timeout');
    });

    it('should convert amount to atoms correctly', async () => {
      const mockResult = {
        success: true,
        transactions: [
          {
            txid: 'test',
            amount: 1234567n,
            price: 0.0001,
            fee: 10,
          },
        ],
        totalXECPaid: 133.4567,
      };

      vi.mocked(ecashQuicksend.buyAgoraTokens).mockResolvedValue(mockResult);

      const config = {
        tokenId: 'token123',
        tokenDecimals: 6,
        amount: 1.234567, // Fractional amount
        maxPrice: 100,
        buyerAddress: 'ecash:test',
        buyerMnemonic: 'test mnemonic',
      };

      await main(config);

      expect(ecashQuicksend.buyAgoraTokens).toHaveBeenCalledWith({
        tokenId: 'token123',
        amount: 1234567n, // Should be converted to atoms
        maxPrice: 0.0001, // 100 / 10^6
        mnemonic: 'test mnemonic',
      });
    });

    it('should handle missing tokenDecimals (default to 0)', async () => {
      const mockResult = {
        success: true,
        transactions: [
          {
            txid: 'test',
            amount: 10n,
            price: 1,
            fee: 5,
          },
        ],
        totalXECPaid: 15,
      };

      vi.mocked(ecashQuicksend.buyAgoraTokens).mockResolvedValue(mockResult);

      const config = {
        tokenId: 'token123',
        amount: 10,
        maxPrice: 1,
        buyerAddress: 'ecash:test',
        buyerMnemonic: 'test mnemonic',
      };

      const result = await main(config);

      expect(result.success).toBe(true);
      expect(result.actualAmount).toBe(10);
    });

    it('should handle very large amounts', async () => {
      const mockResult = {
        success: true,
        transactions: [
          {
            txid: 'test',
            amount: 1000000000000n, // 1 million tokens with 6 decimals
            price: 0.0001,
            fee: 20,
          },
        ],
        totalXECPaid: 100000020,
      };

      vi.mocked(ecashQuicksend.buyAgoraTokens).mockResolvedValue(mockResult);

      const config = {
        tokenId: 'token123',
        tokenDecimals: 6,
        amount: 1000000, // 1 million tokens
        maxPrice: 100,
        buyerAddress: 'ecash:test',
        buyerMnemonic: 'test mnemonic',
      };

      const result = await main(config);

      expect(result.success).toBe(true);
      expect(result.actualAmount).toBe(1000000);
    });

    it('should handle error without message property', async () => {
      vi.mocked(ecashQuicksend.buyAgoraTokens).mockRejectedValue('String error');

      const config = {
        tokenId: 'token123',
        tokenDecimals: 6,
        amount: 1,
        maxPrice: 100,
        buyerAddress: 'ecash:test',
        buyerMnemonic: 'test mnemonic',
      };

      const result = await main(config);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('EXECUTION_ERROR');
      expect(result.message).toBe('');
    });
  });
});
