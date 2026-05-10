import { acceptAgoraOffer, fetchAgoraOffers } from 'ecash-quicksend';
import { getAgoraSwapFeeOutput } from '@/lib/agora-swap-fee';

const formatDisplayAmount = (atoms, factor) => Number(atoms) / factor;

function summarizeMatchingOffers(matchingOffers, requestedAmountAtoms, factor) {
  return {
    matchingOffersCount: matchingOffers.length,
    matchingOffers: matchingOffers.slice(0, 3).map((offer) => {
      const totalAmountAtoms = offer.totalTokenAmount;
      const requestedForOfferAtoms =
        requestedAmountAtoms < totalAmountAtoms
          ? requestedAmountAtoms
          : totalAmountAtoms;

      const baseSummary = {
        offerType: offer.offerType,
        pricePerToken: offer.pricePerToken * factor,
        totalAmount: formatDisplayAmount(totalAmountAtoms, factor),
      };

      if (offer.offerType === 'ONE_TO_ONE') {
        return {
          ...baseSummary,
          compatible: requestedAmountAtoms >= totalAmountAtoms,
          incompatibleReason:
            requestedAmountAtoms < totalAmountAtoms
              ? 'ONE_TO_ONE_REQUIRES_FULL_AMOUNT'
              : null,
        };
      }

      const partial = offer.offer?.variant?.params;
      const minAcceptedAtoms =
        partial && typeof partial.minAcceptedAtoms === 'function'
          ? partial.minAcceptedAtoms()
          : 0n;
      const preparedAcceptedAtoms =
        partial && typeof partial.prepareAcceptedAtoms === 'function'
          ? partial.prepareAcceptedAtoms(requestedForOfferAtoms)
          : requestedForOfferAtoms;
      const remainingAtoms = totalAmountAtoms - preparedAcceptedAtoms;
      const autoBuysFullOffer =
        remainingAtoms > 0n &&
        minAcceptedAtoms > 0n &&
        remainingAtoms < minAcceptedAtoms;
      const effectiveAcceptedAtoms = autoBuysFullOffer
        ? totalAmountAtoms
        : preparedAcceptedAtoms;

      return {
        ...baseSummary,
        compatible:
          requestedForOfferAtoms >= minAcceptedAtoms &&
          effectiveAcceptedAtoms > 0n,
        incompatibleReason:
          requestedForOfferAtoms < minAcceptedAtoms
            ? 'AMOUNT_BELOW_MIN_ACCEPTED'
            : effectiveAcceptedAtoms <= 0n
              ? 'PREPARED_ACCEPTED_AMOUNT_IS_ZERO'
              : null,
        minAcceptedAmount: formatDisplayAmount(minAcceptedAtoms, factor),
        effectiveAcceptedAmount: formatDisplayAmount(
          effectiveAcceptedAtoms,
          factor,
        ),
        autoBuysFullOffer,
      };
    }),
  };
}

function getOfferExecutionPrice(offer) {
  const price = Number(offer?.pricePerToken);
  return Number.isFinite(price) ? price : Number.POSITIVE_INFINITY;
}

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
    const fetchedOffers = await fetchAgoraOffers({
      tokenId: String(config.tokenId),
      maxPrice: maxPricePerAtom,
    });
    const matchingOffers = [...fetchedOffers].sort(
      (left, right) => getOfferExecutionPrice(left) - getOfferExecutionPrice(right),
    );
    const offerDiagnostics = summarizeMatchingOffers(
      matchingOffers,
      amountAtoms,
      factor,
    );

    if (matchingOffers.length === 0) {
      return {
        success: false,
        reason: 'NO_SUITABLE_OFFERS',
        message: `No offers found below ${config.maxPrice} XEC`,
        details: {
          skippedOffers: [],
          ...offerDiagnostics,
        },
      };
    }

    const feeOutput = getAgoraSwapFeeOutput();
    const normalizedTransactions = [];
    const skippedOffers = [];
    let totalBoughtAtoms = 0n;
    let totalXECPaid = 0;
    let totalSwapFeePaid = 0;

    for (const offer of matchingOffers) {
      if (totalBoughtAtoms >= amountAtoms) {
        break;
      }

      const remainingAmountAtoms = amountAtoms - totalBoughtAtoms;
      const buyAmountAtoms =
        remainingAmountAtoms < offer.totalTokenAmount
          ? remainingAmountAtoms
          : offer.totalTokenAmount;
      const result = await acceptAgoraOffer(offer, {
        amount: buyAmountAtoms,
        mnemonic: config.buyerMnemonic,
        feeOutput,
      });

      if (result.success && result.txid) {
        const actualAmountAtoms = result.actualAmount || buyAmountAtoms;
        normalizedTransactions.push({
          txid: result.txid,
          amount: Number(actualAmountAtoms) / factor,
          pricePerToken: (result.pricePerToken || offer.pricePerToken) * factor,
          networkFee: result.networkFee || 0,
          swapFee: result.swapFeePaid || 0,
          totalFees: (result.networkFee || 0) + (result.swapFeePaid || 0),
        });
        totalBoughtAtoms += actualAmountAtoms;
        totalXECPaid += result.totalXECPaid || 0;
        totalSwapFeePaid += result.swapFeePaid || 0;
        continue;
      }

      skippedOffers.push({
        reason: result.reason || 'UNKNOWN',
        message: result.message || null,
        offerType: offer.offerType,
        pricePerToken: offer.pricePerToken * factor,
        totalAmount: formatDisplayAmount(offer.totalTokenAmount, factor),
      });
    }

    if (normalizedTransactions.length === 0) {
      const firstSkippedOffer = skippedOffers[0] || null;

      return {
        success: false,
        reason: firstSkippedOffer?.reason || 'NO_SUITABLE_OFFERS',
        message:
          firstSkippedOffer?.message ||
          `Partially filled: bought 0 of ${amountAtoms.toString()} tokens`,
        details: {
          skippedOffers,
          ...offerDiagnostics,
        },
      };
    }

    const firstTx = normalizedTransactions[0];
    const actualAmountDisplay = normalizedTransactions.reduce(
      (sum, tx) => sum + tx.amount,
      0,
    );
    const totalNetworkFee = normalizedTransactions.reduce(
      (sum, tx) => sum + tx.networkFee,
      0,
    );

    return {
      success: true,
      reason: 'SUCCESS',
      txid: firstTx.txid,
      explorerLink: `https://explorer.e.cash/tx/${firstTx.txid}`,
      actualAmount: actualAmountDisplay,
      totalXECPaid,
      pricePerToken: firstTx.pricePerToken,
      networkFee: totalNetworkFee,
      swapFee: totalSwapFeePaid,
      totalFees: totalNetworkFee + totalSwapFeePaid,
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
