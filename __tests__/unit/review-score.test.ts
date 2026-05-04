import { describe, expect, it } from "vitest"

import {
  DEFAULT_REVIEW_SCORE,
  formatDisplayReviewScore,
  getDisplayReviewScore,
  getReviewScoreToneClasses,
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

  it("uses a separate muted tone when no score exists", () => {
    expect(getReviewScoreToneClasses(null)).not.toEqual(getReviewScoreToneClasses(1))
  })
})
