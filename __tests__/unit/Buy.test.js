import { describe, it, expect, vi, beforeEach } from 'vitest';
import { main } from '@/lib/Buy.js';
import * as ecashQuicksend from 'ecash-quicksend';
import {
  AGORA_SWAP_FEE_ADDRESS,
  AGORA_SWAP_FEE_BPS,
  AGORA_SWAP_FEE_MIN_SATS,
} from '@/lib/agora-swap-fee';

vi.mock('ecash-quicksend', () => ({
  fetchAgoraOffers: vi.fn(),
  acceptAgoraOffer: vi.fn(),
}));

const buildOffer = (overrides = {}) => ({
  offerType: 'PARTIAL',
  pricePerToken: 0.0001,
  totalTokenAmount: 1000000n,
  totalXEC: 100,
  offer: {},
  ...overrides,
});

describe('Buy.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ecashQuicksend.fetchAgoraOffers).mockResolvedValue([]);
    vi.mocked(ecashQuicksend.acceptAgoraOffer).mockResolvedValue({
      success: false,
      reason: 'NO_SUITABLE_OFFERS',
      message: 'No matching offers found',
    });
  });

  describe('main', () => {
    it('should throw error if config is missing', async () => {
      const result = await main(null);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('EXECUTION_ERROR');
      expect(result.message).toContain('Configuration parameters are required');
    });

    it('should successfully buy tokens with valid config', async () => {
      vi.mocked(ecashQuicksend.fetchAgoraOffers).mockResolvedValue([
        buildOffer(),
      ]);
      vi.mocked(ecashQuicksend.acceptAgoraOffer).mockResolvedValue({
        success: true,
        txid: 'abc123',
        actualAmount: 1000000n,
        totalXECPaid: 110,
        pricePerToken: 0.0001,
        networkFee: 10,
        swapFeePaid: 5.46,
      });

      const result = await main({
        tokenId: 'token123',
        tokenDecimals: 6,
        amount: 1,
        maxPrice: 100,
        buyerAddress: 'ecash:test',
        buyerMnemonic: 'test mnemonic words here',
      });

      expect(result.success).toBe(true);
      expect(result.txid).toBe('abc123');
      expect(result.actualAmount).toBe(1);
      expect(result.totalXECPaid).toBe(110);
      expect(result.pricePerToken).toBe(100);
      expect(result.networkFee).toBe(10);
      expect(result.swapFee).toBe(5.46);
      expect(result.totalFees).toBe(15.46);
      expect(result.transactions).toEqual([
        expect.objectContaining({
          txid: 'abc123',
          amount: 1,
          networkFee: 10,
          swapFee: 5.46,
          totalFees: 15.46,
        }),
      ]);
      expect(result.explorerLink).toBe('https://explorer.e.cash/tx/abc123');
    });

    it('should handle token with 0 decimals', async () => {
      vi.mocked(ecashQuicksend.fetchAgoraOffers).mockResolvedValue([
        buildOffer({
          pricePerToken: 1,
          totalTokenAmount: 100n,
          totalXEC: 100,
        }),
      ]);
      vi.mocked(ecashQuicksend.acceptAgoraOffer).mockResolvedValue({
        success: true,
        txid: 'def456',
        actualAmount: 100n,
        totalXECPaid: 105,
        pricePerToken: 1,
        networkFee: 5,
        swapFeePaid: 0,
      });

      const result = await main({
        tokenId: 'token456',
        tokenDecimals: 0,
        amount: 100,
        maxPrice: 1,
        buyerAddress: 'ecash:test',
        buyerMnemonic: 'test mnemonic',
      });

      expect(result.success).toBe(true);
      expect(result.actualAmount).toBe(100);
      expect(result.pricePerToken).toBe(1);
    });

    it('should aggregate multi-transaction fills and fee totals', async () => {
      vi.mocked(ecashQuicksend.fetchAgoraOffers).mockResolvedValue([
        buildOffer({
          pricePerToken: 1.5,
          totalTokenAmount: 200n,
          totalXEC: 300,
        }),
        buildOffer({
          pricePerToken: 1.4,
          totalTokenAmount: 300n,
          totalXEC: 420,
        }),
      ]);
      vi.mocked(ecashQuicksend.acceptAgoraOffer)
        .mockResolvedValueOnce({
          success: true,
          txid: 'tx-1',
          actualAmount: 300n,
          totalXECPaid: 417.46,
          pricePerToken: 1.4,
          networkFee: 10,
          swapFeePaid: 5.46,
        })
        .mockResolvedValueOnce({
          success: true,
          txid: 'tx-2',
          actualAmount: 200n,
          totalXECPaid: 315.46,
          pricePerToken: 1.5,
          networkFee: 12,
          swapFeePaid: 5.46,
        });

      const result = await main({
        tokenId: 'token-aggregate',
        tokenDecimals: 0,
        amount: 500,
        maxPrice: 2,
        buyerAddress: 'ecash:test',
        buyerMnemonic: 'test mnemonic',
      });

      expect(result.actualAmount).toBe(500);
      expect(result.networkFee).toBe(22);
      expect(result.swapFee).toBe(10.92);
      expect(result.totalFees).toBe(32.92);
      expect(result.transactions).toHaveLength(2);
      expect(ecashQuicksend.acceptAgoraOffer).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ pricePerToken: 1.4 }),
        expect.any(Object),
      );
      expect(ecashQuicksend.acceptAgoraOffer).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ pricePerToken: 1.5 }),
        expect.any(Object),
      );
    });

    it('should surface acceptAgoraOffer failure reason when matched offers cannot execute', async () => {
      vi.mocked(ecashQuicksend.fetchAgoraOffers).mockResolvedValue([
        buildOffer(),
      ]);
      vi.mocked(ecashQuicksend.acceptAgoraOffer).mockResolvedValue({
        success: false,
        reason: 'INSUFFICIENT_BALANCE_WITH_FEE',
        message: 'Need at least 11365840 sats total including network fee, have 11365834 sats',
      });

      const result = await main({
        tokenId: 'token123',
        tokenDecimals: 6,
        amount: 1,
        maxPrice: 100,
        buyerAddress: 'ecash:test',
        buyerMnemonic: 'test mnemonic',
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('INSUFFICIENT_BALANCE_WITH_FEE');
      expect(result.message).toContain('Need at least');
      expect(result.details.skippedOffers).toEqual([
        expect.objectContaining({
          reason: 'INSUFFICIENT_BALANCE_WITH_FEE',
        }),
      ]);
    });

    it('should handle no suitable offers error when no offers match the price', async () => {
      vi.mocked(ecashQuicksend.fetchAgoraOffers).mockResolvedValue([]);

      const result = await main({
        tokenId: 'token123',
        tokenDecimals: 6,
        amount: 1,
        maxPrice: 0.01,
        buyerAddress: 'ecash:test',
        buyerMnemonic: 'test mnemonic',
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('NO_SUITABLE_OFFERS');
      expect(result.details.skippedOffers).toHaveLength(0);
      expect(result.details.matchingOffersCount).toBe(0);
    });

    it('should include matching offer diagnostics for zero-fill failures', async () => {
      vi.mocked(ecashQuicksend.fetchAgoraOffers).mockResolvedValue([
        buildOffer({
          offerType: 'ONE_TO_ONE',
          pricePerToken: 0.01,
          totalTokenAmount: 5000n,
          totalXEC: 50,
        }),
      ]);
      vi.mocked(ecashQuicksend.acceptAgoraOffer).mockResolvedValue({
        success: false,
        reason: 'ONE_TO_ONE_REQUIRED',
        message: 'This offer requires buying the full amount (ONE_TO_ONE)',
      });

      const result = await main({
        tokenId: 'token-diagnostic',
        tokenDecimals: 2,
        amount: 25,
        maxPrice: 1,
        buyerAddress: 'ecash:test',
        buyerMnemonic: 'test mnemonic',
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('ONE_TO_ONE_REQUIRED');
      expect(result.details).toEqual(
        expect.objectContaining({
          matchingOffersCount: 1,
          matchingOffers: [
            expect.objectContaining({
              offerType: 'ONE_TO_ONE',
              compatible: false,
              incompatibleReason: 'ONE_TO_ONE_REQUIRES_FULL_AMOUNT',
              totalAmount: 50,
            }),
          ],
          skippedOffers: [
            expect.objectContaining({
              reason: 'ONE_TO_ONE_REQUIRED',
            }),
          ],
        }),
      );
    });

    it('should convert amount to atoms correctly for acceptAgoraOffer', async () => {
      vi.mocked(ecashQuicksend.fetchAgoraOffers).mockResolvedValue([
        buildOffer({
          totalTokenAmount: 1234567n,
          totalXEC: 123.4567,
        }),
      ]);
      vi.mocked(ecashQuicksend.acceptAgoraOffer).mockResolvedValue({
        success: true,
        txid: 'test',
        actualAmount: 1234567n,
        totalXECPaid: 133.4567,
        pricePerToken: 0.0001,
        networkFee: 10,
        swapFeePaid: 0,
      });

      await main({
        tokenId: 'token123',
        tokenDecimals: 6,
        amount: 1.234567,
        maxPrice: 100,
        buyerAddress: 'ecash:test',
        buyerMnemonic: 'test mnemonic',
      });

      expect(ecashQuicksend.fetchAgoraOffers).toHaveBeenCalledWith({
        tokenId: 'token123',
        maxPrice: 0.0001,
      });
      expect(ecashQuicksend.acceptAgoraOffer).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          amount: 1234567n,
          mnemonic: 'test mnemonic',
          feeOutput: {
            address: AGORA_SWAP_FEE_ADDRESS,
            feeBps: AGORA_SWAP_FEE_BPS,
            minSats: AGORA_SWAP_FEE_MIN_SATS,
          },
        }),
      );
    });

    it('should handle missing tokenDecimals (default to 0)', async () => {
      vi.mocked(ecashQuicksend.fetchAgoraOffers).mockResolvedValue([
        buildOffer({
          pricePerToken: 1,
          totalTokenAmount: 10n,
          totalXEC: 10,
        }),
      ]);
      vi.mocked(ecashQuicksend.acceptAgoraOffer).mockResolvedValue({
        success: true,
        txid: 'test',
        actualAmount: 10n,
        totalXECPaid: 15,
        pricePerToken: 1,
        networkFee: 5,
        swapFeePaid: 0,
      });

      const result = await main({
        tokenId: 'token123',
        amount: 10,
        maxPrice: 1,
        buyerAddress: 'ecash:test',
        buyerMnemonic: 'test mnemonic',
      });

      expect(result.success).toBe(true);
      expect(result.actualAmount).toBe(10);
    });

    it('should handle generic execution error', async () => {
      vi.mocked(ecashQuicksend.fetchAgoraOffers).mockRejectedValue(
        new Error('Network timeout'),
      );

      const result = await main({
        tokenId: 'token123',
        tokenDecimals: 6,
        amount: 1,
        maxPrice: 100,
        buyerAddress: 'ecash:test',
        buyerMnemonic: 'test mnemonic',
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('EXECUTION_ERROR');
      expect(result.message).toBe('Network timeout');
    });

    it('should handle error without message property', async () => {
      vi.mocked(ecashQuicksend.fetchAgoraOffers).mockRejectedValue('String error');

      const result = await main({
        tokenId: 'token123',
        tokenDecimals: 6,
        amount: 1,
        maxPrice: 100,
        buyerAddress: 'ecash:test',
        buyerMnemonic: 'test mnemonic',
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('EXECUTION_ERROR');
      expect(result.message).toBe('');
    });
  });
});
