import { describe, expect, it } from "vitest"

import {
  DEFAULT_REVIEW_SCORE,
  formatDisplayReviewScore,
  getDisplayReviewScore,
  getReviewScoreToneClasses,
} from "@/lib/review-score"

describe("review-score helpers", () => {
  it("falls back to the default score when no score exists", () => {
    expect(DEFAULT_REVIEW_SCORE).toBe(1)
    expect(getDisplayReviewScore(null)).toBe(1)
    expect(formatDisplayReviewScore(undefined)).toBe("1.0")
  })

  it("uses the same neutral tone for all scores", () => {
    expect(getReviewScoreToneClasses(1)).toEqual(getReviewScoreToneClasses(6))
    expect(getReviewScoreToneClasses(6)).toEqual(getReviewScoreToneClasses(10))
  })
})
