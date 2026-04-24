import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_BASE_NETWORK_FEE_XEC,
  DEFAULT_PER_UTXO_FEE_XEC,
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
    it('uses the shared default base fee when no UTXOs are available', () => {
      expect(DEFAULT_BASE_NETWORK_FEE_XEC).toBe(12);
      expect(estimateAgoraNetworkFeeXec()).toBe(DEFAULT_BASE_NETWORK_FEE_XEC);
    });

    it('adds 7 XEC per wallet UTXO', () => {
      expect(DEFAULT_PER_UTXO_FEE_XEC).toBe(7);
      expect(estimateAgoraNetworkFeeXec(1)).toBe(19);
      expect(estimateAgoraNetworkFeeXec(5)).toBe(47);
    });

    it('never drops below the base fee', () => {
      expect(estimateAgoraNetworkFeeXec(-1)).toBe(DEFAULT_BASE_NETWORK_FEE_XEC);
    });
  });

  describe('estimateNetworkFeeXecFromUtxos', () => {
    it('falls back to the default base fee when there are no UTXOs', () => {
      expect(estimateNetworkFeeXecFromUtxos(utxosEmpty)).toEqual({
        fee: DEFAULT_BASE_NETWORK_FEE_XEC,
        utxoCount: 0,
        selectedInputCount: 0,
      });
    });

    it('charges for every spendable wallet UTXO', () => {
      const result = estimateNetworkFeeXecFromUtxos(utxosThreeDistinct, 45);

      expect(result).toEqual({
        fee: estimateAgoraNetworkFeeXec(3),
        utxoCount: 3,
        selectedInputCount: 3,
      });
    });

    it('keeps the linear per-UTXO fee for larger wallets', () => {
      const result = estimateNetworkFeeXecFromUtxos(utxosFive, 100);

      expect(result).toEqual({
        fee: estimateAgoraNetworkFeeXec(5),
        utxoCount: 5,
        selectedInputCount: 5,
      });
    });

    it('does not cap the fee when the wallet has many UTXOs', () => {
      const result = estimateNetworkFeeXecFromUtxos(utxosHundred, 100);

      expect(result.utxoCount).toBe(100);
      expect(result.selectedInputCount).toBe(100);
      expect(result.fee).toBe(estimateAgoraNetworkFeeXec(100));
    });

    it('ignores the reference spend and still uses the wallet UTXO count', () => {
      const result = estimateNetworkFeeXecFromUtxos(utxosTwo, 0);

      expect(result).toEqual({
        fee: estimateAgoraNetworkFeeXec(2),
        utxoCount: 2,
        selectedInputCount: 2,
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
        fee: estimateAgoraNetworkFeeXec(1),
        utxoCount: 1,
        selectedInputCount: 1,
      });
    });

    it('keeps the same count-based fee even when a custom reference spend is passed', async () => {
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
      expect(result.selectedInputCount).toBe(0);
    });
  });
});
