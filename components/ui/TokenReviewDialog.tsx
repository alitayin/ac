"use client"

import * as React from "react"
import quick from "ecash-quicksend"
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  MessageSquareText,
  Sparkles,
  Star,
  Wallet,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useWallet } from "@/lib/context/WalletContext"
import {
  createEtokenDbReviewInvoice,
  fetchEtokenDbReviewInvoice,
  fetchEtokenDbTokenReviewSummary,
  submitEtokenDbReviewInvoiceTx,
  type EtokenDbReviewInvoice,
  type EtokenDbTokenReviewSummary,
} from "@/lib/etokendb"
import type { Token } from "@/lib/types"
import { cn } from "@/lib/utils"

type TokenReviewDialogToken = Pick<
  Token,
  | "tokenId"
  | "name"
  | "reviewAverageScore"
  | "reviewScorerCount"
  | "reviewCountTotal"
  | "reviewCommentCountTotal"
  | "lastReviewAt"
>

type TokenReviewDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  token: TokenReviewDialogToken | null
  onPublished?: (tokenId: string, summary: EtokenDbTokenReviewSummary) => void
}

const POLL_INTERVAL_MS = 3_000
const POLL_TIMEOUT_MS = 60_000
const COMMENT_MAX_BYTES = 500
const SCORE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const PENDING_REVIEW_STORAGE_KEY = "token_review_pending_v1"

const textEncoder = new TextEncoder()

type PendingReviewSession = {
  tokenId: string
  invoiceId: string
  score: number
  comment: string
  txid: string | null
  updatedAt: number
}

const readPendingReviewSessions = (): Record<string, PendingReviewSession> => {
  if (typeof window === "undefined") {
    return {}
  }

  try {
    const raw = window.localStorage.getItem(PENDING_REVIEW_STORAGE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as Record<string, PendingReviewSession> | null
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch (_error) {
    return {}
  }
}

const getPendingReviewSession = (
  tokenId: string,
): PendingReviewSession | null => {
  const sessions = readPendingReviewSessions()
  const session = sessions[tokenId]
  return session && typeof session === "object" ? session : null
}

const setPendingReviewSession = (session: PendingReviewSession) => {
  if (typeof window === "undefined") {
    return
  }

  try {
    const sessions = readPendingReviewSessions()
    sessions[session.tokenId] = session
    window.localStorage.setItem(
      PENDING_REVIEW_STORAGE_KEY,
      JSON.stringify(sessions),
    )
  } catch (_error) {}
}

const clearPendingReviewSession = (tokenId: string) => {
  if (typeof window === "undefined") {
    return
  }

  try {
    const sessions = readPendingReviewSessions()
    if (!(tokenId in sessions)) {
      return
    }
    delete sessions[tokenId]
    window.localStorage.setItem(
      PENDING_REVIEW_STORAGE_KEY,
      JSON.stringify(sessions),
    )
  } catch (_error) {}
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const getCommentByteLength = (value: string): number => {
  return textEncoder.encode(value).length
}

const formatFeeLabel = (value?: string | null): string => {
  if (!value) {
    return "100k"
  }

  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) {
    return "100k"
  }

  if (amount >= 1000) {
    return new Intl.NumberFormat("en", {
      notation: "compact",
      maximumFractionDigits: 1,
    })
      .format(amount)
      .replace("K", "k")
      .replace("M", "m")
  }

  return value
}

const formatAddress = (value: string): string => {
  if (value.length <= 18) {
    return value
  }

  return `${value.slice(0, 12)}...${value.slice(-8)}`
}

const formatLastReviewAt = (timestamp: number | null): string => {
  if (!timestamp) {
    return "No paid reviews yet"
  }

  try {
    return new Date(timestamp).toLocaleString()
  } catch (_error) {
    return "Recent paid review"
  }
}

export function TokenReviewDialog({
  open,
  onOpenChange,
  token,
  onPublished,
}: TokenReviewDialogProps) {
  const { toast } = useToast()
  const {
    isWalletConnected,
    ecashAddress,
    mnemonic,
    isGuestMode,
    refreshBalance,
  } = useWallet()

  const [score, setScore] = React.useState<number | null>(null)
  const [comment, setComment] = React.useState("")
  const [invoice, setInvoice] = React.useState<EtokenDbReviewInvoice | null>(null)
  const [summary, setSummary] = React.useState<EtokenDbTokenReviewSummary | null>(null)
  const [isRefreshingSummary, setIsRefreshingSummary] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [statusMessage, setStatusMessage] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")
  const mountedRef = React.useRef(true)
  const resumeAttemptedInvoiceRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  React.useEffect(() => {
    if (!token) {
      setSummary(null)
      return
    }

    setSummary({
      averageScore: token.reviewAverageScore,
      scorerCount: token.reviewScorerCount,
      reviewCountTotal: token.reviewCountTotal,
      commentCountTotal: token.reviewCommentCountTotal,
      lastReviewAt: token.lastReviewAt,
    })
  }, [
    token?.lastReviewAt,
    token?.reviewAverageScore,
    token?.reviewCommentCountTotal,
    token?.reviewCountTotal,
    token?.reviewScorerCount,
    token?.tokenId,
  ])

  React.useEffect(() => {
    if (!open || !token) {
      return
    }

    setErrorMessage("")
    setStatusMessage("")
    setInvoice(null)
    setScore(null)
    setComment("")
    setIsRefreshingSummary(true)
    resumeAttemptedInvoiceRef.current = null

    const pendingSession = getPendingReviewSession(token.tokenId)
    if (pendingSession) {
      setScore(pendingSession.score)
      setComment(pendingSession.comment)
    }

    let cancelled = false

    void fetchEtokenDbTokenReviewSummary(token.tokenId)
      .then((nextSummary) => {
        if (!cancelled && mountedRef.current) {
          setSummary(nextSummary)
        }
      })
      .catch(() => {
        return
      })
      .finally(() => {
        if (!cancelled && mountedRef.current) {
          setIsRefreshingSummary(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, token?.tokenId])

  const sanitizedComment = comment.trim()
  const commentByteLength = React.useMemo(() => getCommentByteLength(comment), [comment])
  const isCommentTooLong = commentByteLength > COMMENT_MAX_BYTES
  const hasWalletAddress = Boolean(isWalletConnected && ecashAddress)
  const hasSigningWallet = Boolean(isWalletConnected && ecashAddress && mnemonic && !isGuestMode)
  const isInvoiceStale =
    Boolean(invoice) &&
    (invoice?.score !== score || invoice?.comment !== sanitizedComment)
  const isPublishedInvoice =
    Boolean(invoice) && !isInvoiceStale && invoice?.status === "published"
  const isAwaitingBackend =
    Boolean(invoice) && !isInvoiceStale && invoice?.status === "tx_submitted"
  const canSubmit = Boolean(
    score && !isCommentTooLong && hasSigningWallet && !isSubmitting && !isPublishedInvoice,
  )
  const currentAverage =
    summary?.averageScore !== null && summary?.averageScore !== undefined
      ? summary.averageScore.toFixed(1)
      : "Unrated"
  const submitFeeLabel = formatFeeLabel(invoice?.expectedPaidXec)

  const refreshSummary = React.useCallback(async () => {
    if (!token) {
      return null
    }

    const nextSummary = await fetchEtokenDbTokenReviewSummary(token.tokenId)
    if (!mountedRef.current) {
      return nextSummary
    }

    setSummary(nextSummary)
    onPublished?.(token.tokenId, nextSummary)
    return nextSummary
  }, [onPublished, token])

  const clearSessionForCurrentToken = React.useCallback(() => {
    if (!token) {
      return
    }
    clearPendingReviewSession(token.tokenId)
  }, [token])

  const persistSessionForCurrentToken = React.useCallback(
    (next: {
      invoiceId: string
      score: number
      comment: string
      txid: string | null
    }) => {
      if (!token) {
        return
      }

      setPendingReviewSession({
        tokenId: token.tokenId,
        invoiceId: next.invoiceId,
        score: next.score,
        comment: next.comment,
        txid: next.txid,
        updatedAt: Date.now(),
      })
    },
    [token],
  )

  const pollInvoiceUntilSettled = React.useCallback(
    async (invoiceId: string): Promise<EtokenDbReviewInvoice> => {
      const startedAt = Date.now()
      let latestInvoice = await fetchEtokenDbReviewInvoice(invoiceId)

      while (
        latestInvoice.status === "pending" ||
        latestInvoice.status === "tx_submitted"
      ) {
        if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
          return latestInvoice
        }

        await sleep(POLL_INTERVAL_MS)
        latestInvoice = await fetchEtokenDbReviewInvoice(invoiceId)
        if (mountedRef.current) {
          setInvoice(latestInvoice)
        }
      }

      return latestInvoice
    },
    [],
  )

  const payInvoice = React.useCallback(
    async (activeInvoice: EtokenDbReviewInvoice): Promise<string> => {
      if (!mnemonic) {
        throw new Error("A mnemonic-backed wallet login is required for payment")
      }

      const result = await quick.sendXec(
        [
          {
            address: activeInvoice.paymentAddress,
            amount: BigInt(activeInvoice.expectedPaidSats),
          },
        ],
        {
          mnemonic,
          utxoStrategy: "minimal",
        },
      )

      return result.txid
    },
    [mnemonic],
  )

  const settleResolvedInvoice = React.useCallback(
    async (resolvedInvoice: EtokenDbReviewInvoice) => {
      if (mountedRef.current) {
        setInvoice(resolvedInvoice)
      }

      if (resolvedInvoice.status === "published") {
        clearSessionForCurrentToken()
        await refreshSummary()
        await refreshBalance()
        if (mountedRef.current) {
          setStatusMessage("Published")
        }
        return resolvedInvoice
      }

      if (resolvedInvoice.status === "invalid" || resolvedInvoice.status === "expired") {
        clearSessionForCurrentToken()
      }

      return resolvedInvoice
    },
    [clearSessionForCurrentToken, refreshBalance, refreshSummary],
  )

  const resumePendingReview = React.useCallback(
    async (session: PendingReviewSession) => {
      if (!token || resumeAttemptedInvoiceRef.current === session.invoiceId) {
        return
      }

      resumeAttemptedInvoiceRef.current = session.invoiceId
      setIsSubmitting(true)
      setErrorMessage("")

      try {
        const currentInvoice = await fetchEtokenDbReviewInvoice(session.invoiceId)

        if (!mountedRef.current) {
          return
        }

        setInvoice(currentInvoice)
        setScore(session.score)
        setComment(session.comment)

        if (currentInvoice.status === "published") {
          await settleResolvedInvoice(currentInvoice)
          return
        }

        if (currentInvoice.status === "invalid" || currentInvoice.status === "expired") {
          await settleResolvedInvoice(currentInvoice)
          return
        }

        if (session.txid && currentInvoice.status === "pending") {
          setStatusMessage("Resubmitting saved payment txid")
          const submittedInvoice = await submitEtokenDbReviewInvoiceTx(
            currentInvoice.invoiceId,
            { txid: session.txid },
          )
          persistSessionForCurrentToken({
            invoiceId: submittedInvoice.invoiceId,
            score: submittedInvoice.score,
            comment: submittedInvoice.comment,
            txid: session.txid,
          })

          if (mountedRef.current) {
            setInvoice(submittedInvoice)
          }

          if (submittedInvoice.status === "published") {
            await settleResolvedInvoice(submittedInvoice)
            return
          }

          setStatusMessage("Waiting for backend verification")
          const settledInvoice = await pollInvoiceUntilSettled(submittedInvoice.invoiceId)
          await settleResolvedInvoice(settledInvoice)
          return
        }

        if (currentInvoice.status === "tx_submitted") {
          setStatusMessage("Waiting for backend verification")
          const settledInvoice = await pollInvoiceUntilSettled(currentInvoice.invoiceId)
          await settleResolvedInvoice(settledInvoice)
          return
        }

        setStatusMessage("Pending invoice restored")
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to restore pending review."
        if (mountedRef.current) {
          setErrorMessage(message)
          setStatusMessage("")
        }
      } finally {
        if (mountedRef.current) {
          setIsSubmitting(false)
        }
      }
    },
    [
      persistSessionForCurrentToken,
      pollInvoiceUntilSettled,
      settleResolvedInvoice,
      token,
    ],
  )

  React.useEffect(() => {
    if (!open || !token) {
      return
    }

    const pendingSession = getPendingReviewSession(token.tokenId)
    if (!pendingSession) {
      return
    }

    void resumePendingReview(pendingSession)
  }, [open, resumePendingReview, token])

  const handleSubmitReview = React.useCallback(async () => {
    if (!token || !ecashAddress || !score || isCommentTooLong || !mnemonic || isGuestMode) {
      return
    }

    setIsSubmitting(true)
    setErrorMessage("")
    setStatusMessage(
      isAwaitingBackend ? "Checking backend verification status" : "Creating invoice",
    )

    try {
      const activeInvoice = isInvoiceStale
        ? await createEtokenDbReviewInvoice(token.tokenId, {
            authorAddress: ecashAddress,
            score,
            comment: sanitizedComment || undefined,
          })
        : invoice && (invoice.status === "pending" || invoice.status === "tx_submitted")
          ? invoice
          : await createEtokenDbReviewInvoice(token.tokenId, {
              authorAddress: ecashAddress,
              score,
              comment: sanitizedComment || undefined,
            })

      if (mountedRef.current) {
        setInvoice(activeInvoice)
      }
      persistSessionForCurrentToken({
        invoiceId: activeInvoice.invoiceId,
        score: activeInvoice.score,
        comment: activeInvoice.comment,
        txid: activeInvoice.paymentTxid,
      })

      if (activeInvoice.status === "pending") {
        setStatusMessage(`Paying ${activeInvoice.expectedPaidXec} XEC`)
        const txid = await payInvoice(activeInvoice)
        persistSessionForCurrentToken({
          invoiceId: activeInvoice.invoiceId,
          score: activeInvoice.score,
          comment: activeInvoice.comment,
          txid,
        })
        if (mountedRef.current) {
          setStatusMessage("Submitting payment txid")
        }

        const submittedInvoice = await submitEtokenDbReviewInvoiceTx(activeInvoice.invoiceId, {
          txid,
        })

        if (mountedRef.current) {
          setInvoice(submittedInvoice)
          setStatusMessage("Waiting for backend verification")
        }
        persistSessionForCurrentToken({
          invoiceId: submittedInvoice.invoiceId,
          score: submittedInvoice.score,
          comment: submittedInvoice.comment,
          txid,
        })
      } else if (mountedRef.current) {
        setStatusMessage("Waiting for backend verification")
      }

      const settledInvoice = await pollInvoiceUntilSettled(activeInvoice.invoiceId)
      await settleResolvedInvoice(settledInvoice)

      if (settledInvoice.status === "published") {
        toast({
          title: "Review published",
          description: "Your paid rating is now included in the token score.",
        })
        return
      }

      if (settledInvoice.status === "tx_submitted") {
        setStatusMessage("Payment seen. Publication is still pending in the backend queue.")
        toast({
          title: "Payment submitted",
          description: "The backend has your txid and will keep retrying verification.",
        })
        return
      }

      if (settledInvoice.status === "expired") {
        throw new Error("The review invoice expired before publication. Please try again.")
      }

      if (settledInvoice.status === "invalid") {
        throw new Error("The payment did not match the invoice requirements.")
      }

      throw new Error(`Unexpected invoice status: ${settledInvoice.status}`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to submit paid review."
      if (mountedRef.current) {
        setErrorMessage(message)
        setStatusMessage("")
      }

      toast({
        title: "Paid review failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      if (mountedRef.current) {
        setIsSubmitting(false)
      }
    }
  }, [
    ecashAddress,
    invoice,
    isCommentTooLong,
    isInvoiceStale,
    isAwaitingBackend,
    payInvoice,
    pollInvoiceUntilSettled,
    persistSessionForCurrentToken,
    sanitizedComment,
    score,
    settleResolvedInvoice,
    toast,
    token,
  ])

  if (!token) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden border-border/70 bg-white p-0 shadow-[0_28px_120px_-48px_rgba(0,0,0,0.85)] dark:bg-background sm:max-w-2xl">
        <DialogHeader className="shrink-0 gap-1.5 bg-white px-5 py-3.5 pr-14 dark:bg-background">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-xl tracking-tight">
              Rate {token.name}
            </DialogTitle>
            <Badge variant="outline" className="gap-1 rounded-full px-2.5 py-1">
              <Star className="size-3.5 fill-current" />
              <span>{currentAverage}</span>
            </Badge>
            {summary?.scorerCount ? (
              <Badge variant="secondary" className="rounded-full px-2.5 py-1">
                {summary.scorerCount} scorer{summary.scorerCount === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </div>
          <DialogDescription className="max-w-xl text-sm leading-6">
            Submit a paid rating from 1 to 10, with or without a comment.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white overscroll-contain dark:bg-background">
          <div className="flex flex-col gap-3.5 px-4 py-3.5 pb-4">
            <div className="rounded-2xl border border-border/60 bg-white p-3.5 dark:bg-muted/10">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="size-4 text-primary" />
                Current score
              </div>
              <div className="mt-3 flex items-end gap-3">
                <div className="text-3xl font-semibold tracking-tight">
                  {currentAverage}
                </div>
                <div className="pb-1 text-sm text-muted-foreground">
                  {summary?.reviewCountTotal || 0} paid review
                  {(summary?.reviewCountTotal || 0) === 1 ? "" : "s"}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{summary?.commentCountTotal || 0} with comments</span>
                <span>•</span>
                <span>{formatLastReviewAt(summary?.lastReviewAt ?? null)}</span>
              </div>
            </div>

            {!hasWalletAddress ? (
              <Alert className="border-primary/20 bg-primary/5">
                <Wallet className="size-4 text-primary" />
                <AlertTitle>Wallet login required</AlertTitle>
                <AlertDescription>
                  <span>
                    Use the normal login flow and connect your recovery-phrase wallet before submitting a paid review.
                  </span>
                </AlertDescription>
              </Alert>
            ) : !hasSigningWallet ? (
              <Alert className="border-primary/20 bg-primary/5">
                <Wallet className="size-4 text-primary" />
                <AlertTitle>Signing wallet required</AlertTitle>
                <AlertDescription>
                  Guest-mode or address-only sessions cannot publish paid reviews. Disconnect this wallet and log in with your recovery phrase.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-border/60 bg-white dark:bg-muted/15">
                <CheckCircle2 className="size-4 text-primary" />
                <AlertTitle>Connected</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center gap-2">
                  <span>{formatAddress(ecashAddress || "")}</span>
                  <span>•</span>
                  <span>Mnemonic-backed wallet ready</span>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-3 rounded-2xl border border-border/60 bg-white p-3.5 dark:bg-background">
              <div className="space-y-2">
                <Label>Select score</Label>
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                  {SCORE_OPTIONS.map((value) => {
                    const active = score === value
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setScore(value)}
                        className={cn(
                          "flex h-11 items-center justify-center rounded-2xl border text-sm font-semibold transition-colors",
                          active
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border/60 bg-white text-muted-foreground hover:border-primary/35 hover:text-foreground dark:bg-muted/10",
                        )}
                      >
                        {value}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="token-review-comment">Comment</Label>
                  <span
                    className={cn(
                      "text-xs",
                      isCommentTooLong ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {commentByteLength}/{COMMENT_MAX_BYTES} bytes
                  </span>
                </div>
                <Textarea
                  id="token-review-comment"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Optional paid comment"
                  className="min-h-[108px] rounded-2xl border-border/60 bg-white text-sm shadow-none placeholder:text-muted-foreground/60 dark:bg-muted/10"
                />
                <p className="text-xs text-muted-foreground">
                  Comments are public and stored as paid review records after verification.
                </p>
              </div>
            </div>

            {invoice ? (
              <div className="rounded-2xl border border-border/60 bg-white p-3.5 dark:bg-muted/10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Invoice status</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {invoice.status === "pending"
                        ? "Ready for payment"
                        : invoice.status === "tx_submitted"
                          ? "Payment txid submitted"
                          : invoice.status === "published"
                            ? "Published"
                            : invoice.status === "expired"
                              ? "Expired"
                              : "Invalid"}
                    </p>
                  </div>
                  <Badge variant="outline" className="rounded-full px-2.5 py-1 uppercase">
                    {invoice.status}
                  </Badge>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/60 bg-white p-3 dark:bg-background/75">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Amount
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                      {invoice.expectedPaidXec} XEC
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-white p-3 dark:bg-background/75">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Payment address
                    </p>
                    <p className="mt-2 break-all font-mono text-xs text-foreground/90">
                      {invoice.paymentAddress}
                    </p>
                  </div>
                </div>

                {invoice.paymentTxid ? (
                  <a
                    href={`https://explorer.e.cash/tx/${invoice.paymentTxid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 text-xs text-primary underline-offset-4 hover:underline"
                  >
                    View payment transaction
                    <ExternalLink className="size-3.5" />
                  </a>
                ) : null}
              </div>
            ) : null}

            {statusMessage ? (
              <Alert
                className={cn(
                  "border-primary/20 bg-primary/5",
                  !isSubmitting && "border-border/60 bg-white dark:bg-muted/15",
                )}
              >
                {isSubmitting ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  <CheckCircle2 className="size-4 text-primary" />
                )}
                <AlertTitle>Processing</AlertTitle>
                <AlertDescription>{statusMessage}</AlertDescription>
              </Alert>
            ) : null}

            {errorMessage ? (
              <Alert variant="destructive">
                <MessageSquareText className="size-4" />
                <AlertTitle>Submission failed</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}

            {isRefreshingSummary ? (
              <p className="text-xs text-muted-foreground">
                Refreshing review summary...
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 bg-white px-4 py-2.5 dark:bg-background sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmitReview()}
            disabled={!canSubmit}
            className="min-w-[180px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Processing
              </>
            ) : !hasWalletAddress ? (
              "Login required to submit"
            ) : !hasSigningWallet ? (
              "Mnemonic wallet required"
            ) : isAwaitingBackend ? (
              "Check publication status"
            ) : invoice && !isInvoiceStale && invoice.status === "pending" ? (
              `Pay ${submitFeeLabel} XEC and submit`
            ) : invoice?.status === "published" ? (
              "Published"
            ) : (
              `Pay ${submitFeeLabel} XEC fee and submit`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default TokenReviewDialog
