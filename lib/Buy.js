import { acceptAgoraOffer, fetchAgoraOffers } from 'ecash-quicksend';
import { getAgoraSwapFeeOutput } from '@/lib/agora-swap-fee';
import { parseDecimalToAtoms } from '@/lib/decimal';

const DISPLAY_PRICE_DECIMALS = 8;
const DISPLAY_PRICE_HALF_TICK_XEC = 0.5 / Math.pow(10, DISPLAY_PRICE_DECIMALS);

const formatDisplayAmount = (atoms, factor) => Number(atoms) / factor;

function getExecutionMaxPricePerAtom(maxPrice, factor) {
  const maxPricePerAtom = maxPrice / factor;
  if (!Number.isFinite(maxPricePerAtom) || maxPricePerAtom <= 0) {
    return maxPricePerAtom;
  }

  return maxPricePerAtom + (DISPLAY_PRICE_HALF_TICK_XEC / factor);
}

function expandScientificNotation(value) {
  if (!/[eE]/.test(value)) {
    return value;
  }

  const match = value.match(/^([+-]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
  if (!match) {
    return value;
  }

  const [, sign, integerPart, fractionPart = '', exponentText] = match;
  const exponent = Number(exponentText);
  if (!Number.isInteger(exponent)) {
    return value;
  }

  const digits = `${integerPart}${fractionPart}`;
  const decimalIndex = integerPart.length + exponent;
  let expanded;

  if (decimalIndex <= 0) {
    expanded = `0.${'0'.repeat(-decimalIndex)}${digits}`;
  } else if (decimalIndex >= digits.length) {
    expanded = `${digits}${'0'.repeat(decimalIndex - digits.length)}`;
  } else {
    expanded = `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
  }

  return sign === '-' ? `-${expanded}` : expanded;
}

function normalizeAmountInput(amount) {
  if (typeof amount === 'string') {
    const trimmed = amount.trim();
    if (!trimmed) {
      throw new Error('Amount must be a number or decimal string');
    }

    return expandScientificNotation(trimmed).replace(/^\+/, '');
  }

  if (typeof amount === 'number') {
    if (!Number.isFinite(amount)) {
      throw new Error('Amount must be a finite number');
    }

    return expandScientificNotation(String(amount));
  }

  throw new Error('Amount must be a number or decimal string');
}

function parseAmountAtoms(amount, decimals) {
  const normalizedAmount = normalizeAmountInput(amount);
  const amountAtoms = parseDecimalToAtoms(normalizedAmount, decimals);

  if (amountAtoms === null) {
    throw new Error(
      `Invalid amount "${normalizedAmount}" for a token with ${decimals} decimal places`,
    );
  }

  if (amountAtoms <= 0n) {
    throw new Error('Amount must be greater than 0');
  }

  return amountAtoms;
}

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

function estimateOfferCostXec(offer, atoms) {
  if (atoms <= 0n) {
    return 0;
  }

  const rawOffer = offer?.offer;
  try {
    const askedSats =
      rawOffer?.variant?.type === 'PARTIAL'
        ? rawOffer.askedSats(atoms)
        : rawOffer?.askedSats?.();

    if (typeof askedSats === 'bigint') {
      return Number(askedSats) / 100;
    }
  } catch (_error) {}

  const pricePerAtom = getOfferExecutionPrice(offer);
  if (!Number.isFinite(pricePerAtom)) {
    return Number.POSITIVE_INFINITY;
  }

  return (Number(atoms) * pricePerAtom);
}

function getPreparedAcceptedAtoms(offer, requestedAtoms) {
  if (requestedAtoms <= 0n) {
    return 0n;
  }

  const availableAtoms = offer?.totalTokenAmount || 0n;
  if (availableAtoms <= 0n) {
    return 0n;
  }

  if (offer?.offerType === 'ONE_TO_ONE') {
    return requestedAtoms >= availableAtoms ? availableAtoms : 0n;
  }

  const partial = offer.offer?.variant?.params;
  const minAcceptedAtoms =
    partial && typeof partial.minAcceptedAtoms === 'function'
      ? partial.minAcceptedAtoms()
      : 0n;

  if (requestedAtoms < minAcceptedAtoms) {
    return 0n;
  }

  let acceptedAtoms =
    requestedAtoms > availableAtoms ? availableAtoms : requestedAtoms;

  if (partial && typeof partial.prepareAcceptedAtoms === 'function') {
    acceptedAtoms = partial.prepareAcceptedAtoms(acceptedAtoms);
  }

  const remainingAtoms = availableAtoms - acceptedAtoms;
  if (remainingAtoms > 0n && minAcceptedAtoms > 0n && remainingAtoms < minAcceptedAtoms) {
    acceptedAtoms = availableAtoms;
  }

  return acceptedAtoms;
}

function getMaxAffordableAtoms(offer, maxAtoms, remainingTokenCostCapXec) {
  if (
    maxAtoms <= 0n ||
    !Number.isFinite(remainingTokenCostCapXec) ||
    remainingTokenCostCapXec <= 0
  ) {
    return 0n;
  }

  const fullAcceptedAtoms = getPreparedAcceptedAtoms(offer, maxAtoms);
  const fullCostXec = estimateOfferCostXec(offer, fullAcceptedAtoms);
  if (fullCostXec <= remainingTokenCostCapXec + 0.00000001) {
    return fullAcceptedAtoms <= maxAtoms ? fullAcceptedAtoms : 0n;
  }

  let low = 0n;
  let high = maxAtoms;
  let best = 0n;

  while (low <= high) {
    const mid = (low + high) / 2n;
    const acceptedAtoms = getPreparedAcceptedAtoms(offer, mid);
    const acceptedCostXec = estimateOfferCostXec(offer, acceptedAtoms);

    if (
      acceptedAtoms > 0n &&
      acceptedAtoms <= maxAtoms &&
      acceptedCostXec <= remainingTokenCostCapXec + 0.00000001
    ) {
      best = acceptedAtoms;
      low = mid + 1n;
    } else {
      high = mid - 1n;
    }
  }

  return best;
}

/**
 * Buy tokens from Agora DEX using ecash-quicksend.
 *
 * @param {object} config
 * @param {string}  config.tokenId
 * @param {number}  config.tokenDecimals
 * @param {string|number}  config.amount       – display-unit amount (human-readable)
 * @param {number}  config.maxPrice     – max XEC per display-unit token
 * @param {number=} config.tokenCostCapXec – max maker payout for this execution
 * @param {string}  config.buyerAddress – (unused by quicksend, kept for compat)
 * @param {string}  config.buyerMnemonic
 */
async function main(config) {
  try {
    if (!config) {
      throw new Error('Configuration parameters are required');
    }

    const decimals = Number.isFinite(config.tokenDecimals)
      ? Math.max(0, Math.trunc(config.tokenDecimals))
      : 0;
    const factor = Math.pow(10, decimals);

    // Convert display amount → atoms (bigint) without floating-point math.
    const amountAtoms = parseAmountAtoms(config.amount, decimals);

    // Convert XEC-per-display-token → XEC-per-atom
    const maxPricePerAtom = config.maxPrice / factor;
    const executionMaxPricePerAtom = getExecutionMaxPricePerAtom(
      config.maxPrice,
      factor,
    );
    const fetchedOffers = await fetchAgoraOffers({
      tokenId: String(config.tokenId),
      maxPrice: executionMaxPricePerAtom,
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
          requestedMaxPricePerAtom: maxPricePerAtom,
          executionMaxPricePerAtom,
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
    let totalTokenCostPaid = 0;
    const tokenCostCapXec = Number(config.tokenCostCapXec);
    const hasTokenCostCap =
      Number.isFinite(tokenCostCapXec) && tokenCostCapXec > 0;

    for (const offer of matchingOffers) {
      if (totalBoughtAtoms >= amountAtoms) {
        break;
      }

      const remainingAmountAtoms = amountAtoms - totalBoughtAtoms;
      let buyAmountAtoms =
        remainingAmountAtoms < offer.totalTokenAmount
          ? remainingAmountAtoms
          : offer.totalTokenAmount;

      if (hasTokenCostCap) {
        const remainingTokenCostCapXec = tokenCostCapXec - totalTokenCostPaid;
        buyAmountAtoms = getMaxAffordableAtoms(
          offer,
          buyAmountAtoms,
          remainingTokenCostCapXec,
        );

        if (buyAmountAtoms <= 0n) {
          skippedOffers.push({
            reason: 'TOKEN_COST_CAP_REACHED',
            message: `Token cost cap ${tokenCostCapXec} XEC reached`,
            offerType: offer.offerType,
            pricePerToken: offer.pricePerToken * factor,
            totalAmount: formatDisplayAmount(offer.totalTokenAmount, factor),
          });
          break;
        }
      }

      const result = await acceptAgoraOffer(offer, {
        amount: buyAmountAtoms,
        mnemonic: config.buyerMnemonic,
        feeOutput,
      });

      if (result.success && result.txid) {
        const actualAmountAtoms = result.actualAmount || buyAmountAtoms;
        const tokenCostXec =
          typeof result.pricePerToken === 'number'
            ? result.pricePerToken * Number(actualAmountAtoms)
            : Math.max(
                0,
                (result.totalXECPaid || 0) -
                  (result.networkFee || 0) -
                  (result.swapFeePaid || 0),
              );
        normalizedTransactions.push({
          txid: result.txid,
          amount: Number(actualAmountAtoms) / factor,
          pricePerToken: (result.pricePerToken || offer.pricePerToken) * factor,
          tokenCost: tokenCostXec,
          networkFee: result.networkFee || 0,
          swapFee: result.swapFeePaid || 0,
          totalFees: (result.networkFee || 0) + (result.swapFeePaid || 0),
        });
        totalBoughtAtoms += actualAmountAtoms;
        totalXECPaid += result.totalXECPaid || 0;
        totalSwapFeePaid += result.swapFeePaid || 0;
        totalTokenCostPaid += tokenCostXec;
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
          requestedMaxPricePerAtom: maxPricePerAtom,
          executionMaxPricePerAtom,
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
      totalTokenCostPaid,
      pricePerToken: firstTx.pricePerToken,
      networkFee: totalNetworkFee,
      swapFee: totalSwapFeePaid,
      totalFees: totalNetworkFee + totalSwapFeePaid,
      transactions: normalizedTransactions,
    };
  } catch (error) {
    console.error('Buy execution failed:', error);

    const msg = error?.message || '';

    if (msg.includes('Amount must') || msg.includes('Invalid amount')) {
      return {
        success: false,
        reason: 'INVALID_INPUT',
        message: msg,
        details: { error: msg },
      };
    }

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
