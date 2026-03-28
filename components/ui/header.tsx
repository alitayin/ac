"use client";

import type React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Moon,
  Sun,
  Power,
  CircleEllipsis,
  Wallet,
  ArrowLeftRight
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useRouter, usePathname } from "next/navigation";
import { tokens } from "@/config/tokens";
import Image from "next/image";
import { ConfettiButton } from "@/components/magicui/confetti";
import confetti from "canvas-confetti";
import { BorderBeam } from "@/components/magicui/border-beam";
import * as bip39 from "bip39";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Card, CardContent } from "@/components/ui/card";
import { FlickeringGrid } from "@/components/magicui/flickering-grid";
import { processOrders } from '@/lib/Auto.js';
import { useOrderProcessing } from "@/lib/context/OrderProcessingContext";
import { useWebSocketStatus } from "@/lib/context/WebSocketContext";
import { useWallet } from "@/lib/context/WalletContext";
import { useXECPrice } from "@/lib/price";
import appVersion from "@/version.json";
import { fetchTokenDetails, getTokenDecimalsFromDetails } from "@/lib/chronik";
import { watchOrderTokens } from "@/lib/swap-ws";
import { WalletConnectDrawerInner } from "@/components/swap/WalletConnectDrawerInner";

interface HeaderProps {
  isOnline?: boolean;
}


export default function Header({ 
  isOnline
}: HeaderProps) {
  const { 
    isWalletConnected, 
    ecashAddress, 
    balance, 
    userTokens, 
    disconnectWallet,
    connectWallet,
    connectWithCashtab
  } = useWallet();

  const xecPrice = useXECPrice();
  const { setTheme, theme, resolvedTheme } = useTheme();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [currentTheme, setCurrentTheme] = useState<string>("dark");
  const [tokenDetails, setTokenDetails] = useState<{[key: string]: any}>({});
  const tokenDetailsRef = useRef<{[key: string]: any}>({});
  const { isAutoProcessing, setIsAutoProcessing } = useOrderProcessing();
  const { isNotifying } = useWebSocketStatus();
  const [isLoginDrawerOpen, setIsLoginDrawerOpen] = useState(false);
  const [mnemonicWords, setMnemonicWords] = useState<string[]>(new Array(12).fill(""));
  const [mnemonicError, setMnemonicError] = useState<string>("");

  useEffect(() => {
    if (resolvedTheme) {
      setCurrentTheme(resolvedTheme);
    }
  }, [resolvedTheme]);

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, index: number) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const words = pastedText.trim().split(/\s+/);
    
    if (words.length === 12) {
      setMnemonicWords(words);
    } else {
      const newWords = [...mnemonicWords];
      newWords[index] = words[0].toLowerCase();
      setMnemonicWords(newWords);
    }
  };

  const handleGenerateMnemonic = () => {
    try {
      const generatedMnemonic = bip39.generateMnemonic();
      const words = generatedMnemonic.trim().split(/\s+/);
      setMnemonicWords(new Array(12).fill('').map((_, i) => words[i] || ''));
      setMnemonicError('');
    } catch (error) {
      toast({
        title: "Failed to generate recovery phrase",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleSaveMnemonic = async () => {
    const fullMnemonic = mnemonicWords.join(' ').trim();
    const success = await connectWallet(fullMnemonic);
    
    if (success) {
      setMnemonicError('');
      setIsLoginDrawerOpen(false);
      toast({
        title: "Wallet Connected Successfully",
        description: "Your wallet has been successfully connected",
      });
    } else {
      setMnemonicError('Invalid recovery phrase. Please check your input.');
    }
  };

  const handleConnectCashtab = async () => {
    try {
      const success = await connectWithCashtab();
      if (success) {
        setIsLoginDrawerOpen(false);
        toast({
          title: "Cashtab Connected Successfully",
          description: "You are in guest mode. You can view balances but cannot create orders",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: "Unable to connect to Cashtab extension. Please make sure it is installed",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };
  
  useEffect(() => {
    if (!isWalletConnected || Object.keys(userTokens).length === 0) return;
    
    const loadCachedDetails = () => {
      try {
        const cacheStr = localStorage.getItem('token_details_cache');
        if (!cacheStr) return;
        
        const cache = JSON.parse(cacheStr);
        const cachedDetails: {[key: string]: any} = {};
        Object.keys(userTokens).forEach(tokenId => {
          if (cache[tokenId]) {
            cachedDetails[tokenId] = cache[tokenId];
          }
        });
        
        if (Object.keys(cachedDetails).length > 0) {
          setTokenDetails(cachedDetails);
        }
      } catch (error) {
        console.error('Failed to load token details cache:', error);
      }
    };
    
    loadCachedDetails();
  }, [isWalletConnected, userTokens]);
  
  
  useEffect(() => {
    tokenDetailsRef.current = tokenDetails;
  }, [tokenDetails]);
  
  
  useEffect(() => {
    const loadTokenDetails = async () => {
      if (!isWalletConnected || Object.keys(userTokens).length === 0) return;

      for (const tokenId of Object.keys(userTokens)) {

        if (tokenDetailsRef.current[tokenId]) continue;

        try {
       
          const tokenData = await fetchTokenDetails(tokenId);
          if (tokenData) {
            setTokenDetails(prev => ({
              ...prev,
              [tokenId]: tokenData,
            }));
          }
        } catch (error) {
          console.error(`Failed to fetch token details: ${tokenId}`, error);
        }
      }
    };

    loadTokenDetails();

  }, [isWalletConnected, userTokens]);

  
  const hasActiveOrders = () => {
    const orders = JSON.parse(localStorage.getItem('swap_orders') || '{}');
    if (!isWalletConnected || !ecashAddress) return false;

    return Object.keys(orders).some(orderKey => {
      const [tokenId, address] = orderKey.split('|');
      return address === ecashAddress;
    });
  };


  const handleProcessOrders = async () => {
    try {
      await processOrders();
   
    } catch (error) {
      console.error('Failed to process orders:', error);
    }
  };


  useEffect(() => {

    if (!isAutoProcessing || !isWalletConnected || !hasActiveOrders()) {
      return;
    }


    const getOrderTokenIds = (): string[] => {
      const orders = JSON.parse(localStorage.getItem('swap_orders') || '{}');
      const tokenIds = new Set<string>();
      
      Object.keys(orders).forEach(orderKey => {
        const [tokenId, address] = orderKey.split('|');
        if (address === ecashAddress) {
          tokenIds.add(tokenId);
        }
      });
      
      return Array.from(tokenIds);
    };

    const tokenIds = getOrderTokenIds();
    
    if (tokenIds.length === 0) {
      setIsAutoProcessing(false);
      localStorage.setItem('auto_processing', 'false');
      return;
    }



    handleProcessOrders();


    const cleanup = watchOrderTokens(tokenIds, () => {
      if (!hasActiveOrders()) {
        setIsAutoProcessing(false);
        localStorage.setItem('auto_processing', 'false');
        return;
      }
      handleProcessOrders();
    });
    

    return cleanup;
  }, [isAutoProcessing, isWalletConnected, ecashAddress]);


  useEffect(() => {
    if (isWalletConnected) {
      const savedAutoProcessing = localStorage.getItem('auto_processing');
      
      if (savedAutoProcessing === 'true' && hasActiveOrders()) {
        setIsAutoProcessing(true);
      } else if (!hasActiveOrders()) {
        setIsAutoProcessing(false);
        localStorage.setItem('auto_processing', 'false');
      }
    }
  }, [isWalletConnected, ecashAddress]);

  useEffect(() => {

    const TWELVE_HOURS = 12 * 60 * 60 * 1000;
    
    const refreshTimer = setTimeout(() => {
      window.location.reload();
    }, TWELVE_HOURS);
    

    return () => {
      clearTimeout(refreshTimer);
    };
  }, []); 


  const formatTokenAmount = (amount: string, decimals: number = 0): string => {
    try {
      const bigAmount = BigInt(amount);
      const divisor = BigInt(10 ** decimals);
      const integerPart = bigAmount / divisor;
      const fractionalPart = bigAmount % divisor;
      
      if (fractionalPart === BigInt(0)) {
        return integerPart.toString();
      }
      

      let fractionalStr = fractionalPart.toString().padStart(decimals, '0');

      fractionalStr = fractionalStr.replace(/0+$/, '');
      
      if (fractionalStr.length === 0) {
        return integerPart.toString();
      }
      
      return `${integerPart}.${fractionalStr}`;
    } catch (error) {
      console.error('Error formatting token amount:', error);
      return amount;
    }
  };

  const calculateUsdValue = () => {
    if (!balance || !xecPrice) return '0.00';
    const balanceNum = parseFloat(balance);
    return (balanceNum * xecPrice).toFixed(2);
  };

  const runConfetti = useCallback(() => {
    const end = Date.now() + 3 * 1000; // 3 seconds
    const colors = ["#a786ff", "#fd8bbc", "#eca184", "#f8deb1"];

    const frame = () => {
      if (Date.now() > end) return;

      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        startVelocity: 60,
        origin: { x: 0, y: 0.5 },
        colors: colors,
      });
      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        startVelocity: 60,
        origin: { x: 1, y: 0.5 },
        colors: colors,
      });

      requestAnimationFrame(frame);
    };

    frame();
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 dark:border-border">
      <nav className="container mx-auto px-4 flex h-14 max-w-6xl items-center">
        {/* Left section */}
        <div className="flex-1 flex items-center gap-2">
          <Link href="/" className="text-lg font-bold logo hover:opacity-80">
            <span className="hidden sm:inline">
              <Image
                src={`/Agora.cash-${currentTheme}-mode.svg`}
                alt="Agora.cash"
                width={120}
                height={24}
                className="object-contain"
                priority
              />
            </span>
            <span className="sm:hidden w-[48px] flex items-center">
              <Image
                src={`/logo-mobile-${currentTheme}mode.svg`}
                alt="SC"
                width={36}
                height={36}
                className="object-contain w-full h-full"
                priority
              />
            </span>
          </Link>
          <ConfettiButton
            onClick={runConfetti}
            className="hidden sm:inline rounded bg-blue-100 px-2 py-0 h-6 shadow-none text-xs font-medium text-blue-600"
          >
            <span>{appVersion.version}</span>
          </ConfettiButton>
        </div>

        <div className="flex-1 flex justify-center">
          <Link href="/swap">
            <div className="relative cursor-pointer group">
              <div className="relative flex items-center sm:gap-2 gap-0 sm:px-4 px-2 sm:py-2 py-1 rounded-lg bg-background border border-input hover:bg-accent hover:text-accent-foreground transition-colors">
                <ArrowLeftRight className="h-4 w-4" />
                <span className="text-sm">Swap</span>
                <BorderBeam
                  duration={6}
                  size={50}
                  className="from-transparent via-pink-300 to-transparent"
                />
                <BorderBeam
                  duration={6}
                  delay={3}
                  size={50}
                  className="from-transparent via-blue-500 to-transparent"
                />
              </div>
            </div>
          </Link>
        </div>

        {/* Right section */}
        <div className="flex-1 flex items-center justify-end sm:gap-2 gap-0">
          <div className="flex items-center sm:gap-2 gap-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <CircleEllipsis className="h-[1.2rem] w-[1.2rem]" />
                  <span className="sr-only">More</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/list" className="w-full">
                    List My eToken
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/about" className="w-full">
                    About
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="sr-only">Theme</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  System
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {isWalletConnected && (
              <Drawer>
                <DrawerTrigger asChild>
                  <Button 
                    variant="default" 
                    className="rounded-full bg-muted text-mute-foreground hover:bg-primary/90 ml-2"
                  >
                    <div className="flex items-center gap-1 w-full justify-between">
                      <span className="text-sm block text-center whitespace-nowrap flex-1">
                        {ecashAddress ? 
                          `${ecashAddress.substring(ecashAddress.length - 6)}` : 
                          'Unknown'}
                      </span>
                      <span 
                        className={`h-2 w-2 rounded-full flex-shrink-0 ${isNotifying && isAutoProcessing ? 'bg-green-500' : 'bg-gray-400'}`} 
                        title={isNotifying && isAutoProcessing ? "Auto Processing Online" : "Auto Processing Offline"}
                      ></span>
                    </div>
                  </Button>
                </DrawerTrigger>
                <DrawerContent>
                  <div className="mx-auto w-full max-w-md">
                    <DrawerHeader>
                      <DrawerTitle>Wallet Details</DrawerTitle>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center">
                          <Avatar className="h-8 w-8 mr-2 border-2 border-pink-200 bg-primary dark:border-white">
                            <AvatarImage src={`https://api.dicebear.com/9.x/micah/svg?seed=${ecashAddress || 'unknown'}`} />
                            <AvatarFallback>XEC</AvatarFallback>
                          </Avatar>
                          <span 
                            className="select-text text-lg cursor-pointer hover:text-primary transition-colors"
                            onClick={() => {
                              if (ecashAddress) {
                                navigator.clipboard.writeText(ecashAddress);
                                toast({
                                  title: "✅ Address Copied",
                                  description: "Wallet address has been copied to clipboard",
                                });
                              }
                            }}
                            title="Click to copy full address"
                          >
                            {ecashAddress ? 
                              `${ecashAddress.substring(ecashAddress.length - 5)}` : 
                              'Address Unknown'}
                          </span>
                        </div>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={disconnectWallet}
                          className="px-2"
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                      </div>
                    </DrawerHeader>
                    <div className="p-4 space-y-4">
                      <Card className="overflow-hidden border-none shadow-none">
                        <div className="relative">
                          <FlickeringGrid
                            className="absolute inset-0 z-0 size-full"
                            squareSize={4}
                            gridGap={6}
                            color="#6B7280"
                            maxOpacity={0.3}
                            flickerChance={0.1}
                            height={100}
                            width={440}
                          />
                          <CardContent className="p-4 relative z-10 shadow-none">
                            <div className="flex items-center justify-between">
                              <div className="text-lg font-bold select-text">{balance} XEC</div>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              ${calculateUsdValue()} USD
                            </div>
                          </CardContent>
                        </div>
                      </Card>
                      
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium text-muted-foreground">eTokens</h3>
                        <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
                          {Object.keys(userTokens).length > 0 ? (
                            Object.entries(userTokens).map(([tokenId, amount]) => {
                              const tokenInfo = tokens[tokenId as keyof typeof tokens];
                              const tokenDetail = tokenDetails[tokenId];
                              
                              // Prefer API info, fallback to local config
                              const tokenName = tokenDetail?.genesisInfo?.tokenName || tokenInfo?.name || 'Unknown Token';
                              const tokenSymbol = tokenDetail?.genesisInfo?.tokenTicker || tokenInfo?.symbol || '???';
                              const tokenDecimals = getTokenDecimalsFromDetails(
                                tokenDetail,
                                tokenInfo?.decimals || 0,
                              );
                              const tokenUrl = tokenDetail?.genesisInfo?.url || '';
                              
                              return (
                                <Card 
                                  key={tokenId} 
                                  className="overflow-hidden shadow-none hover:bg-muted/30 hover:shadow-md transition-all duration-200"
                                >
                                  <CardContent className="p-0">
                                    <div className="flex items-center p-3">
                                      <Avatar className="h-8 w-8 mr-3">
                                        <AvatarImage 
                                          src={`https://icons.etokens.cash/32/${tokenId}.png`} 
                                          alt={tokenName} 
                                        />
                                        <AvatarFallback>{tokenSymbol}</AvatarFallback>
                                      </Avatar>
                                      <div className="flex-1">
                                        <div className="text-sm font-medium">{tokenName}</div>
                                        {tokenUrl && (
                                          <div className="text-xs text-blue-500 hover:underline">
                                            <a href={tokenUrl} target="_blank" rel="noopener noreferrer">
                                              {tokenUrl.length > 20 
                                                ? `${tokenUrl.substring(0, 10)}...${tokenUrl.substring(tokenUrl.length - 7)}` 
                                                : tokenUrl}
                                            </a>
                                          </div>
                                        )}
                                        {!tokenUrl && (
                                          <div className="text-xs text-muted-foreground select-text">{tokenId}</div>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <div className="text-sm font-medium">{formatTokenAmount(amount, tokenDecimals)}</div>
                                        <div className="text-xs text-muted-foreground">{tokenSymbol}</div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })
                          ) : (
                            <div className="text-center py-4 text-muted-foreground">
                              <Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p>No eTokens</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <DrawerFooter>
                      <DrawerClose asChild>
                        <Button variant="outline">Close</Button>
                      </DrawerClose>
                    </DrawerFooter>
                  </div>
                </DrawerContent>
              </Drawer>
            )}
            {!isWalletConnected && (
              <Drawer open={isLoginDrawerOpen} onOpenChange={setIsLoginDrawerOpen}>
                <DrawerTrigger asChild>
                  <Button 
                    variant="default" 
                    className="rounded-full bg-muted text-mute-foreground hover:bg-primary/90 ml-2"
                  >
                    <div className="flex items-center gap-1 w-full justify-center">
                      <span className="text-sm block text-center whitespace-nowrap flex-1">
                        Login
                      </span>
                    </div>
                  </Button>
                </DrawerTrigger>
                <DrawerContent>
                  <WalletConnectDrawerInner
                    mnemonicWords={mnemonicWords}
                    setMnemonicWords={setMnemonicWords}
                    mnemonicError={mnemonicError}
                    setMnemonicError={setMnemonicError}
                    handlePaste={handlePaste}
                    handleGenerateMnemonic={handleGenerateMnemonic}
                    handleSaveMnemonic={handleSaveMnemonic}
                    handleConnectCashtab={handleConnectCashtab}
                  />
                </DrawerContent>
              </Drawer>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
