"use client";

import type React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { PackageCheck, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Image from "next/image";

interface ConfirmOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isOfflineOrder: boolean;
  selectedToken: { id: string; name: string };
  receiveAmount: string;
  spendAmount: string;
  tokenPrice: number;
  networkFee: number;
  formatTokenPrice: (price: number) => string;
  onClose: () => void;
  onConfirm: () => void;
}

export const ConfirmOrderDialog: React.FC<ConfirmOrderDialogProps> = ({
  open,
  onOpenChange,
  isOfflineOrder,
  selectedToken,
  receiveAmount,
  spendAmount,
  tokenPrice,
  networkFee,
  formatTokenPrice,
  onClose,
  onConfirm,
}) => {
  const totalXec = receiveAmount && tokenPrice
    ? (parseFloat(receiveAmount) * tokenPrice + networkFee).toFixed(2)
    : spendAmount;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PackageCheck className="h-6 w-6" />
              Confirm Order
              <span
                className={`px-2 py-1 text-xs rounded-full ${
                  isOfflineOrder
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                }`}
              >
                {isOfflineOrder ? "Custodial" : "Self-Custody"}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertDialogTitle>
          <div className="mt-4">
            <span className="text-sm text-muted-foreground">
              You are about to create the following order:
            </span>
            <div className="mt-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-muted-foreground">Max Token amount:</div>
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarImage
                      src={`https://icons.etokens.cash/32/${selectedToken.id}.png`}
                      alt={selectedToken.name}
                    />
                    <AvatarFallback>
                      {selectedToken.name.substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  {receiveAmount} {selectedToken.name}
                </div>

                <div className="text-muted-foreground">Max XEC Amount</div>
                <div className="flex items-center gap-2">
                  <Image
                    src="/ecash.svg"
                    alt="eCash"
                    width={20}
                    height={20}
                  />
                  {totalXec} XEC
                </div>

                <div className="text-muted-foreground">Price per token:</div>
                <div className="flex items-center gap-2">
                  <Image
                    src="/ecash.svg"
                    alt="eCash"
                    width={20}
                    height={20}
                  />
                  {formatTokenPrice(tokenPrice)} XEC
                </div>

                <div className="text-muted-foreground">Swap Fee:</div>
                <div className="flex items-center gap-2">
                  <Image
                    src="/ecash.svg"
                    alt="eCash"
                    width={20}
                    height={20}
                  />
                  {networkFee.toFixed(2)} XEC
                </div>
              </div>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="mb-4">
          <div className="space-y-3">
            <h3 className="font-medium text-base">Order Type</h3>
            <div className="flex justify-center">
              <div className="border rounded-xl p-4 transition-all border-primary bg-primary/5 ring-2 ring-primary/20 w-full max-w-md">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-sm">Self-Custody</div>
                  <div className="w-4 h-4 rounded-full border-2 border-primary bg-primary">
                    <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Self-custody orders require keeping your browser online to
                  ensure order execution. You maintain full control of your
                  funds.
                </p>
                <p className="text-xs text-primary mt-2 font-medium">
                  ✓ Selected
                </p>
              </div>
            </div>
          </div>
        </div>

        <AlertDialogFooter className="sm:justify-center">
          <AlertDialogAction onClick={onConfirm} className="w-full h-12 text-md">
            {isOfflineOrder ? "Confirm Custodial Order" : "Confirm Self-Custody Order"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmOrderDialog;


