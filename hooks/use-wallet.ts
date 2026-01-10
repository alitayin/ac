import { useState, useEffect } from "react";
import * as ecashLib from 'ecash-lib';
import * as ecashAddrJs from 'ecashaddrjs';

export function useWallet() {
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [mnemonic, setMnemonic] = useState('');
  const [mnemonicWords, setMnemonicWords] = useState<string[]>(new Array(12).fill(''));
  const [mnemonicError, setMnemonicError] = useState('');
  const [ecashAddress, setEcashAddress] = useState('');
  const [wordList, setWordList] = useState<string[]>([]);

  useEffect(() => {
    fetch('/english.json')
      .then(res => res.json())
      .then(data => setWordList(data.words))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const savedMnemonic = localStorage.getItem('wallet_mnemonic');
    const savedAddress = localStorage.getItem('wallet_address');
    if (savedMnemonic && savedAddress && wordList.length > 0) {
      try {
        ecashLib.mnemonicToEntropy(savedMnemonic.trim(), wordList);
        setIsWalletConnected(true);
        setMnemonic(savedMnemonic);
        setEcashAddress(savedAddress);
        setMnemonicWords(savedMnemonic.split(' '));
      } catch {
        localStorage.removeItem('wallet_mnemonic');
        localStorage.removeItem('wallet_address');
        setIsWalletConnected(false);
        setMnemonic('');
        setEcashAddress('');
        setMnemonicWords(new Array(12).fill(''));
      }
    }
  }, [wordList]);

  // Save mnemonic and derive address
  const saveMnemonic = () => {
    try {
      const fullMnemonic = mnemonicWords.join(' ').trim();
      ecashLib.mnemonicToEntropy(fullMnemonic, wordList);
      const seed = ecashLib.mnemonicToSeed(fullMnemonic);
      const hdRoot = ecashLib.HdNode.fromSeed(seed);
      const childNode = hdRoot.derivePath("m/44'/1899'/0'/0/0");
      const pubkey = childNode.pubkey();
      const pubkeyHash = ecashLib.shaRmd160(pubkey);
      const address = ecashAddrJs.encodeCashAddress('ecash', 'p2pkh', pubkeyHash);

      localStorage.setItem('wallet_mnemonic', fullMnemonic);
      localStorage.setItem('wallet_address', address);
      setIsWalletConnected(true);
      setMnemonicError('');
      setMnemonic(fullMnemonic);
      setEcashAddress(address);
      setMnemonicWords(fullMnemonic.split(' '));
    } catch (error) {
      setMnemonicError('Invalid recovery phrase. Please check your input.');
    }
  };

  const resetWallet = () => {
    localStorage.removeItem('wallet_mnemonic');
    localStorage.removeItem('wallet_address');
    setIsWalletConnected(false);
    setMnemonic('');
    setEcashAddress('');
    setMnemonicWords(new Array(12).fill(''));
    setMnemonicError('');
  };

  return {
    isWalletConnected,
    setIsWalletConnected,
    mnemonic,
    setMnemonic,
    mnemonicWords,
    setMnemonicWords,
    mnemonicError,
    setMnemonicError,
    ecashAddress,
    setEcashAddress,
    wordList,
    saveMnemonic,
    resetWallet,
  };
} 