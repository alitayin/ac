"use client"
import { createContext, useState, useContext, useEffect, ReactNode, useRef, useCallback, useMemo } from 'react';
import * as ecashLib from 'ecash-lib';
import * as ecashAddrJs from 'ecashaddrjs';
import { disconnectAddress } from '../websocket-client';
import { chronik as sharedChronik } from '../chronik';
import { storageManager } from '../storage-manager';

interface WalletContextType {
  isWalletConnected: boolean;
  ecashAddress: string;
  balance: string;
  userTokens: {[key: string]: string};
  publicKeyHex: string;
  mnemonic: string;
  isGuestMode: boolean;
  connectWallet: (mnemonicPhrase: string) => Promise<boolean>;
  disconnectWallet: () => void;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const deriveWalletIdentity = (mnemonicPhrase: string) => {
  const seed = ecashLib.mnemonicToSeed(mnemonicPhrase);
  const hdRoot = ecashLib.HdNode.fromSeed(seed);
  const childNode = hdRoot.derivePath("m/44'/1899'/0'/0/0");
  const pubkey = childNode.pubkey();
  const pubkeyHash = ecashLib.shaRmd160(pubkey);
  const address = ecashAddrJs.encodeCashAddress('ecash', 'p2pkh', pubkeyHash);

  return {
    address,
    publicKeyHex: bytesToHex(pubkey),
  };
};

export const WalletProvider = ({ children }: WalletProviderProps) => {
  const [isWalletConnected, setIsWalletConnected] = useState<boolean>(false);
  const [ecashAddress, setEcashAddress] = useState<string>('');
  const [balance, setBalance] = useState<string>('0');
  const [userTokens, setUserTokens] = useState<{[key: string]: string}>({});
  const [publicKeyHex, setPublicKeyHex] = useState<string>('');
  const [mnemonic, setMnemonic] = useState<string>('');
  const wordListRef = useRef<string[]>([]);
  const [isGuestMode, setIsGuestMode] = useState<boolean>(false);
  const wsRef = useRef<ReturnType<typeof sharedChronik.ws> | null>(null);
  const subscribedAddressRef = useRef<string>('');
  const wsReconnectTimerRef = useRef<NodeJS.Timeout | null>(null);


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


  const refreshBalance = useCallback(async () => {
    if (ecashAddress) {
      await fetchBalance(ecashAddress);
    }
  }, [ecashAddress]);


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
        if (wsReconnectTimerRef.current) clearTimeout(wsReconnectTimerRef.current);
        wsReconnectTimerRef.current = setTimeout(() => ensureAddressWebSocket(), 1000);
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
    const savedMnemonic = storageManager.get<string>('wallet_mnemonic');
    const savedAddress = storageManager.get<string>('wallet_address');
    const savedIsGuest = storageManager.get<string | boolean>('wallet_is_guest');

    if (savedIsGuest === 'true' || savedIsGuest === true) {
      if (savedAddress) {
        setIsWalletConnected(true);
        setEcashAddress(savedAddress);
        setIsGuestMode(true);
        setMnemonic('');
        setPublicKeyHex('');
      }
      return;
    }

    if (savedMnemonic && savedAddress) {
      fetch('/english.json')
        .then(res => res.json())
        .then(data => {
          wordListRef.current = data.words;
          try {
            ecashLib.mnemonicToEntropy(savedMnemonic.trim(), wordListRef.current);
            const identity = deriveWalletIdentity(savedMnemonic);
            setIsWalletConnected(true);
            setMnemonic(savedMnemonic);
            setEcashAddress(identity.address || savedAddress);
            setPublicKeyHex(identity.publicKeyHex);
            setIsGuestMode(false);
          } catch (error) {
            storageManager.remove('wallet_mnemonic');
            storageManager.remove('wallet_address');
            storageManager.remove('wallet_is_guest');
            setIsWalletConnected(false);
            setMnemonic('');
            setEcashAddress('');
            setPublicKeyHex('');
            setIsGuestMode(false);
          }
        })
        .catch(err => console.error('Failed to load word list:', err));
    } else {
      fetch('/english.json')
        .then(res => res.json())
        .then(data => { wordListRef.current = data.words; })
        .catch(err => console.error('Failed to load word list:', err));
    }
  }, []);

  useEffect(() => {
    if (isWalletConnected && ecashAddress) {
      fetchBalance(ecashAddress);
      subscribeToAddress(ecashAddress);
    }

    return () => {
      if (wsReconnectTimerRef.current) clearTimeout(wsReconnectTimerRef.current);
      subscribedAddressRef.current = '';
      wsRef.current?.close?.();
      wsRef.current = null;
    };
  }, [isWalletConnected, ecashAddress]);

  const connectWallet = async (mnemonicPhrase: string): Promise<boolean> => {
    try {
      if (!wordListRef.current.length) {
        throw new Error('Word list not loaded');
      }

      ecashLib.mnemonicToEntropy(mnemonicPhrase.trim(), wordListRef.current);

      const identity = deriveWalletIdentity(mnemonicPhrase);

      storageManager.remove('wallet_is_guest');

      storageManager.set('wallet_mnemonic', mnemonicPhrase);
      storageManager.set('wallet_address', identity.address);

      setIsWalletConnected(true);
      setMnemonic(mnemonicPhrase);
      setEcashAddress(identity.address);
      setPublicKeyHex(identity.publicKeyHex);
      setIsGuestMode(false);

      return true;
    } catch (error) {
      console.error('Error generating address:', error);
      return false;
    }
  };

  const disconnectWallet = () => {

    if (ecashAddress) {
      disconnectAddress(ecashAddress);
    }


    storageManager.remove('wallet_mnemonic');
    storageManager.remove('wallet_address');
    storageManager.remove('wallet_is_guest');


    setIsWalletConnected(false);
    setMnemonic('');
    setEcashAddress('');
    setBalance('0');
    setUserTokens({});
    setPublicKeyHex('');
    setIsGuestMode(false);
  };

  const contextValue = useMemo(() => ({
    isWalletConnected,
    ecashAddress,
    balance,
    userTokens,
    publicKeyHex,
    mnemonic,
    isGuestMode,
    connectWallet,
    disconnectWallet,
    refreshBalance
  }), [isWalletConnected, ecashAddress, balance, userTokens, publicKeyHex, mnemonic, isGuestMode, connectWallet, disconnectWallet, refreshBalance]);

  return (
    <WalletContext.Provider value={contextValue}>
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
