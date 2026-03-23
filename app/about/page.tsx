"use client"
import Header from "@/components/ui/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import Link from "next/link"

export default function About() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 p-4 pb-12">
        <div className="flex flex-col mx-auto md:max-w-3xl space-y-8">
          <header className="mt-6 space-y-2">
            <h1 className="text-lg font-semibold tracking-tight">About Agora.Cash</h1>
            <p className="text-sm text-muted-foreground">
              What this site is, how it is run, and how legacy tokens are honored
            </p>
          </header>

          <Card className="rounded-xl border border-blue-100/30 dark:border-blue-500/20 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">The site</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed text-foreground/90">
              <p>
                Agora.Cash is a site that provides Agora market monitoring, analysis, and transaction
                services for the eCash community. Its goal is to raise awareness for tokens on the Agora
                marketplace, offer additional services currently not available on Agora, and to help
                traders make informed decisions.
              </p>
              <p>
                Due to crypto market conditions, the site is being maintained and improved by lead
                developer alitayin on a volunteer basis, hoping to enhance the site&apos;s features
                enough to offer valuable services that visitors will be willing to consume to support
                eCash community development and fund further eCash ecosystem development.
              </p>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h2 className="text-base font-semibold tracking-tight">About Star Shard and Star Crystal</h2>
            <div className="flex flex-wrap gap-3 items-center text-sm text-muted-foreground">
              <div className="flex items-center gap-2 rounded-full border border-blue-100/40 dark:border-blue-500/25 bg-blue-50/50 dark:bg-blue-500/5 px-3 py-1">
                <Avatar className="h-6 w-6">
                  <AvatarImage src="/SS.png" alt="Star Shard" />
                  <AvatarFallback className="text-[10px]">SS</AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">Star Shard (SS)</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-blue-100/40 dark:border-blue-500/25 bg-blue-50/50 dark:bg-blue-500/5 px-3 py-1">
                <Avatar className="h-6 w-6">
                  <AvatarImage src="/SC.png" alt="Star Crystal" />
                  <AvatarFallback className="text-[10px]">SC</AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">Star Crystal (SC)</span>
              </div>
            </div>
          </div>

          <Card className="rounded-xl border border-blue-100/30 dark:border-blue-500/20 shadow-sm">
            <CardContent className="pt-6 space-y-5 text-sm leading-relaxed text-foreground/90">
              <p>
                Star Shard (SS) and Star Crystal (SC) were created by the original owner of Agora.Cash
                to raise funds for continued development. Unfortunately, those development funds were
                exhausted before site sustainability was achieved due to crypto market conditions and
                lower than expected utilization and revenue. Agora.Cash is transitioning to a more
                straightforward approach of spending XEC for services but will be honoring Star Shard and
                Star Crystal tokens as payment for services rendered at a rate equal to or greater than the
                original purchase price of those tokens.
              </p>

              <div className="rounded-lg border border-blue-200/50 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-500/10 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300 mb-1">
                  Original sale prices (reference)
                </p>
                <ul className="text-sm space-y-1 list-disc list-inside marker:text-blue-500/80">
                  <li>Star Shard originally sold at 5 XEC</li>
                  <li>Star Crystal originally sold at 300 XEC</li>
                </ul>
              </div>

              <p>
                Once implemented, this gives anyone who uses Star Shard and Star Crystal tokens a discount
                on the site&apos;s services, rewarding them for their past support or their purchasing of
                tokens from supporters at their asking price on the Agora marketplace. Neither the lead
                developer nor the new owner will make any money on spent tokens, as money received from
                purchased tokens went to the original owner, so this is a sincere gesture of goodwill to
                reward supporters of the site and rectify the issues associated with past tokenization
                efforts.
              </p>

              <div className="flex flex-wrap gap-4 pt-1 border-t border-border/60">
                <a
                  className="text-xs text-blue-500 hover:text-blue-600 hover:underline"
                  href="https://cashtab.com/#/token/d1131675cb62b65909fb45ba53b022da0bd0f34aaa71fc61770115472b186ffb"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Cashtab — Star Shard (SS)
                </a>
                <a
                  className="text-xs text-blue-500 hover:text-blue-600 hover:underline"
                  href="https://cashtab.com/#/token/ac31bb0bccf33de1683efce4da64f1cb6d8e8d6e098bc01c51d5864deb0e783f"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Cashtab — Star Crystal (SC)
                </a>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-amber-200/40 dark:border-amber-500/25 bg-amber-50/40 dark:bg-amber-500/5 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-amber-950 dark:text-amber-100">
                Acquisition & official communications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-foreground/90">
              <p className="font-medium text-foreground">
                The acquisition of the Agora.Cash site occurred on March 5, 2026.
              </p>
              <p>
                The new Agora.Cash site currently has no tokens associated with it, so please be wary of
                any fraudulent activity by parties claiming to be associated with Agora.Cash issuing
                unauthorized tokens for any reason, including shares of ownership, profit sharing, or any
                other purpose. Any change to this state will be officially announced on the new Agora.Cash
                site.
              </p>
            </CardContent>
          </Card>

          <section className="mt-10 pt-2">
            <h2 className="text-base font-semibold mb-2">Join us</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Connect with our community to learn more and stay updated
            </p>
            <Link
              href="https://t.me/agoraUI"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-500 hover:text-blue-600 hover:underline"
            >
              Join Telegram Community
            </Link>
          </section>
        </div>
      </main>
    </div>
  )
}
