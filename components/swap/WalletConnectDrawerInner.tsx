"use client";

import type React from "react";
import { DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { MnemonicActions } from "@/components/ui/MnemonicActions";
import { Button } from "@/components/ui/button";
import { KeyRound, Plug2, XCircle } from "lucide-react";
import Image from "next/image";

export interface WalletConnectDrawerInnerProps {
  mnemonicWords: string[];
  setMnemonicWords: React.Dispatch<React.SetStateAction<string[]>>;
  mnemonicError: string;
  setMnemonicError: React.Dispatch<React.SetStateAction<string>>;
  handlePaste: (e: React.ClipboardEvent<HTMLInputElement>, index: number) => void;
  handleGenerateMnemonic: () => void;
  handleSaveMnemonic: () => void;
  handleConnectCashtab: () => void;
}

export const WalletConnectDrawerInner: React.FC<WalletConnectDrawerInnerProps> = ({
  mnemonicWords,
  setMnemonicWords,
  mnemonicError,
  setMnemonicError,
  handlePaste,
  handleGenerateMnemonic,
  handleSaveMnemonic,
  handleConnectCashtab,
}) => {
  return (
    <div className="mx-auto w-full max-w-xl p-4">
      <DrawerHeader>
        <DrawerTitle>Connect Wallet</DrawerTitle>
        <DrawerDescription>
          Enter your recovery phrase to connect your wallet
        </DrawerDescription>
      </DrawerHeader>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-3 gap-2">
          {mnemonicWords.map((word, index) => (
            <Input
              key={index}
              type="text"
              placeholder={`Word ${index + 1}`}
              value={word}
              className="text-center"
              onChange={(e) => {
                const newWords = [...mnemonicWords];
                newWords[index] = e.target.value.toLowerCase();
                setMnemonicWords(newWords);
                setMnemonicError("");
              }}
              onPaste={(e) => handlePaste(e, index)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && index < 11) {
                  const nextInput = document.querySelector(
                    `input[placeholder="Word ${index + 2}"]`,
                  );
                  if (nextInput) {
                    (nextInput as HTMLElement).focus();
                  }
                }
              }}
            />
          ))}
        </div>
        {mnemonicError && (
          <p className="text-sm text-red-500">
            {mnemonicError}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Keep your recovery phrase safe. This is the only way to restore your wallet.
        </p>
      </div>
      <DrawerFooter>
        <MnemonicActions mnemonicWords={mnemonicWords} />

        <Button
          className="w-full flex items-center justify-center gap-2"
          onClick={handleGenerateMnemonic}
        >
          <KeyRound className="h-4 w-4" />
          <span>Generate new recovery phrase</span>
        </Button>
        <Button
          className="w-full flex items-center justify-center gap-2"
          onClick={handleSaveMnemonic}
        >
          <Plug2 className="h-4 w-4" />
          <span>Connect</span>
        </Button>
        <DrawerClose asChild>
          <Button
            variant="outline"
            className="w-full flex items-center justify-center gap-2"
          >
            <XCircle className="h-4 w-4" />
            <span>Cancel</span>
          </Button>
        </DrawerClose>
        <Button
          variant="outline"
          className="w-full mb-4 flex items-center justify-center gap-2"
          onClick={handleConnectCashtab}
        >
          <span>Connect with Cashtab</span>
          <Image
            src="/cashtab.png"
            alt="Cashtab Logo"
            width={49}
            height={49}
            className="inline-block"
          />
        </Button>
      </DrawerFooter>
    </div>
  );
};

export default WalletConnectDrawerInner;


