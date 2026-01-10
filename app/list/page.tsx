"use client"
import { useState } from "react"
import Header from "@/components/ui/header"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { QuestionMarkCircledIcon } from "@radix-ui/react-icons"
import { useToast } from "@/hooks/use-toast"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"

const LabelWithHelp = ({ htmlFor, children }: { htmlFor?: string, children: React.ReactNode }) => (
  <div className="flex items-center gap-2">
    <Label htmlFor={htmlFor}>{children}</Label>
    <Dialog>
      <DialogTrigger asChild>
        <QuestionMarkCircledIcon className="h-4 w-4 cursor-pointer text-gray-500 hover:text-gray-700" />
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <img src="/list.png" alt="Reference" className="w-full" />
      </DialogContent>
    </Dialog>
  </div>
)

export default function ListPage() {
  const [listingMethod, setListingMethod] = useState("activate-swap")
  const [tokenId, setTokenId] = useState("")
  const [txId, setTxId] = useState("")
  const { toast } = useToast()
  const [isShaking, setIsShaking] = useState(false)

  const calculateFee = () => {
    switch (listingMethod) {
      case "activate-swap":
        return 1000000
      case "regular":
        return 15000
      default:
        return 0
    }
  }

  const getListingMethodLabel = () => {
    switch (listingMethod) {
      case "activate-swap":
        return "Activate Swap"
      case "regular":
        return "Regular Recommendation"
      default:
        return ""
    }
  }

  // SC for listing packages, SS for swap-related packages
  const feeTokenLabel = listingMethod === "activate-swap" ? "SS" : "SC"
  const isSC = listingMethod === "regular"

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 p-0 sm:p-5">
        <div className="flex flex-col mx-auto md:max-w-4xl space-y-4">
          <div className="mt-6 space-y-6 p-2">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <h1 className="text-md font-bold">List Your eToken</h1>
                <p className="text-gray-500">Fill in your eToken information to complete the listing process</p>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              {/* Listing Method Selection */}
              <Card className="rounded-xl">
                <CardContent className="p-4 space-y-4">
                  <Label className="text-md">Listing Method</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Card 
                      className={`cursor-pointer transition-all ${
                        listingMethod === "activate-swap" ? "border-primary ring-2 ring-primary" : ""
                      }`}
                      onClick={() => setListingMethod("activate-swap")}
                    >
                      <CardContent className="p-4">
                        <h3 className="font-semibold">Activate Swap</h3>
                        <p className="text-sm text-gray-500 mt-2">Activate swap function for your token</p>
                        <p className="text-md font-bold mt-4">1,000,000 SS</p>
                      </CardContent>
                    </Card>

                    <Card 
                      className={`cursor-pointer transition-all ${
                        listingMethod === "regular" ? "border-primary ring-2 ring-primary" : ""
                      }`}
                      onClick={() => setListingMethod("regular")}
                    >
                      <CardContent className="p-4">
                        <h3 className="font-semibold">Regular Recommendation</h3>
                        <p className="text-sm text-gray-500 mt-2">
                          Pinned in all eTokens with priority over thousands of eTokens
                        </p>
                        <p className="text-md font-bold mt-4">15,000 SC</p>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>

              {/* Form fields based on listing method */}
              {listingMethod && (
                <Card className="rounded-xl">
                  <CardContent className="p-4 space-y-3">
                    <div className="space-y-2">
                      <LabelWithHelp htmlFor="tokenId">Token ID</LabelWithHelp>
                      <Input 
                        id="tokenId" 
                        placeholder="Enter token ID"
                        value={tokenId}
                        onChange={(e) => setTokenId(e.target.value)}
                      />
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
                      <p className="text-gray-800 dark:text-gray-200">
                        For both Activate Swap and Regular Recommendation, please provide the Token ID here and the Transaction ID in the payment section below.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Fees card */}
              {listingMethod && (
                <Card className="rounded-xl">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center shrink-0">
                        <Avatar className="h-8 w-8">
                          <AvatarImage 
                            src={
                              isSC
                                ? "https://icons.etokens.cash/32/ac31bb0bccf33de1683efce4da64f1cb6d8e8d6e098bc01c51d5864deb0e783f.png"
                                : "/SS.png"
                            }
                            alt={isSC ? "SC" : "SS"} 
                          />
                          <AvatarFallback>
                            {isSC ? "SC" : "SS"}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div>
                        <CardTitle>Listing Fee</CardTitle>
                        <p className="text-muted-foreground text-sm mt-1 leading-tight">
                          {getListingMethodLabel()}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 p-4 pt-0">
                    {/* Divider */}
                    <div className="h-px bg-border" />

                    <div className="flex justify-between items-center">
                      <span className="text-md font-medium">Total Fee:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-md font-bold">
                          {calculateFee().toLocaleString()} {feeTokenLabel}
                        </span>
                        <Avatar className="h-8 w-8">
                          <AvatarImage 
                            src={
                              isSC
                                ? "https://icons.etokens.cash/32/ac31bb0bccf33de1683efce4da64f1cb6d8e8d6e098bc01c51d5864deb0e783f.png"
                                : "/SS.png"
                            }
                            alt={isSC ? "SC" : "SS"} 
                          />
                          <AvatarFallback>
                            {isSC ? "SC" : "SS"}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm space-y-2">
                        <p className="text-gray-800 dark:text-gray-200">
                          Please send {calculateFee().toLocaleString()} {feeTokenLabel} to the following address:
                        </p>
                        <p className="font-mono bg-white dark:bg-gray-900 p-2 rounded border dark:border-gray-700 select-all break-all">
                          ecash:qzey4jkh2x23q2zngq50z8uxgw0ek4xazgh65we6y0
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="txId">Transaction ID</Label>
                        <Input 
                          id="txId" 
                          placeholder="Enter your transaction ID" 
                          className="font-mono"
                          value={txId}
                          onChange={(e) => setTxId(e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* FAQ card */}
              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle>Frequently Asked Questions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <p className="font-medium text-gray-800 dark:text-gray-200">Q1: Why is it not shown directly in the listed section?</p>
                    <p className="text-gray-600 dark:text-gray-400">
                      This is a user experience improvement to avoid showing too many tokens, while still pinning them in the all eTokens tab.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="font-medium text-gray-800 dark:text-gray-200">
                      Q2: Can I list only on Swap without paying SC for homepage ranking?
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">
                      Yes, you can. These are two independent features.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Submit button card */}
              {listingMethod && (
                <Card className="rounded-xl">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex justify-end">
                      <Button 
                        onClick={() => {
                          let formInfo = `
Listing Information:
==================
Listing Method: ${getListingMethodLabel()}
`

                          if (listingMethod === 'activate-swap') {
                            formInfo += `
Token Information:
==================
Token ID: ${tokenId}

Transaction Information:
==================
Transaction ID: ${txId}
Total Fee: ${calculateFee().toLocaleString()} ${feeTokenLabel}
                            `
                          } else {
                            formInfo += `
Token Information:
==================
Token ID: ${tokenId}

Payment Information:
==================
Transaction ID: ${txId}
Total Fee: ${calculateFee().toLocaleString()} ${feeTokenLabel}
                            `
                          }

                          navigator.clipboard.writeText(formInfo)
                          
                          toast({
                            description: "✅ Information copied successfully!",
                          })

                          setIsShaking(true)
                          setTimeout(() => setIsShaking(false), 500)
                        }}
                        className="px-6 w-full"
                      >
                        Complete & Copy Info
                      </Button>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
                      <p>Please copy the above information and send it to:</p>
                      <p className={`mt-1 font-medium select-all ${isShaking ? 'shake' : ''}`}>
                        mupeishan@proton.me
                      </p>
                      <p className="mt-1 text-gray-600 dark:text-gray-400">
                        We will review your listing request and process it as soon as possible.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
