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

function compareMakerPk(makerPk1, makerPk2) {
  if (!makerPk1 || !makerPk2) return false;
  
  if (Object.keys(makerPk1).length !== 33 || Object.keys(makerPk2).length !== 33) {
    return false;
  }
  
  for (let i = 0; i < 33; i++) {
    if (makerPk1[i] !== makerPk2[i]) {
      return false;
    }
  }
  
  return true;
}

function makerPkToHex(makerPk) {
  if (!makerPk) return '';
  
  const bytes = [];
  for (let i = 0; i < 33; i++) {
    bytes.push(makerPk[i]);
  }
  
  return Buffer.from(bytes).toString('hex');
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

const chronikEndpointsAgora = [
  'https://chronik1.alitayin.com',
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
    console.error(`Failed to get UTXOs:`, err);
    return [];
  }
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
    
    const offers = await agora.activeOffersByTokenId(tokenId);
    const targetMakerPk = {
      "0": 3,
      "1": 132,
      "2": 79,
      "3": 146,
      "4": 55,
      "5": 33,
      "6": 23,
      "7": 163,
      "8": 89,
      "9": 167,
      "10": 237,
      "11": 21,
      "12": 212,
      "13": 186,
      "14": 63,
      "15": 226,
      "16": 3,
      "17": 125,
      "18": 202,
      "19": 108,
      "20": 224,
      "21": 125,
      "22": 131,
      "23": 44,
      "24": 53,
      "25": 176,
      "26": 30,
      "27": 34,
      "28": 23,
      "29": 137,
      "30": 131,
      "31": 241,
      "32": 69
    };
    
    const filteredOffers = offers.filter(offer => {
      if (offer.variant && offer.variant.params && offer.variant.params.makerPk) {
        const matches = compareMakerPk(offer.variant.params.makerPk, targetMakerPk);
        return matches;
      }
      return false;
    });
    
    if (filteredOffers.length === 0) {
      return {
        success: false,
        reason: 'NO_TARGET_OFFERS',
        message: `No orders found from target address`,
        details: {
          totalOffers: offers.length,
          targetMakerPk: makerPkToHex(targetMakerPk)
        }
      };
    }
    
    let offersWithPrice = filteredOffers.map(offer => {
      try {
        const totalTokens = BigInt(offer.token.amount);
        const totalSats = offer.variant.type === 'PARTIAL' ? 
          offer.askedSats(totalTokens) : 
          offer.askedSats();
        
        const totalTokensWithDecimals = Number(totalTokens) / Math.pow(10, decimals);
        const totalXEC = Number(totalSats) / 100;
        const pricePerToken = totalXEC / totalTokensWithDecimals;
        
        let adjustedAmount = amountBigInt;
        if (offer.variant.type === 'PARTIAL') {
          adjustedAmount = offer.variant.params.prepareAcceptedTokens(amountBigInt);
        }
        
        return {
          offer,
          totalSats: Number(totalSats),
          totalXEC,
          pricePerToken,
          tokenAmount: totalTokensWithDecimals,
          adjustedAmount
        };
      } catch (error) {
        return null;
      }
    }).filter(offer => offer !== null);

    offersWithPrice = offersWithPrice
        .filter(offer => {
            if (maxPricePerToken <= 0) return true;
            return offer.pricePerToken <= maxPricePerToken;
        })
        .sort((a, b) => a.pricePerToken - b.pricePerToken);

    if (offersWithPrice.length === 0) {
        return {
            success: false,
            reason: 'NO_SUITABLE_OFFERS',
            message: `No orders found with price below ${maxPricePerToken} XEC`,
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
                const availableAmount = BigInt(currentOffer.offer.token.amount);

                let adjustedAmount = scaledAmount;
                if (availableAmount < scaledAmount) {
                    adjustedAmount = availableAmount;
                }

                if (currentOffer.offer.variant.type === 'PARTIAL') {
                    const numTokenTruncBytes = currentOffer.offer.variant.params.numTokenTruncBytes;
                    const truncFactor = 1n << BigInt(8 * numTokenTruncBytes);
                    
                    const minAcceptedScaledTruncTokens = currentOffer.offer.variant.params.minAcceptedScaledTruncTokens;
                    const tokenScaleFactor = currentOffer.offer.variant.params.tokenScaleFactor;
                    
                    const minAcceptedAmount = (BigInt(minAcceptedScaledTruncTokens) * truncFactor) / BigInt(tokenScaleFactor);
                    const minAcceptedTokens = Number(minAcceptedAmount) / Math.pow(10, decimals);

                    adjustedAmount = (adjustedAmount / truncFactor) * truncFactor;

                    if (adjustedAmount < minAcceptedAmount) {
                        if (i === offersWithPrice.length - 1) {
                            return {
                                success: false,
                                reason: 'AMOUNT_TOO_SMALL',
                                message: `Purchase amount cannot be less than minimum accepted amount: ${minAcceptedTokens} tokens`,
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
                        message: 'No valid orders found',
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
            message: 'No valid orders found',
            details: {
                offersChecked: offersWithPrice.length
            }
        };
    }

    const selectedOffer = await findValidOffer(offersWithPrice, amountBigInt, decimals);
    if (selectedOffer.success === false) {
        return selectedOffer;
    }
    
    const offer = selectedOffer.offer;
    const askedSats = offer.askedSats(selectedOffer.adjustedAmount);
    
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
      throw new Error("No available non-token UTXOs for payment (after filtering immature coinbase UTXOs)");
    }

    const totalBalance = nonTokenUtxos.reduce((sum, utxo) => sum + utxo.value, 0);
    
    if (totalBalance < askedSats) {
        return {
            success: false,
            reason: 'INSUFFICIENT_BALANCE',
            message: `Insufficient balance, need ${askedSats} sats, but only have ${totalBalance} sats`,
            details: {
                required: askedSats,
                available: totalBalance,
                missing: askedSats - totalBalance
            }
        };
    }
    
    const covenantSk = new Uint8Array(32);
    window.crypto.getRandomValues(covenantSk);
    const covenantPk = ecc.derivePubkey(covenantSk);

    const fuelInputs = nonTokenUtxos.map(utxo => {
      return {
        input: {
          prevOut: {
            txid: utxo.txid,
            outIdx: utxo.vout
          },
          signData: {
            value: utxo.value,
            outputScript: buyerP2pkh,
          },
        },
        signatory: P2PKHSignatory(buyerSk, buyerPk, ALL_BIP143)
      };
    });

    const recipientScript = Script.p2pkh(buyerPkh);
    
    const acceptFeeSats = selectedOffer.offer.acceptFeeSats({
      recipientScript,
      feePerKb: 1000,
      acceptedTokens: selectedOffer.adjustedAmount
    });

    if (totalBalance < (askedSats + acceptFeeSats)) {
      return {
        success: false,
        reason: 'INSUFFICIENT_BALANCE_WITH_FEE',
        message: `Insufficient balance to pay fees, need ${askedSats + acceptFeeSats} sats, but only have ${totalBalance} sats`,
        details: {
          required: askedSats + acceptFeeSats,
          available: totalBalance,
          missing: (askedSats + acceptFeeSats) - totalBalance
        }
      };
    }
    
    const acceptTx = selectedOffer.offer.acceptTx({
      ecc,
      covenantSk,
      covenantPk,
      fuelInputs,
      recipientScript: buyerP2pkh,
      acceptedTokens: selectedOffer.adjustedAmount,
      dustAmount: 546,
      feePerKb: 1000,
      allowUnspendable: true
    });

     const rawTx = acceptTx.ser();
     const rawTxHex = toHex(rawTx);
    
    const selectedUtxos = fuelInputs.map(fuelInput => ({
      txid: fuelInput.input.prevOut.txid,
      vout: fuelInput.input.prevOut.outIdx,
      value: fuelInput.input.signData.value,
      address: buyerAddress
    }));

    const result = {
      success: true,
      reason: 'TRANSACTION_CREATED',
      rawTxHex: rawTxHex,
      actualAmount: Number(actualAmount),
      totalXECPaid: Number(askedSats + acceptFeeSats) / 100,
      pricePerToken: Number(selectedOffer.pricePerToken),
      networkFee: Number(acceptFeeSats) / 100,
      selectedUtxos: selectedUtxos,
      message: 'Transaction created but not broadcast, please check console for raw transaction data'
    };
    
    return result;

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