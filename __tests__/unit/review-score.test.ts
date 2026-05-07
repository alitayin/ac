import { describe, expect, it } from "vitest"

import {
  DEFAULT_REVIEW_SCORE,
  formatDisplayReviewScore,
  getDisplayReviewScore,
  getReviewScoreToneClasses,
  getReviewStarFillPercentages,
  getSortableReviewScore,
  REVIEW_UNRATED_LABEL,
} from "@/lib/review-score"

describe("review-score helpers", () => {
  it("keeps the review input default separate from unrated display", () => {
    expect(DEFAULT_REVIEW_SCORE).toBe(1)
    expect(getDisplayReviewScore(null)).toBeNull()
    expect(formatDisplayReviewScore(undefined)).toBe(REVIEW_UNRATED_LABEL)
    expect(getSortableReviewScore(undefined)).toBe(0)
  })

  it("uses the same neutral tone for rated scores", () => {
    expect(getReviewScoreToneClasses(1)).toEqual(getReviewScoreToneClasses(6))
    expect(getReviewScoreToneClasses(6)).toEqual(getReviewScoreToneClasses(10))
  })

  it("gives selected score buttons a primary active state", () => {
    expect(getReviewScoreToneClasses(6).buttonActive).toContain("bg-primary")
    expect(getReviewScoreToneClasses(6).buttonActive).toContain(
      "text-primary-foreground",
    )
  })

  it("uses a separate muted tone when no score exists", () => {
    expect(getReviewScoreToneClasses(null)).not.toEqual(getReviewScoreToneClasses(1))
  })

  it("maps 10-point scores to proportional five-star fills", () => {
    expect(getReviewStarFillPercentages(10)).toEqual([100, 100, 100, 100, 100])
    expect(getReviewStarFillPercentages(5)).toEqual([100, 100, 50, 0, 0])
    expect(getReviewStarFillPercentages(null)).toEqual([0, 0, 0, 0, 0])
  })
})
