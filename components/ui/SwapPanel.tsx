"use client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { TokenSelector } from "@/components/ui/token-selector"

interface SelectedToken {
  id: string
  name: string
}

interface SwapPanelProps {
  spendAmount: string
  setSpendAmount: (v: string) => void
  receiveAmount: string
  balance: string
  isWalletConnected: boolean
  calculateReceiveAmount: (v: string) => void
  selectedBuyToken: SelectedToken | null
  setSelectedBuyToken: (t: SelectedToken) => void
  userTokens: { [key: string]: string }
  setReceiveAmount: (v: string) => void
  setAvgExecutionPrice: (v: number) => void
  setSlippage: (v: number) => void
  setErrorMessage: (v: string) => void
  setMaxPrice: (v: number) => void
  errorMessage: string
  avgExecutionPrice: number
  slippage: number
  isSwapActivated: boolean
  tokenId: string
  createSwapOrder: () => void
  riskAcknowledged: boolean
  setRiskAcknowledged: (v: boolean) => void
  onMaxClick: () => void
  checkboxId?: string
}

export function SwapPanel({
  spendAmount, setSpendAmount, receiveAmount, balance, isWalletConnected,
  calculateReceiveAmount, selectedBuyToken, setSelectedBuyToken, userTokens,
  setReceiveAmount, setAvgExecutionPrice, setSlippage, setErrorMessage, setMaxPrice,
  errorMessage, avgExecutionPrice, slippage, isSwapActivated, tokenId,
  createSwapOrder, riskAcknowledged, setRiskAcknowledged, onMaxClick,
  checkboxId = "risk-acknowledgement",
}: SwapPanelProps) {
  return (
    <div className="space-y-4">
      <Badge variant="secondary" className="h-10 rounded-lg">Agora</Badge>

      <Card className="rounded-3xl py-2 px-0 border-none shadow-none">
        <div className="space-y-2 bg-muted p-4 rounded-2xl transition-all hover:ring-2 hover:ring-primary/50">
          <div className="text-muted-foreground text-sm">Spend</div>
          <div className="flex items-center justify-between">
            <input
              type="text"
              className="text-lg font-medium bg-transparent outline-none w-3/4"
              placeholder="0"
              value={spendAmount}
              onChange={(e) => {
                setSpendAmount(e.target.value)
                calculateReceiveAmount(e.target.value)
              }}
            />
            <Button className="bg-primary/10 hover:bg-primary/20 text-primary rounded-full px-6 py-2">
              eCash
            </Button>
          </div>

          <div className="flex items-center mt-2">
            <Button
              variant="outline"
              className="p-2 h-8 mr-2"
              onClick={onMaxClick}
              disabled={!isWalletConnected}
            >
              Max
            </Button>
            <span className="ml-auto text-sm text-muted-foreground">
              Balance: {isWalletConnected ? `${balance} XEC` : "0 XEC"}
            </span>
          </div>
        </div>

        <div className="relative h-0">
          <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-full p-2 shadow-md z-10">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>

        <div className="space-y-2 bg-background p-4 rounded-2xl border mt-2 transition-all hover:bg-muted/50">
          <div className="text-muted-foreground text-sm">Buy</div>
          <div className="flex items-center justify-between">
            <input
              type="text"
              className="text-lg font-medium bg-transparent outline-none w-3/4"
              placeholder="0"
              value={receiveAmount}
              readOnly
            />
            {selectedBuyToken && (
              <TokenSelector
                selectedToken={selectedBuyToken}
                userTokens={userTokens}
                onTokenSelect={(tid, tokenName) => {
                  setSelectedBuyToken({ id: tid, name: tokenName })
                  setSpendAmount("")
                  setReceiveAmount("0")
                  setAvgExecutionPrice(0)
                  setSlippage(0)
                  setErrorMessage("")
                  setMaxPrice(0)
                }}
              />
            )}
          </div>

          <div className="mt-2 space-y-1">
            {errorMessage ? (
              <div className="text-sm text-red-500">
                {errorMessage.replace(/exceeds (available )?amount/gi, "Exceeds available amount:")}
              </div>
            ) : avgExecutionPrice > 0 && (
              <>
                <div className="text-sm text-muted-foreground">
                  Average Price: {avgExecutionPrice.toFixed(4)} XEC
                </div>
                <div className="text-sm">
                  Slippage: <span className={slippage > 0 ? "text-red-500" : "text-green-500"}>
                    {slippage.toFixed(2)}%
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </Card>

      <div className="flex gap-2">
        {isSwapActivated ? (
          <>
            <Button
              className="flex-1 bg-pink-100 hover:bg-pink-200 text-pink-500/80 h-14 text-lg rounded-2xl"
              variant="ghost"
              onClick={() => window.open(`https://cashtab.com/#/token/${tokenId}`, "_blank")}
            >
              Cashtab
            </Button>
            <Button
              className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-500 h-14 text-lg rounded-2xl"
              variant="ghost"
              onClick={createSwapOrder}
              disabled={!riskAcknowledged}
            >
              Swap🔥
            </Button>
          </>
        ) : (
          <div className="flex-1 bg-yellow-50 dark:bg-yellow-900/40 text-xs sm:text-sm text-yellow-800 dark:text-yellow-100 rounded-2xl px-4 py-3 flex items-center justify-center text-center leading-relaxed">
            <span>
              Swap for this token is not yet activated on Agora. You can apply to enable it on the{" "}
              <a href="/list" className="underline">/list</a>{" "}
              page.
            </span>
          </div>
        )}
      </div>

      {!riskAcknowledged && (
        <div className="flex items-start space-x-2 mt-3 p-3 bg-muted/50 rounded-lg">
          <Checkbox
            id={checkboxId}
            checked={riskAcknowledged}
            onCheckedChange={(checked) => {
              const isChecked = checked as boolean
              setRiskAcknowledged(isChecked)
              if (isChecked) {
                localStorage.setItem("risk_acknowledged", "true")
              }
            }}
          />
          <label
            htmlFor={checkboxId}
            className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
          >
            This is an experimental feature. I understand and accept all risks associated with using this functionality.
          </label>
        </div>
      )}
    </div>
  )
}

