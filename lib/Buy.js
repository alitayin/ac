import { ChronikClient } from 'chronik-client';
import { Agora } from 'ecash-agora';
import * as wif from 'wif';
import { decodeCashAddress } from 'ecashaddrjs';



import {
  P2PKHSignatory,
  Script,
  TxBuilder,
  fromHex,
  HdNode,
  mnemonicToSeed,
  shaRmd160,
  toHex,
  ALL_BIP143,
  Ecc
} from 'ecash-lib';

function patchUtxoForAgora(utxo) {
  if (!utxo) return utxo;

  let sats;
  if (typeof utxo.sats !== 'undefined') {
    sats = typeof utxo.sats === 'bigint' ? utxo.sats : BigInt(utxo.sats);
  } else if (typeof utxo.value !== 'undefined') {
    sats = typeof utxo.value === 'bigint' ? utxo.value : BigInt(utxo.value);
  } else {
    sats = 0n;
  }
  utxo.sats = sats;
  utxo.value = Number(sats);

  if (utxo.token) {
    const token = utxo.token;
    let atoms;
    if (typeof token.atoms !== 'undefined') {
      atoms = typeof token.atoms === 'bigint' ? token.atoms : BigInt(token.atoms);
    } else if (typeof token.amount !== 'undefined') {
      atoms = typeof token.amount === 'bigint' ? token.amount : BigInt(token.amount);
    } else {
      atoms = 0n;
    }
    token.atoms = atoms;
    token.amount = atoms;
  }

  return utxo;
}

function getTokenAtoms(token) {
  if (!token) return 0n;
  try {
    if (typeof token.atoms !== 'undefined') {
      return typeof token.atoms === 'bigint' ? token.atoms : BigInt(token.atoms);
    }
    if (typeof token.amount !== 'undefined') {
      return typeof token.amount === 'bigint' ? token.amount : BigInt(token.amount);
    }
  } catch (e) {
    console.error('getTokenAtoms error:', e);
  }
  return 0n;
}

function createAgoraChronik(chronik) {
  return {
    plugin(name) {
      const plugin = chronik.plugin(name);
      if (name !== 'agora') {
        return plugin;
      }
      const compatPlugin = Object.create(plugin);
      compatPlugin.utxos = async (groupHex) => {
        const res = await plugin.utxos(groupHex);
        if (Array.isArray(res.utxos)) {
          res.utxos = res.utxos.map(patchUtxoForAgora);
        }
        return res;
      };
      return compatPlugin;
    },

    script(type, hash) {
      const scriptApi = chronik.script(type, hash);
      const compatScript = Object.create(scriptApi);
      compatScript.utxos = async () => {
        const res = await scriptApi.utxos();
        if (Array.isArray(res.utxos)) {
          res.utxos = res.utxos.map(patchUtxoForAgora);
        }
        return res;
      };
      return compatScript;
    },
  };
}

function deriveBuyerKey(mnemonic) {
  const seed = mnemonicToSeed(mnemonic);
  const hdRoot = HdNode.fromSeed(seed);
  const childNode = hdRoot.derivePath("m/44'/1899'/0'/0/0");
  const privateKeyBuffer = childNode.seckey();
  const buyerWIF = wif.encode({
    version: 0x80,
    privateKey: Buffer.from(privateKeyBuffer),
    compressed: true
  });
  
  return buyerWIF;
}

const chronikEndpointsAgora = [
  'https://chronik1.alitayin.com',
  'https://chronik-native1.fabien.cash',
  'https://chronik-native2.fabien.cash',
  'https://chronik-native3.fabien.cash',
];
const chronik = new ChronikClient(chronikEndpointsAgora);

async function getUtxos(address) {
  const { type, hash } = decodeCashAddress(address);
  try {
    const utxosResponse = await chronik.script(type, hash).utxos();

    if (!utxosResponse || !utxosResponse.utxos) {
      throw new Error("utxosResponse does not contain utxos property");
    }

    const utxos = utxosResponse.utxos.map((utxo) => {
      const rawSats =
        (typeof utxo.sats !== 'undefined'
          ? utxo.sats
          : typeof utxo.value !== 'undefined'
          ? utxo.value
          : 0);
      const satsBigInt =
        typeof rawSats === 'bigint' ? rawSats : BigInt(rawSats);

      return {
        txid: utxo.outpoint.txid.toLowerCase(),
        vout: utxo.outpoint.outIdx,
        value: Number(satsBigInt),
        address: address,
        slpToken: utxo.token,
        isCoinbase: utxo.isCoinbase || false,
        blockHeight: utxo.blockHeight || -1,
      };
    });
    return utxos;
  } catch (err) {
    console.error('Failed to get UTXOs:', err);
    return [];
  }
}

async function buyTokens(amount, maxPrice, config) {
  try {
    if (!amount || amount <= 0) {
      throw new Error("Amount to buy must be greater than 0");
    }
    if (!maxPrice || maxPrice <= 0) {
      throw new Error("Maximum price must be greater than 0");
    }

    const decimals = config.tokenDecimals || 0;
    const amountWithDecimals = typeof amount === 'number' 
      ? Math.floor(amount * Math.pow(10, decimals)) 
      : Math.floor(parseFloat(amount) * Math.pow(10, decimals));
    
    const amountBigInt = BigInt(amountWithDecimals);
    
    const ecc = new Ecc();
    const agora = new Agora(createAgoraChronik(chronik));
    
    let buyerPrivateKeyWIF;
    if (config.buyerMnemonic) {
      buyerPrivateKeyWIF = deriveBuyerKey(config.buyerMnemonic);
    } else if (config.buyerPrivateKeyWIF) {
      buyerPrivateKeyWIF = config.buyerPrivateKeyWIF;
    } else {
      throw new Error("Neither buyerMnemonic nor buyerPrivateKeyWIF is provided in config");
    }

    const decoded = wif.decode(buyerPrivateKeyWIF);
    const privateKey = decoded.privateKey;
    const privateKeyHex = Buffer.from(privateKey).toString('hex');
    const buyerSk = fromHex(privateKeyHex);
    const buyerPk = ecc.derivePubkey(buyerSk);
    
    const buyerPkh = shaRmd160(buyerPk);
    const buyerP2pkh = Script.p2pkh(buyerPkh);
    
    const tokenId = String(config.tokenId);
    const maxPricePerToken = maxPrice;
    
    const scaledAmount = amountBigInt;

    const offers = await agora.activeOffersByTokenId(tokenId);
    
    let offersWithPrice = offers
      .map(offer => {
        try {
          let totalAtoms;
          let totalSats;

          if (offer.variant.type === 'PARTIAL') {
            const partial = offer.variant.params;
            totalAtoms = partial.offeredAtoms();
            totalSats = partial.askedSats(totalAtoms);
          } else {
            totalAtoms = getTokenAtoms(offer.token);
            totalSats = offer.askedSats();
          }

          const totalTokensWithDecimals =
            Number(totalAtoms) / Math.pow(10, decimals);
          const totalXEC = Number(totalSats) / 100;
          const pricePerToken = totalXEC / totalTokensWithDecimals;

          let adjustedAmount = scaledAmount;
          if (offer.variant.type === 'PARTIAL') {
            adjustedAmount =
              offer.variant.params.prepareAcceptedAtoms(scaledAmount);
          }

          return {
            offer,
            totalSats: Number(totalSats),
            totalXEC,
            pricePerToken,
            tokenAmount: totalTokensWithDecimals,
            adjustedAmount,
          };
        } catch (error) {
          console.error('Failed to build offer price information:', error);
          return null;
        }
      })
      .filter(offer => offer !== null);

    offersWithPrice = offersWithPrice
        .filter(offer => {
            if (maxPricePerToken <= 0) return true;
            const isWithinPriceLimit = offer.pricePerToken <= maxPricePerToken;
            return isWithinPriceLimit;
        })
        .sort((a, b) => a.pricePerToken - b.pricePerToken);

    if (offersWithPrice.length === 0) {
        return {
            success: false,
            reason: 'NO_SUITABLE_OFFERS',
            message: `No offers found below price ${maxPricePerToken} XEC`,
            details: {
                requestedPrice: maxPricePerToken,
                requestedAmount: Number(amountBigInt)
            }
        };
    }

    async function findValidOffer(offersWithPrice, scaledAmount, decimals) {
        for (let i = 0; i < offersWithPrice.length; i++) {
            const currentOffer = offersWithPrice[i];
            
            try {
                const availableAmount = getTokenAtoms(currentOffer.offer.token);

                let adjustedAmount = scaledAmount;
                if (availableAmount < scaledAmount) {
                    adjustedAmount = availableAmount;
                }

                if (currentOffer.offer.variant.type === 'PARTIAL') {
                    const partial = currentOffer.offer.variant.params;

                    const minAcceptedAmount = partial.minAcceptedAtoms();
                    const minAcceptedTokens =
                      Number(minAcceptedAmount) / Math.pow(10, decimals);

                    adjustedAmount = partial.prepareAcceptedAtoms(adjustedAmount);

                    if (adjustedAmount < minAcceptedAmount) {
                        if (i === offersWithPrice.length - 1) {
                            return {
                                success: false,
                                reason: 'AMOUNT_TOO_SMALL',
                                message: `Buy amount cannot be less than minimum accepted amount: ${minAcceptedTokens} tokens`,
                                details: {
                                    minimum: minAcceptedTokens
                                }
                            };
                        }
                        continue;
                    }

                    const remainingTokens = availableAmount - adjustedAmount;
                    if (remainingTokens > 0n && remainingTokens < minAcceptedAmount) {
                        if (i === offersWithPrice.length - 1) {
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
                        continue;
                    }
                } else {
                    if (adjustedAmount !== availableAmount) {
                        continue;
                    }
                }
                
                currentOffer.adjustedAmount = adjustedAmount;
                return currentOffer;
                
            } catch (error) {
                if (i === offersWithPrice.length - 1) {
                    return {
                        success: false,
                        reason: 'NO_VALID_OFFERS',
                        message: 'No valid offers found',
                        details: {
                            error: error.message
                        }
                    };
                }
                continue;
            }
        }
        
        return {
            success: false,
            reason: 'NO_OFFERS_AVAILABLE',
            message: 'No matching offers found',
            details: {
                offersChecked: offersWithPrice.length
            }
        };
    }

    const selectedOffer = await findValidOffer(offersWithPrice, scaledAmount, decimals);
    if (selectedOffer.success === false) {
        return selectedOffer;
    }
    const offer = selectedOffer.offer;
    const askedSats = offer.askedSats(selectedOffer.adjustedAmount);
    
    let truncFactor = 1n;
    let minAcceptedAmount = 0n;
    if (offer.variant.type === 'PARTIAL') {
        const partial = offer.variant.params;
        truncFactor = 1n << BigInt(8 * partial.numAtomsTruncBytes);
        minAcceptedAmount = partial.minAcceptedAtoms();
    }
    
    const actualAmount = Number(selectedOffer.adjustedAmount) / Math.pow(10, decimals);
    
    const buyerAddress = config.buyerAddress;
    const utxos = await getUtxos(buyerAddress);

    let currentBlockHeight = -1;
    try {
      const blockchainInfo = await chronik.blockchainInfo();
      currentBlockHeight = blockchainInfo.tipHeight;
    } catch (err) {
      console.warn('Failed to get blockchain info, cannot verify coinbase UTXO maturity:', err);
    }

    const nonTokenUtxos = utxos.filter(utxo => {
      if (utxo.slpToken) {
        return false;
      }
      
      if (utxo.isCoinbase && currentBlockHeight > 0 && utxo.blockHeight > 0) {
        const confirmations = currentBlockHeight - utxo.blockHeight + 1;
        if (confirmations < 100) {
          return false;
        }
      }
      
      return true;
    });
    
    if (nonTokenUtxos.length === 0) {
      return {
        success: false,
        reason: 'INSUFFICIENT_BALANCE',
        message: "No non-token UTXOs are available for payment (after excluding immature coinbase UTXOs)",
        details: {
          required: 0,
          available: 0,
          missing: 0
        }
      };
    }

    const totalBalance = nonTokenUtxos.reduce(
      (sum, utxo) => sum + BigInt(utxo.value ?? 0),
      0n,
    );
    
    if (totalBalance < askedSats) {
      return {
        success: false,
        reason: 'INSUFFICIENT_BALANCE',
        message: `Insufficient balance: required ${askedSats} sats, but only ${totalBalance} sats available`,
        details: {
          required: askedSats,
          available: totalBalance,
          missing: askedSats - totalBalance,
        }
      };
    }

    // Early return point to confirm prior steps are valid
    
    const covenantSk = new Uint8Array(32);
    window.crypto.getRandomValues(covenantSk);
    const covenantPk = ecc.derivePubkey(covenantSk);

    const fuelInputs = nonTokenUtxos.map(utxo => {
      const sats = BigInt(utxo.value ?? 0);
      return {
        input: {
          prevOut: {
            txid: utxo.txid,
            outIdx: utxo.vout,
          },
          signData: {
            sats,
            outputScript: buyerP2pkh,
          },
        },
        signatory: P2PKHSignatory(buyerSk, buyerPk, ALL_BIP143),
      };
    });

    const recipientScript = Script.p2pkh(buyerPkh);
    
    const acceptFeeSats = selectedOffer.offer.acceptFeeSats({
      recipientScript,
      feePerKb: 1000n,
      acceptedAtoms: selectedOffer.adjustedAmount,
    });

    if (totalBalance < (askedSats + acceptFeeSats)) {
      return {
        success: false,
        reason: 'INSUFFICIENT_BALANCE_WITH_FEE',
        message: `Insufficient balance to cover price and fees: need ${askedSats + acceptFeeSats} sats but only have ${totalBalance} sats`,
        details: {
          required: askedSats + acceptFeeSats,
          available: totalBalance,
          missing: (askedSats + acceptFeeSats) - totalBalance,
          requiredFee: acceptFeeSats
        }
      };
    }
    
    const acceptTx = selectedOffer.offer.acceptTx({
      ecc,
      covenantSk,
      covenantPk,
      fuelInputs,
      recipientScript: buyerP2pkh,
      acceptedAtoms: selectedOffer.adjustedAmount,
      dustSats: 546n,
      feePerKb: 1000n,
      allowUnspendable: true,
    });

    const rawTx = acceptTx.ser();
    const rawTxHex = toHex(rawTx);

    try {
      const broadcastResponse = await chronik.broadcastTx(rawTxHex);
      if (!broadcastResponse) {
        throw new Error("Empty Chronik broadcast response");
      }
      
      const explorerLink = `https://explorer.e.cash/tx/${broadcastResponse.txid}`;
      
      // Shape the success response payload
      const result = {
        success: true,
        reason: 'SUCCESS',
        explorerLink,
        txid: broadcastResponse.txid,
        actualAmount: Number(actualAmount),
        totalXECPaid: Number(askedSats + acceptFeeSats) / 100,
        pricePerToken: Number(selectedOffer.pricePerToken),
        networkFee: Number(acceptFeeSats) / 100
      };
      
      return result;
    } catch (err) {
      console.error("Error broadcasting transaction:", err);
      throw err;
    }

  } catch (error) {
    console.error("Error in buyTokens:", error);

    if (error && typeof error.message === 'string' &&
        error.message.includes('Insufficient input value') &&
        error.message.includes('Can only pay for')) {

      let totalInput = totalBalance;
      let availableFee = 0n;
      let requiredFee = 0n;

      const match = error.message.match(/Insufficient input value \((\d+)\): Can only pay for (\d+) fees, but (\d+) required/);
      if (match) {
        totalInput = BigInt(match[1]);
        availableFee = BigInt(match[2]);
        requiredFee = BigInt(match[3]);
      }

      return {
        success: false,
        reason: 'INSUFFICIENT_BALANCE_WITH_FEE',
        message: `Insufficient balance for network fees: can pay ${availableFee} sats but ${requiredFee} sats are required. Please add more XEC to this address.`,
        details: {
          required: askedSats + requiredFee,
          available: totalBalance,
          missing: (askedSats + requiredFee) - totalBalance,
          requiredFee,
          availableFee,
          totalInput,
        }
      };
    }

    throw error;
  }
}

async function main(config) {
    try {
        if (!config) {
            throw new Error('Configuration parameters are required');
        }

        const result = await buyTokens(config.amount, config.maxPrice, config);
        return result;
    } catch (error) {
        console.error('Buy execution failed:', error);
        throw error;
    }
}

export { main };