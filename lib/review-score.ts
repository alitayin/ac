export const DEFAULT_REVIEW_SCORE = 1
export const REVIEW_STAR_ICON_CLASS = "text-amber-500 dark:text-amber-400"
export const REVIEW_UNRATED_LABEL = "Unrated"
export const REVIEW_UNRATED_TOOLTIP =
  "No paid ratings yet. This token is still unproven."
export const REVIEW_UNRATED_STAR_ICON_CLASS = "text-muted-foreground/60"
export const REVIEW_STAR_COUNT = 5

export const getDisplayReviewScore = (
  score: number | null | undefined,
): number | null => {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return null
  }

  return Math.max(0, Math.min(10, score))
}

export const formatDisplayReviewScore = (
  score: number | null | undefined,
): string => {
  const displayScore = getDisplayReviewScore(score)
  return displayScore === null ? REVIEW_UNRATED_LABEL : displayScore.toFixed(1)
}

export const getSortableReviewScore = (
  score: number | null | undefined,
): number => {
  return getDisplayReviewScore(score) ?? 0
}

export const getReviewStarFillPercentages = (
  score: number | null | undefined,
  starCount: number = REVIEW_STAR_COUNT,
): number[] => {
  const displayScore = getDisplayReviewScore(score)
  const safeStarCount = Math.max(0, Math.floor(starCount))

  if (displayScore === null || safeStarCount === 0) {
    return Array.from({ length: safeStarCount }, () => 0)
  }

  const filledStars = (displayScore / 10) * safeStarCount
  return Array.from({ length: safeStarCount }, (_, index) => {
    const fill = Math.max(0, Math.min(1, filledStars - index))
    return Math.round(fill * 100)
  })
}

export const getReviewScoreToneClasses = (
  score: number | null | undefined,
): {
  badge: string
  button: string
  buttonActive: string
  text: string
} => {
  if (getDisplayReviewScore(score) === null) {
    return {
      badge: "border-border bg-muted/30 text-muted-foreground",
      button:
        "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      buttonActive:
        "border-border bg-muted/50 text-foreground shadow-sm hover:bg-muted/50",
      text: "text-muted-foreground",
    }
  }

  return {
    badge:
      "border-zinc-300 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300",
    button:
      "border-zinc-300 bg-zinc-100 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-100",
    buttonActive:
      "border-primary bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/25 hover:bg-primary/90",
    text: "text-zinc-600 dark:text-zinc-300",
  }
}
