"use client"

import { Bot } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const TELEGRAM_BOT_URL = "https://t.me/ecashagora_bot"

export default function TelegramAgoraBotDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Bot className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Agora Bot</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agora Bot</DialogTitle>
          <DialogDescription>
            <a
              href={TELEGRAM_BOT_URL}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground hover:underline"
            >
              @ecashagora_bot
            </a>
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-4 text-sm">
          <div className="min-w-0 rounded-lg border bg-muted/40 p-3">
            <div className="font-medium">Private Commands</div>
            <div className="mt-2 flex min-w-0 flex-col gap-2 font-mono text-xs leading-5 text-muted-foreground">
              <code className="break-all">/sub &lt;tokenId&gt;</code>
              <code className="break-all">/unsub &lt;tokenId|ticker|name&gt;</code>
              <code className="break-all">/list</code>
              <code className="break-all">/setvalue &lt;tokenId|ticker|name&gt; &lt;xec&gt;</code>
            </div>
          </div>

          <div className="min-w-0 rounded-lg border bg-muted/40 p-3">
            <div className="font-medium">Example</div>
            <div className="mt-2 flex min-w-0 flex-col gap-2 font-mono text-xs leading-5 text-muted-foreground">
              <code>/sub</code>
              <code className="break-all">
                d1131675cb62b65909fb45ba53b022da0bd0f34aaa71fc61770115472b186ffb
              </code>
              <code>/setvalue SS 1000</code>
            </div>
          </div>

          <div className="text-xs leading-5 text-muted-foreground">
            New transaction + price change alerts only.
            <br />
            Only min value is configurable. `0` disables it.
            <br />
            Token labels come from Chronik metadata.
          </div>

          <Button asChild className="w-full">
            <a href={TELEGRAM_BOT_URL} target="_blank" rel="noreferrer">
              Open Telegram Bot
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
