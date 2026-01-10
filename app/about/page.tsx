"use client"
import Header from "@/components/ui/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"

export default function About() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 p-4">
        <div className="flex flex-col mx-auto md:max-w-3xl space-y-6">
          <div className="mt-6 space-y-6">
            <div className="space-y-1">
              <h1 className="text-md font-semibold">About SS and SC</h1>
              <p className="text-sm text-gray-500">Learn about their roles in the ecosystem</p>
            </div>

            <div className="flex flex-col gap-5">
              <Card className="rounded-xl flex flex-col border border-blue-100/30 dark:border-blue-500/20">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Avatar className="h-10 w-10">
                        <AvatarImage 
                          src="/SS.png" 
                          alt="Star Shard" 
                        />
                        <AvatarFallback>SS</AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-md">Star Shard (SS)</CardTitle>
                      <p className="text-sm text-muted-foreground leading-tight">
                        Designed for swap and potential cross-chain functionality
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-3 flex-1">
                    <h3 className="text-md font-semibold">Overview</h3>
                    <p className="text-sm">
                      Star Shard has a base supply of 300 million tokens and offers more powerful and extensive features, including potential cross-chain capabilities, swap trading fee sharing, and many other mysterious features yet to be discovered. It shares a storyline with Star Crystal.
                    </p>
                    
                    <h3 className="text-md font-semibold">Utility</h3>
                    <p className="text-sm">
                      Star Shard can be used for paying transaction fees, cross-chain functions, and other purposes.<br/>
                      • Dynamic APY (currently 10%)
                    </p>

                    <div className="space-y-2">
                      <h3 className="text-md font-semibold">Premium</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-sm">Feature</TableHead>
                            <TableHead className="text-sm">Free User</TableHead>
                            <TableHead className="text-sm">With SS</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="text-sm">Buy order visibility</TableCell>
                            <TableCell className="text-sm">Locked</TableCell>
                            <TableCell className="text-sm">Hold 100,000 SS</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="text-sm">Watchlist slots</TableCell>
                            <TableCell className="text-sm">3 tokens</TableCell>
                            <TableCell className="text-sm">1,000,000 SS for unlimited</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="text-sm">eToken flow duration</TableCell>
                            <TableCell className="text-sm">180s</TableCell>
                            <TableCell className="text-sm">100,000 SS for unlimited</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="text-sm">Swap trading</TableCell>
                            <TableCell className="text-sm">Locked</TableCell>
                            <TableCell className="text-sm">Unlock with SS; more coming</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                  
                  <div className="flex justify-center mt-4">
                    <a
                      className="text-xs text-blue-500 hover:text-blue-600 hover:underline"
                      href="https://cashtab.com/#/token/d1131675cb62b65909fb45ba53b022da0bd0f34aaa71fc61770115472b186ffb"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Cashtab
                    </a>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl flex flex-col border border-blue-100/30 dark:border-blue-500/20">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Avatar className="h-10 w-10">
                        <AvatarImage 
                          src="/SC.png" 
                          alt="Star Crystal" 
                        />
                        <AvatarFallback>SC</AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-md">Star Crystal (SC)</CardTitle>
                      <p className="text-sm text-muted-foreground leading-tight">
                        Official token of Agora.cash UI.
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-3 flex-1">
                    <h3 className="text-md font-semibold">Overview</h3>
                    <p className="text-sm">
                      StarCrystal, with a total supply of 5,120,000 tokens, is the official eToken of agora.cash, serving as fuel for activities on Agora.cash and participating in revenue sharing and governance.
                    </p>
                    
                    <h3 className="text-md font-semibold">Holder Benefits</h3>
                    <p className="text-sm">
                      • Listing Rights: Star Crystal is required to list your eTokens
                    </p>
                    
                    <h3 className="text-md font-semibold">Current Status</h3>
                    <p className="text-sm">
                      • Total Supply: 5,120,000 tokens (Fixed supply)<br/>
                      • Fully circulating
                    </p>
                  </div>
                  
                  <div className="flex justify-center mt-4">
                    <a
                      className="text-xs text-blue-500 hover:text-blue-600 hover:underline"
                      href="https://cashtab.com/#/token/ac31bb0bccf33de1683efce4da64f1cb6d8e8d6e098bc01c51d5864deb0e783f"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Cashtab
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-10">
              <h2 className="text-md font-semibold mb-3">Join Us</h2>
              <p className="text-sm text-gray-500 mb-5">Connect with our community to learn more and stay updated</p>
              <div className="space-y-3">
                <div>
                  <Link 
                    href="https://t.me/agoraUI"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-500 hover:text-blue-600 hover:underline"
                  >
                    Join Telegram Community
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
