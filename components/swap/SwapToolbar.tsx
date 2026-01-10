"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Globe } from "@/components/magicui/globe";
import { Power, Trash2, Layout, Signal } from "lucide-react";
import type React from "react";

interface SwapToolbarProps {
  showProPanel: boolean;
  onToggleProPanel: () => void;
  isAutoProcessing: boolean;
  isNotifying: boolean;
  hasActiveOrders: () => boolean;
  toggleAutoProcessing: () => void;
  toast: (opts: { title: string; description: string; variant?: "destructive" }) => void;
  onOpenDeleteDialog: () => void;
  isWalletConnected: boolean;
  onDisconnectWallet: () => void;
}

export const SwapToolbar: React.FC<SwapToolbarProps> = ({
  showProPanel,
  onToggleProPanel,
  isAutoProcessing,
  isNotifying,
  hasActiveOrders,
  toggleAutoProcessing,
  toast,
  onOpenDeleteDialog,
  isWalletConnected,
  onDisconnectWallet,
}) => {
  return (
    <div className="flex items-center space-x-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 hidden lg:flex ${showProPanel ? "text-blue-500" : "text-muted-foreground"}`}
              onClick={onToggleProPanel}
            >
              <Layout size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{showProPanel ? "Hide OrderBook" : "Show OrderBook"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 relative ${isAutoProcessing ? "text-green-400" : "text-muted-foreground"}`}
                style={{
                  opacity: isNotifying && hasActiveOrders() ? 1 : 0.5,
                  cursor: isNotifying && hasActiveOrders() ? "pointer" : "not-allowed",
                }}
              >
                <Signal size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-2">
              <div className="relative flex flex-col items-center p-2 overflow-hidden rounded-lg">
                <div className="relative flex size-full max-w-lg items-center justify-center overflow-hidden rounded-lg bg-background px-24 pb-24 pt-6">
                  <span className="pointer-events-none whitespace-pre-wrap bg-gradient-to-b from-black to-gray-300/80 bg-clip-text text-center text-5xl font-semibold leading-none text-transparent dark:from-white dark:to-slate-900/10">
                    {isAutoProcessing ? "Auto" : "Off"}
                  </span>
                  <Globe className="top-12" />
                  <div className="pointer-events-none absolute inset-0 h-full bg-[radial-gradient(circle_at_50%_200%,rgba(0,0,0,0.2),rgba(255,255,255,0))]" />
                </div>
              </div>
              <DropdownMenuItem
                onClick={() => {
                  if (!isAutoProcessing) {
                    toggleAutoProcessing();
                  } else {
                    toast({
                      title: "✅ Auto processing already enabled",
                      description: "System is already automatically processing orders",
                    });
                  }
                }}
                className="flex justify-center"
              >
                <Power className="h-4 w-4 text-green-500" /> Buy order On
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (isAutoProcessing) {
                    if (hasActiveOrders()) {
                      toast({
                        title: "Cannot disable auto processing",
                        description:
                          "You have active orders. Auto processing cannot be disabled while orders are pending",
                        variant: "destructive",
                      });
                    } else {
                      toggleAutoProcessing();
                    }
                  } else {
                    toast({
                      title: "✅ Auto processing already disabled",
                      description: "Automatic order processing is already stopped",
                    });
                  }
                }}
                className="flex justify-center"
              >
                <Power className="h-4 w-4 text-red-500" /> Buy order Off
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <TooltipTrigger asChild>
            <div className="sr-only">Auto processing</div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isAutoProcessing ? "Auto processing enabled" : "Enable auto processing"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={onOpenDeleteDialog}
            >
              <Trash2 size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Clear all local data</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {isWalletConnected && (
        <TooltipProvider>
          <Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                >
                  <Power size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onDisconnectWallet}>
                  <Power className="h-4 w-4 text-muted-foreground" /> Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <TooltipTrigger asChild>
              <div className="sr-only">Disconnect wallet</div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Disconnect wallet</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
};

export default SwapToolbar;


