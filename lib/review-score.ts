export const DEFAULT_REVIEW_SCORE = 1
export const REVIEW_STAR_ICON_CLASS = "text-amber-500 dark:text-amber-400"

export const getDisplayReviewScore = (
  score: number | null | undefined,
): number => {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return DEFAULT_REVIEW_SCORE
  }

  return Math.max(0, Math.min(10, score))
}

export const formatDisplayReviewScore = (
  score: number | null | undefined,
): string => {
  return getDisplayReviewScore(score).toFixed(1)
}

export const getReviewScoreToneClasses = (
  _score: number | null | undefined,
): {
  badge: string
  button: string
  buttonActive: string
  text: string
} => {
  return {
    badge:
      "border-zinc-300 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300",
    button:
      "border-zinc-300 bg-zinc-100 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-100",
    buttonActive:
      "border-zinc-400 bg-zinc-200 text-zinc-900 shadow-sm hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100",
    text: "text-zinc-600 dark:text-zinc-300",
  }
}
