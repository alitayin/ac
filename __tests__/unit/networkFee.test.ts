import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  estimateNetworkFeeXecFromAddress,
  DEFAULT_BASE_NETWORK_FEE_XEC,
  DEFAULT_PER_UTXO_FEE_XEC,
} from '@/lib/networkFee';
import * as chronik from '@/lib/chronik';
import { utxosEmpty, utxosSingle, utxosThreeDistinct, utxosFive, utxosSeven, utxosTwo, utxosHundred } from '../fixtures/utxos';

vi.mock('@/lib/chronik', () => ({
  fetchAddressXecUtxos: vi.fn(),
}));

describe('networkFee', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('estimateNetworkFeeXecFromAddress', () => {
    it('should throw error if address is empty', async () => {
      await expect(estimateNetworkFeeXecFromAddress('')).rejects.toThrow(
        'address is required'
      );
    });

    it('should calculate fee with 0 UTXOs (minimum base fee)', async () => {
      vi.mocked(chronik.fetchAddressXecUtxos).mockResolvedValue(utxosEmpty);

      const result = await estimateNetworkFeeXecFromAddress('ecash:test123');

      expect(result).toEqual({
        fee: DEFAULT_BASE_NETWORK_FEE_XEC,
        utxoCount: 0,
      });
    });

    it('should calculate fee with 1 UTXO', async () => {
      vi.mocked(chronik.fetchAddressXecUtxos).mockResolvedValue(utxosSingle as any);

      const result = await estimateNetworkFeeXecFromAddress('ecash:test123');

      expect(result).toEqual({
        fee: DEFAULT_BASE_NETWORK_FEE_XEC + DEFAULT_PER_UTXO_FEE_XEC * 1,
        utxoCount: 1,
      });
      expect(result.fee).toBe(16); // 10 + 6*1
    });

    it('should calculate fee with 5 UTXOs', async () => {
      vi.mocked(chronik.fetchAddressXecUtxos).mockResolvedValue(utxosFive as any);

      const result = await estimateNetworkFeeXecFromAddress('ecash:test123');

      expect(result).toEqual({
        fee: DEFAULT_BASE_NETWORK_FEE_XEC + DEFAULT_PER_UTXO_FEE_XEC * 5,
        utxoCount: 5,
      });
      expect(result.fee).toBe(40); // 10 + 6*5
    });

    it('should calculate fee with 100 UTXOs (large UTXO count)', async () => {
      vi.mocked(chronik.fetchAddressXecUtxos).mockResolvedValue(utxosHundred as any);

      const result = await estimateNetworkFeeXecFromAddress('ecash:test123');

      expect(result).toEqual({
        fee: DEFAULT_BASE_NETWORK_FEE_XEC + DEFAULT_PER_UTXO_FEE_XEC * 100,
        utxoCount: 100,
      });
      expect(result.fee).toBe(610); // 10 + 6*100
    });

    it('should use custom base fee', async () => {
      vi.mocked(chronik.fetchAddressXecUtxos).mockResolvedValue(utxosSingle as any);

      const customBaseFee = 50;
      const result = await estimateNetworkFeeXecFromAddress(
        'ecash:test123',
        customBaseFee
      );

      expect(result.fee).toBe(56); // 50 + 6*1
    });

    it('should use custom per-UTXO fee', async () => {
      vi.mocked(chronik.fetchAddressXecUtxos).mockResolvedValue(utxosThreeDistinct as any);

      const customPerUtxoFee = 10;
      const result = await estimateNetworkFeeXecFromAddress(
        'ecash:test123',
        DEFAULT_BASE_NETWORK_FEE_XEC,
        customPerUtxoFee
      );

      expect(result.fee).toBe(40); // 10 + 10*3
    });

    it('should use both custom fees', async () => {
      vi.mocked(chronik.fetchAddressXecUtxos).mockResolvedValue(utxosTwo as any);

      const result = await estimateNetworkFeeXecFromAddress(
        'ecash:test123',
        30,
        8
      );

      expect(result.fee).toBe(46); // 30 + 8*2
    });

    it('should return minimum of base fee when calculated fee is lower', async () => {
      vi.mocked(chronik.fetchAddressXecUtxos).mockResolvedValue(utxosSingle as any);

      // Edge case: if baseFee is very high and perUtxoFee is negative (shouldn't happen in practice)
      const result = await estimateNetworkFeeXecFromAddress(
        'ecash:test123',
        100,
        -10
      );

      expect(result.fee).toBe(100); // Math.max(90, 100) = 100
    });

    it('should handle fetchAddressXecUtxos error', async () => {
      vi.mocked(chronik.fetchAddressXecUtxos).mockRejectedValue(
        new Error('Network error')
      );

      await expect(
        estimateNetworkFeeXecFromAddress('ecash:test123')
      ).rejects.toThrow('Network error');
    });

    it('should handle empty UTXO array correctly', async () => {
      vi.mocked(chronik.fetchAddressXecUtxos).mockResolvedValue(utxosEmpty);

      const result = await estimateNetworkFeeXecFromAddress('ecash:test123');

      expect(result.utxoCount).toBe(0);
      expect(result.fee).toBe(DEFAULT_BASE_NETWORK_FEE_XEC);
    });

    it('should calculate fee correctly with decimal UTXO count (edge case)', async () => {
      vi.mocked(chronik.fetchAddressXecUtxos).mockResolvedValue(utxosSeven as any);

      const result = await estimateNetworkFeeXecFromAddress('ecash:test123');

      expect(result.fee).toBe(52); // 10 + 6*7
      expect(Number.isInteger(result.fee)).toBe(true);
    });
  });
});
