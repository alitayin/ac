import { chronik } from './chronik.ts';
import { fetchAgoraOffers, acceptAgoraOffer } from 'ecash-quicksend';
import { getAgoraSwapFeeOutput } from '@/lib/agora-swap-fee';

// Target maker public key for filtering offers (proxy token seller)
const TARGET_MAKER_PK_HEX = '03844f9237211759a7ed15d4ba3fe2037dca6ce07d832c35b01e221789831f145';

function compareMakerPkHex(offer, targetHex) {
  if (!offer.variant || !offer.variant.params || !offer.variant.params.makerPk) {
    return false;
  }

  const makerPk = offer.variant.params.makerPk;
  const bytes = [];
  for (let i = 0; i < 33; i++) {
    bytes.push(makerPk[i]);
  }
  const offerMakerHex = Buffer.from(bytes).toString('hex');

  return offerMakerHex === targetHex;
}

async function createOnlineBuyTransaction(amount, maxPrice, config) {
  try {
    if (!amount || amount <= 0) {
      throw new Error("Purchase amount must be greater than 0");
    }
    if (!maxPrice || maxPrice <= 0) {
      throw new Error("Maximum price must be greater than 0");
    }

    const decimals = config.tokenDecimals || 0;
    const tokenId = String(config.tokenId);

    // Convert amount to atoms (bigint)
    const amountWithDecimals = typeof amount === 'number'
      ? Math.floor(amount * Math.pow(10, decimals))
      : Math.floor(parseFloat(amount) * Math.pow(10, decimals));
    const amountBigInt = BigInt(amountWithDecimals);

    if (!config.buyerMnemonic) {
      throw new Error("buyerMnemonic is required in config");
    }

    // Fetch all offers for this token
    const offers = await fetchAgoraOffers({
      tokenId,
      chronik
    });

    if (!offers || offers.length === 0) {
      return {
        success: false,
        reason: 'NO_OFFERS',
        message: 'No offers found for this token',
        details: {}
      };
    }

    // Filter offers by target maker public key
    const filteredOffers = offers.filter(offerWrapper =>
      compareMakerPkHex(offerWrapper.offer, TARGET_MAKER_PK_HEX)
    );

    if (filteredOffers.length === 0) {
      return {
        success: false,
        reason: 'NO_TARGET_OFFERS',
        message: `No orders found from target address`,
        details: {
          totalOffers: offers.length,
          targetMakerPk: TARGET_MAKER_PK_HEX
        }
      };
    }

    // Filter by max price and sort by price
    const suitableOffers = filteredOffers
      .filter(offer => offer.pricePerToken <= maxPrice)
      .sort((a, b) => a.pricePerToken - b.pricePerToken);

    if (suitableOffers.length === 0) {
      return {
        success: false,
        reason: 'NO_SUITABLE_OFFERS',
        message: `No orders found with price below ${maxPrice} XEC`,
        details: {
          requestedPrice: maxPrice,
          requestedAmount: Number(amountBigInt)
        }
      };
    }

    // Try to accept the best offer
    const bestOffer = suitableOffers[0];

    // Determine how much we can buy from this offer
    let acceptedAmount = amountBigInt;
    if (bestOffer.totalTokenAmount < amountBigInt) {
      acceptedAmount = bestOffer.totalTokenAmount;
    }

    // For PARTIAL offers, check minimum accepted amount
    if (bestOffer.offerType === 'PARTIAL') {
      const offer = bestOffer.offer;
      const numTokenTruncBytes = offer.variant.params.numTokenTruncBytes;
      const truncFactor = 1n << BigInt(8 * numTokenTruncBytes);

      const minAcceptedScaledTruncTokens = offer.variant.params.minAcceptedScaledTruncTokens;
      const tokenScaleFactor = offer.variant.params.tokenScaleFactor;

      const minAcceptedAmount = (BigInt(minAcceptedScaledTruncTokens) * truncFactor) / BigInt(tokenScaleFactor);
      const minAcceptedTokens = Number(minAcceptedAmount) / Math.pow(10, decimals);

      // Truncate to valid amount
      acceptedAmount = (acceptedAmount / truncFactor) * truncFactor;

      if (acceptedAmount < minAcceptedAmount) {
        return {
          success: false,
          reason: 'AMOUNT_TOO_SMALL',
          message: `Purchase amount cannot be less than minimum accepted amount: ${minAcceptedTokens} tokens`,
          details: {
            minimum: minAcceptedTokens
          }
        };
      }

      // Check remaining amount
      const remainingTokens = bestOffer.totalTokenAmount - acceptedAmount;
      if (remainingTokens > 0n && remainingTokens < minAcceptedAmount) {
        return {
          success: false,
          reason: 'INVALID_REMAINING_AMOUNT',
          message: `Remaining amount ${Number(remainingTokens) / Math.pow(10, decimals)} is less than minimum accepted amount ${minAcceptedTokens}`,
          details: {
            remaining: Number(remainingTokens) / Math.pow(10, decimals),
            minimum: minAcceptedTokens
          }
        };
      }
    } else {
      // ONE_TO_ONE offer - must buy all
      if (acceptedAmount !== bestOffer.totalTokenAmount) {
        return {
          success: false,
          reason: 'MUST_BUY_ALL',
          message: 'This offer requires buying the full amount',
          details: {
            available: Number(bestOffer.totalTokenAmount) / Math.pow(10, decimals)
          }
        };
      }
    }

    // Accept the offer (without broadcasting)
    // Note: ecash-quicksend's acceptAgoraOffer doesn't support non-broadcast mode yet
    // We need to use a workaround by catching the broadcast and extracting rawTx
    // For now, we'll call it and handle the result

    try {
      const result = await acceptAgoraOffer(bestOffer.offer, {
        amount: acceptedAmount,
        mnemonic: config.buyerMnemonic,
        chronik,
        feeOutput: getAgoraSwapFeeOutput(),
      });

      if (!result.success) {
        return result;
      }

      // Return in the expected format for offline transaction
      const actualAmount = Number(result.actualAmount || 0n) / Math.pow(10, decimals);

      return {
        success: true,
        reason: 'TRANSACTION_CREATED',
        rawTxHex: result.txid || '', // Note: acceptAgoraOffer broadcasts by default, so we get txid instead of rawTxHex
        actualAmount: actualAmount,
        totalXECPaid: result.totalXECPaid || 0,
        pricePerToken: result.pricePerToken || 0,
        networkFee: result.networkFee || 0,
        swapFee: result.swapFeePaid || 0,
        totalFees: (result.networkFee || 0) + (result.swapFeePaid || 0),
        selectedUtxos: [],
        message: 'Transaction created and broadcast. TXID: ' + (result.txid || 'unknown')
      };
    } catch (error) {
      return {
        success: false,
        reason: 'ACCEPT_OFFER_ERROR',
        message: error.message || 'Failed to accept offer',
        details: {
          error: error.toString()
        }
      };
    }

  } catch (error) {
    console.error("Error creating transaction:", error);
    return {
      success: false,
      reason: 'TRANSACTION_CREATION_ERROR',
      message: error.message,
      details: {
        error: error.toString()
      }
    };
  }
}

async function main(config) {
  try {
    if (!config) {
      throw new Error('Configuration parameters must be provided');
    }

    const result = await createOnlineBuyTransaction(config.amount, config.maxPrice, config);
    return result;
  } catch (error) {
    console.error('Failed to create online buy transaction:', error);
    return {
      success: false,
      reason: 'EXECUTION_ERROR',
      message: error.message,
      details: {
        error: error.toString()
      }
    };
  }
}

export { main }; 
