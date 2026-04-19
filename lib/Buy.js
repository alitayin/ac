import { buyAgoraTokens } from 'ecash-quicksend';
import { getAgoraSwapFeeOutput } from '@/lib/agora-swap-fee';

/**
 * Buy tokens from Agora DEX using ecash-quicksend.
 *
 * @param {object} config
 * @param {string}  config.tokenId
 * @param {number}  config.tokenDecimals
 * @param {number}  config.amount       – display-unit amount (human-readable)
 * @param {number}  config.maxPrice     – max XEC per display-unit token
 * @param {string}  config.buyerAddress – (unused by quicksend, kept for compat)
 * @param {string}  config.buyerMnemonic
 */
async function main(config) {
  try {
    if (!config) {
      throw new Error('Configuration parameters are required');
    }

    const decimals = config.tokenDecimals || 0;
    const factor = Math.pow(10, decimals);

    // Convert display amount → atoms (bigint)
    const amountAtoms = BigInt(Math.floor(config.amount * factor));

    // Convert XEC-per-display-token → XEC-per-atom
    const maxPricePerAtom = config.maxPrice / factor;

    const result = await buyAgoraTokens({
      tokenId: String(config.tokenId),
      amount: amountAtoms,
      maxPrice: maxPricePerAtom,
      mnemonic: config.buyerMnemonic,
      feeOutput: getAgoraSwapFeeOutput(),
    });

    if (!result.success || result.transactions.length === 0) {
      // Map quicksend failure to the shape Auto.js expects
      return {
        success: false,
        reason: result.message?.includes('balance')
          ? 'INSUFFICIENT_BALANCE'
          : 'NO_SUITABLE_OFFERS',
        message: result.message || 'No matching offers found',
        details: {
          skippedOffers: result.skippedOffers,
        },
      };
    }

    const normalizedTransactions = result.transactions.map((tx) => ({
      txid: tx.txid,
      amount: Number(tx.amount) / factor,
      pricePerToken: tx.price * factor,
      networkFee: tx.fee || 0,
      swapFee: tx.swapFee || 0,
      totalFees: (tx.fee || 0) + (tx.swapFee || 0),
    }));

    const firstTx = normalizedTransactions[0];
    const actualAmountDisplay = normalizedTransactions.reduce(
      (sum, tx) => sum + tx.amount,
      0,
    );
    const totalNetworkFee = normalizedTransactions.reduce(
      (sum, tx) => sum + tx.networkFee,
      0,
    );
    const totalSwapFee =
      typeof result.totalSwapFeePaid === 'number'
        ? result.totalSwapFeePaid
        : normalizedTransactions.reduce((sum, tx) => sum + tx.swapFee, 0);

    return {
      success: true,
      reason: 'SUCCESS',
      txid: firstTx.txid,
      explorerLink: `https://explorer.e.cash/tx/${firstTx.txid}`,
      actualAmount: actualAmountDisplay,
      totalXECPaid: result.totalXECPaid,
      pricePerToken: firstTx.pricePerToken,
      networkFee: totalNetworkFee,
      swapFee: totalSwapFee,
      totalFees: totalNetworkFee + totalSwapFee,
      transactions: normalizedTransactions,
    };
  } catch (error) {
    console.error('Buy execution failed:', error);

    const msg = error?.message || '';

    if (msg.includes('Insufficient') || msg.includes('balance')) {
      return {
        success: false,
        reason: 'INSUFFICIENT_BALANCE_WITH_FEE',
        message: msg,
        details: { error: msg },
      };
    }

    return {
      success: false,
      reason: 'EXECUTION_ERROR',
      message: msg,
      details: { error: String(error) },
    };
  }
}

export { main };
