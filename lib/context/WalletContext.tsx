"use client"
import { createContext, useState, useContext, useEffect, ReactNode, useRef } from 'react';
import * as ecashLib from 'ecash-lib';
import * as ecashAddrJs from 'ecashaddrjs';
import { disconnectAddress } from '../websocket-client';
import { CashtabConnect } from 'cashtab-connect';
import { chronik as sharedChronik } from '../chronik';

interface WalletContextType {
  isWalletConnected: boolean;
  ecashAddress: string;
  balance: string;
  userTokens: {[key: string]: string};
  mnemonic: string;
  isGuestMode: boolean;
  connectWallet: (mnemonicPhrase: string) => Promise<boolean>;
  connectWithCashtab: () => Promise<boolean>;
  disconnectWallet: () => void;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider = ({ children }: WalletProviderProps) => {
  const [isWalletConnected, setIsWalletConnected] = useState<boolean>(false);
  const [ecashAddress, setEcashAddress] = useState<string>('');
  const [balance, setBalance] = useState<string>('0');
  const [userTokens, setUserTokens] = useState<{[key: string]: string}>({});
  const [mnemonic, setMnemonic] = useState<string>('');
  const [wordList, setWordList] = useState<string[]>([]);
  const [isGuestMode, setIsGuestMode] = useState<boolean>(false);
  const wsRef = useRef<ReturnType<typeof sharedChronik.ws> | null>(null);
  const subscribedAddressRef = useRef<string>('');


  const fetchBalance = async (address: string) => {
    try {
      const response = await sharedChronik.address(address).utxos();
      
      const totalBalanceSats = response.utxos
        .filter((utxo: any) => !utxo.token)
        .reduce((acc: bigint, utxo: any) => {
          const rawSats =
            (typeof utxo.sats !== 'undefined'
              ? utxo.sats
              : typeof utxo.value !== 'undefined'
              ? utxo.value
              : 0);
          const sats =
            typeof rawSats === 'bigint' ? rawSats : BigInt(rawSats);
          return acc + sats;
        }, 0n);
      
      setBalance((Number(totalBalanceSats) / 100).toFixed(2));

      const tokenBalances: {[key: string]: string} = {};
      response.utxos.forEach(utxo => {
        if (utxo.token) {
          const tokenId = utxo.token.tokenId;
          const tokenAny: any = utxo.token as any;
          const rawAtoms =
            (typeof tokenAny.atoms !== 'undefined'
              ? tokenAny.atoms
              : typeof tokenAny.amount !== 'undefined'
              ? tokenAny.amount
              : 0);
          const atoms =
            typeof rawAtoms === 'bigint' ? rawAtoms : BigInt(rawAtoms);
          const prev = BigInt(tokenBalances[tokenId] || '0');
          tokenBalances[tokenId] = (prev + atoms).toString();
        }
      });
      
      setUserTokens(tokenBalances);
      
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      setBalance('0');
      setUserTokens({});
    }
  };


  const refreshBalance = async () => {
    if (ecashAddress) {
      await fetchBalance(ecashAddress);
    }
  };


  const ensureAddressWebSocket = () => {
    if (typeof window === 'undefined') return;
    if (wsRef.current) return;

    wsRef.current = sharedChronik.ws({
      onMessage: (msg) => {
        const msgType = (msg as any)?.msgType;
  
        if (msgType === 'TX_FINALIZED' && subscribedAddressRef.current) {
          fetchBalance(subscribedAddressRef.current);
        }
      },
      onError: (err) => {
        console.error('Chronik address websocket error:', err);
      },
      onEnd: () => {
        wsRef.current = null;
        subscribedAddressRef.current = '';
    
        setTimeout(() => ensureAddressWebSocket(), 1000);
      },
    });

    wsRef.current.waitForOpen?.().catch(() => {
      wsRef.current = null;
      subscribedAddressRef.current = '';
    });
  };

  const subscribeToAddress = (address: string) => {
    if (!address) return;
    ensureAddressWebSocket();
    if (!wsRef.current) return;
    if (subscribedAddressRef.current === address) return;

    try {
      wsRef.current.subscribeToAddress(address);
      subscribedAddressRef.current = address;
    } catch (error) {
      console.error('Failed to subscribe to address:', error);
    }
  };

  
  useEffect(() => {
    fetch('/english.json')
      .then(res => res.json())
      .then(data => setWordList(data.words))
      .catch(err => console.error('Failed to load word list:', err));
  }, []);

  
  useEffect(() => {
    const savedMnemonic = localStorage.getItem('wallet_mnemonic');
    const savedAddress = localStorage.getItem('wallet_address');
    const savedIsGuest = localStorage.getItem('wallet_is_guest');
    
  
    if (savedIsGuest === 'true' && savedAddress) {
      setIsWalletConnected(true);
      setEcashAddress(savedAddress);
      setIsGuestMode(true);
      setMnemonic('');
    } else if (savedMnemonic && savedAddress && wordList.length > 0) {
  
      try {
        ecashLib.mnemonicToEntropy(savedMnemonic.trim(), wordList);
        setIsWalletConnected(true);
        setMnemonic(savedMnemonic);
        setEcashAddress(savedAddress);
        setIsGuestMode(false);
      } catch (error) {
        localStorage.removeItem('wallet_mnemonic');
        localStorage.removeItem('wallet_address');
        localStorage.removeItem('wallet_is_guest');
        setIsWalletConnected(false);
        setMnemonic('');
        setEcashAddress('');
        setIsGuestMode(false);
      }
    }
  }, [wordList]);

  useEffect(() => {
    if (isWalletConnected && ecashAddress) {
      fetchBalance(ecashAddress);
      subscribeToAddress(ecashAddress);
    }

    return () => {

      subscribedAddressRef.current = '';
      wsRef.current?.close?.();
      wsRef.current = null;
    };
  }, [isWalletConnected, ecashAddress]);

  const connectWallet = async (mnemonicPhrase: string): Promise<boolean> => {
    try {
      if (!wordList.length) {
        throw new Error('Word list not loaded');
      }

      ecashLib.mnemonicToEntropy(mnemonicPhrase.trim(), wordList);
      
      const seed = ecashLib.mnemonicToSeed(mnemonicPhrase);
      const hdRoot = ecashLib.HdNode.fromSeed(seed);
      
      const childNode = hdRoot.derivePath("m/44'/1899'/0'/0/0");
      
      const pubkey = childNode.pubkey();
      const pubkeyHash = ecashLib.shaRmd160(pubkey);
      const address = ecashAddrJs.encodeCashAddress('ecash', 'p2pkh', pubkeyHash);
      
      localStorage.removeItem('wallet_is_guest');
      
      localStorage.setItem('wallet_mnemonic', mnemonicPhrase);
      localStorage.setItem('wallet_address', address);
      
      setIsWalletConnected(true);
      setMnemonic(mnemonicPhrase);
      setEcashAddress(address);
      setIsGuestMode(false);
      
      return true;
    } catch (error) {
      console.error('Error generating address:', error);
      return false;
    }
  };


  const connectWithCashtab = async (): Promise<boolean> => {
    try {
      const cashtab = new CashtabConnect();
      
      
      await cashtab.waitForExtension(5000);
      
   
      const address = await cashtab.requestAddress();
      
      if (!address) {
        throw new Error('Failed to obtain Cashtab address');
      }
      
  
      localStorage.setItem('wallet_address', address);
      localStorage.setItem('wallet_is_guest', 'true');
      localStorage.removeItem('wallet_mnemonic');
      
      setIsWalletConnected(true);
      setEcashAddress(address);
      setIsGuestMode(true);
      setMnemonic('');
      
      return true;
    } catch (error) {
      console.error('Cashtab connection failed:', error);
      return false;
    }
  };

 
  const disconnectWallet = () => {

    if (ecashAddress) {
      disconnectAddress(ecashAddress);
    }
    

    localStorage.removeItem('wallet_mnemonic');
    localStorage.removeItem('wallet_address');
    localStorage.removeItem('wallet_is_guest');
    

    setIsWalletConnected(false);
    setMnemonic('');
    setEcashAddress('');
    setBalance('0');
    setUserTokens({});
    setIsGuestMode(false);
  };

  return (
    <WalletContext.Provider value={{
      isWalletConnected,
      ecashAddress,
      balance,
      userTokens,
      mnemonic,
      isGuestMode,
      connectWallet,
      connectWithCashtab,
      disconnectWallet,
      refreshBalance
    }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};