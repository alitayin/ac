"use client"

import * as React from "react"
import { Loader2, MessageSquareText, Star } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import TokenReviewDialog from "@/components/ui/TokenReviewDialog"
import {
  fetchEtokenDbTokenReviews,
  fetchEtokenDbTokenReviewSummary,
  type EtokenDbTokenReviewItem,
  type EtokenDbTokenReviewSummary,
} from "@/lib/etokendb"
import type { Token } from "@/lib/types"
import { cn } from "@/lib/utils"

type TokenCommentsPanelProps = {
  tokenId: string
  tokenName: string
  variant?: "main" | "sidebar"
  className?: string
}

const REVIEW_PAGE_SIZE = 50

const formatAverageScore = (value: number | null | undefined): string => {
  if (value === null || value === undefined) {
    return "Unrated"
  }

  return value.toFixed(1)
}

const formatReviewDate = (timestamp: number): string => {
  if (!timestamp) {
    return "Unknown time"
  }

  try {
    return new Date(timestamp).toLocaleString()
  } catch (_error) {
    return "Unknown time"
  }
}

export default function TokenCommentsPanel({
  tokenId,
  tokenName,
  variant = "main",
  className = "",
}: TokenCommentsPanelProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [summary, setSummary] = React.useState<EtokenDbTokenReviewSummary | null>(null)
  const [comments, setComments] = React.useState<EtokenDbTokenReviewItem[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState("")
  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!tokenId) {
        if (!cancelled) {
          setSummary(null)
          setComments([])
          setError("")
          setIsLoading(false)
        }
        return
      }

      if (!cancelled) {
        setIsLoading(true)
        setError("")
      }

      try {
        const [nextSummary, nextReviews] = await Promise.all([
          fetchEtokenDbTokenReviewSummary(tokenId),
          fetchEtokenDbTokenReviews(tokenId, {
            page: 1,
            pageSize: REVIEW_PAGE_SIZE,
          }),
        ])

        if (cancelled) {
          return
        }

        setSummary(nextSummary)
        setComments(
          nextReviews.items
            .filter((item) => item.comment.trim().length > 0)
            .sort((left, right) => right.createdAt - left.createdAt),
        )
      } catch (loadError) {
        if (cancelled) {
          return
        }

        setSummary(null)
        setComments([])
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load comments.",
        )
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [reloadKey, tokenId])

  const reviewDialogToken = React.useMemo<Pick<
    Token,
    | "tokenId"
    | "name"
    | "reviewAverageScore"
    | "reviewScorerCount"
    | "reviewCountTotal"
    | "reviewCommentCountTotal"
    | "lastReviewAt"
  > | null>(() => {
    if (!tokenId) {
      return null
    }

    return {
      tokenId,
      name: tokenName,
      reviewAverageScore: summary?.averageScore ?? null,
      reviewScorerCount: summary?.scorerCount ?? 0,
      reviewCountTotal: summary?.reviewCountTotal ?? 0,
      reviewCommentCountTotal: summary?.commentCountTotal ?? 0,
      lastReviewAt: summary?.lastReviewAt ?? null,
    }
  }, [summary, tokenId, tokenName])

  const averageScoreLabel = formatAverageScore(summary?.averageScore)
  const reviewCountTotal = summary?.reviewCountTotal ?? 0
  const commentCountTotal = summary?.commentCountTotal ?? 0
  const hiddenCommentCount = Math.max(0, commentCountTotal - comments.length)

  return (
    <>
      <Card className={cn("rounded-3xl", className)}>
        <CardHeader
          className={cn(
            "gap-4",
            variant === "sidebar"
              ? "flex flex-row items-start justify-between"
              : "flex flex-col sm:flex-row sm:items-start sm:justify-between",
          )}
        >
          <div className="space-y-1">
            <CardTitle className="text-lg font-medium">Comments</CardTitle>
            <p className="text-sm text-muted-foreground">
              {variant === "sidebar"
                ? "Latest paid comments"
                : "Paid comments and ratings for this token."}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size={variant === "sidebar" ? "sm" : "default"}
            onClick={() => setDialogOpen(true)}
          >
            Add review
          </Button>
        </CardHeader>

        <CardContent className={cn("space-y-4", variant === "main" && "space-y-5")}>
          <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Average score
                </p>
                <div className="mt-2 flex items-end gap-3">
                  <div className="text-3xl font-semibold tracking-tight">
                    {averageScoreLabel}
                  </div>
                  <div className="pb-1 text-sm text-muted-foreground">
                    {summary?.scorerCount ?? 0} scorer
                    {(summary?.scorerCount ?? 0) === 1 ? "" : "s"}
                  </div>
                </div>
              </div>

              <Badge variant="secondary" className="rounded-full px-2.5 py-1">
                <Star className="mr-1 size-3.5 fill-current" />
                {commentCountTotal} comment{commentCountTotal === 1 ? "" : "s"}
              </Badge>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>{reviewCountTotal} paid review{reviewCountTotal === 1 ? "" : "s"}</span>
              {summary?.lastReviewAt ? (
                <>
                  <span>•</span>
                  <span>Updated {formatReviewDate(summary.lastReviewAt)}</span>
                </>
              ) : null}
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/10 px-4 py-5 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading comments...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-destructive">Failed to load comments</p>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setReloadKey((current) => current + 1)}
              >
                Retry
              </Button>
            </div>
          ) : comments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/5 p-5 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <MessageSquareText className="size-4 text-muted-foreground" />
                No paid comments yet
              </div>
              <p className="mt-2 leading-6 text-muted-foreground">
                {reviewCountTotal > 0
                  ? "This token already has ratings, but none of them include a written comment yet."
                  : "Be the first to rate this token and leave a comment."}
              </p>
            </div>
          ) : (
            <div
              className={cn(
                "space-y-3",
                variant === "sidebar"
                  ? "max-h-[34rem] overflow-y-auto pr-1"
                  : "max-h-[52rem] overflow-y-auto pr-1",
              )}
            >
              {comments.map((item) => (
                <article
                  key={item.reviewId}
                  className="rounded-2xl border border-border/60 bg-background/70 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.authorMasked}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatReviewDate(item.createdAt)}
                      </p>
                    </div>

                    <Badge variant="outline" className="shrink-0 rounded-full px-2.5 py-1">
                      <Star className="mr-1 size-3.5 fill-current" />
                      {item.score}/10
                    </Badge>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-foreground/90">
                    {item.comment.trim()}
                  </p>
                </article>
              ))}
            </div>
          )}

          {!isLoading && !error && hiddenCommentCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              Showing the latest {comments.length} comments out of {commentCountTotal}.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <TokenReviewDialog
        open={dialogOpen}
        token={reviewDialogToken}
        onOpenChange={setDialogOpen}
        onPublished={(_publishedTokenId, nextSummary) => {
          setSummary(nextSummary)
          setReloadKey((current) => current + 1)
        }}
      />
    </>
  )
}
