import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_BASE_NETWORK_FEE_XEC,
  estimateAgoraNetworkFeeXec,
  estimateNetworkFeeXecFromAddress,
  estimateNetworkFeeXecFromUtxos,
} from '@/lib/networkFee';
import * as chronik from '@/lib/chronik';
import {
  utxosEmpty,
  utxosFive,
  utxosHundred,
  utxosSingle,
  utxosThreeDistinct,
  utxosTwo,
} from '../fixtures/utxos';

vi.mock('@/lib/chronik', () => ({
  fetchAddressXecUtxos: vi.fn(),
}));

describe('networkFee', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('estimateAgoraNetworkFeeXec', () => {
    it('uses the shared default base fee for a single buyer input', () => {
      expect(estimateAgoraNetworkFeeXec()).toBe(DEFAULT_BASE_NETWORK_FEE_XEC);
      expect(DEFAULT_BASE_NETWORK_FEE_XEC).toBeCloseTo(4.76, 2);
    });

    it('adds incremental fee as more buyer inputs are required', () => {
      expect(estimateAgoraNetworkFeeXec(2)).toBeGreaterThan(
        estimateAgoraNetworkFeeXec(1),
      );
      expect(estimateAgoraNetworkFeeXec(5)).toBeGreaterThan(
        estimateAgoraNetworkFeeXec(2),
      );
    });
  });

  describe('estimateNetworkFeeXecFromUtxos', () => {
    it('falls back to the default base fee when there are no UTXOs', () => {
      expect(estimateNetworkFeeXecFromUtxos(utxosEmpty)).toEqual({
        fee: DEFAULT_BASE_NETWORK_FEE_XEC,
        utxoCount: 0,
        selectedInputCount: 1,
      });
    });

    it('selects only the minimal number of inputs needed for the reference spend', () => {
      const result = estimateNetworkFeeXecFromUtxos(utxosThreeDistinct, 45);

      expect(result).toEqual({
        fee: estimateAgoraNetworkFeeXec(2),
        utxoCount: 3,
        selectedInputCount: 2,
      });
    });

    it('keeps all available inputs when the wallet cannot cover the reference spend', () => {
      const result = estimateNetworkFeeXecFromUtxos(utxosFive, 100);

      expect(result).toEqual({
        fee: estimateAgoraNetworkFeeXec(5),
        utxoCount: 5,
        selectedInputCount: 5,
      });
    });

    it('caps the estimate to the inputs actually needed even with many UTXOs', () => {
      const result = estimateNetworkFeeXecFromUtxos(utxosHundred, 100);

      expect(result.utxoCount).toBe(100);
      expect(result.selectedInputCount).toBe(10);
      expect(result.fee).toBe(estimateAgoraNetworkFeeXec(10));
    });

    it('treats non-positive reference spend as a one-input estimate', () => {
      const result = estimateNetworkFeeXecFromUtxos(utxosTwo, 0);

      expect(result).toEqual({
        fee: DEFAULT_BASE_NETWORK_FEE_XEC,
        utxoCount: 2,
        selectedInputCount: 1,
      });
    });
  });

  describe('estimateNetworkFeeXecFromAddress', () => {
    it('throws when the address is empty', async () => {
      await expect(estimateNetworkFeeXecFromAddress('')).rejects.toThrow(
        'address is required',
      );
    });

    it('uses the shared UTXO estimator for a connected wallet', async () => {
      vi.mocked(chronik.fetchAddressXecUtxos).mockResolvedValue(utxosSingle as any);

      const result = await estimateNetworkFeeXecFromAddress('ecash:test123');

      expect(result).toEqual({
        fee: DEFAULT_BASE_NETWORK_FEE_XEC,
        utxoCount: 1,
        selectedInputCount: 1,
      });
    });

    it('supports a custom reference spend when estimating from address', async () => {
      vi.mocked(chronik.fetchAddressXecUtxos).mockResolvedValue(
        utxosThreeDistinct as any,
      );

      const result = await estimateNetworkFeeXecFromAddress('ecash:test123', 60);

      expect(result).toEqual({
        fee: estimateAgoraNetworkFeeXec(3),
        utxoCount: 3,
        selectedInputCount: 3,
      });
    });

    it('propagates fetchAddressXecUtxos errors', async () => {
      vi.mocked(chronik.fetchAddressXecUtxos).mockRejectedValue(
        new Error('Network error'),
      );

      await expect(
        estimateNetworkFeeXecFromAddress('ecash:test123'),
      ).rejects.toThrow('Network error');
    });

    it('handles empty UTXO responses', async () => {
      vi.mocked(chronik.fetchAddressXecUtxos).mockResolvedValue(utxosEmpty);

      const result = await estimateNetworkFeeXecFromAddress('ecash:test123');

      expect(result.utxoCount).toBe(0);
      expect(result.fee).toBe(DEFAULT_BASE_NETWORK_FEE_XEC);
      expect(result.selectedInputCount).toBe(1);
    });
  });
});
