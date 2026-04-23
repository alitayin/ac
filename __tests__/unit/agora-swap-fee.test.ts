import { describe, expect, it } from "vitest";
import {
  AGORA_SWAP_FEE_MIN_XEC,
  calculateAgoraFeeSummary,
  calculateAgoraSwapFeeSats,
  estimateAgoraTokenCostFromBudget,
  getMinimumAgoraBuyFeesXec,
} from "@/lib/agora-swap-fee";

describe("agora-swap-fee", () => {
  it("applies the dust floor for small trades", () => {
    expect(calculateAgoraSwapFeeSats(10_000n)).toBe(546n);
  });

  it("applies the proportional rate for larger trades", () => {
    expect(calculateAgoraSwapFeeSats(200_000n)).toBe(1000n);
  });

  it("builds a combined fee summary", () => {
    const summary = calculateAgoraFeeSummary(100, 10);

    expect(summary.tokenCostXec).toBe(100);
    expect(summary.networkFeeXec).toBe(10);
    expect(summary.swapFeeXec).toBe(AGORA_SWAP_FEE_MIN_XEC);
    expect(summary.totalFeesXec).toBeCloseTo(15.46, 2);
    expect(summary.totalCostXec).toBeCloseTo(115.46, 2);
  });

  it("estimates spendable token budget from a total XEC budget", () => {
    const spendable = estimateAgoraTokenCostFromBudget(200, 10);
    const summary = calculateAgoraFeeSummary(spendable, 10);

    expect(spendable).toBeCloseTo(184.54, 2);
    expect(summary.totalCostXec).toBeCloseTo(200, 2);
  });

  it("returns zero spendable token budget when total budget cannot cover minimum fees", () => {
    expect(estimateAgoraTokenCostFromBudget(15.46, 10)).toBe(0);
    expect(estimateAgoraTokenCostFromBudget(15.45, 10)).toBe(0);
  });

  it("exposes the minimum fees required for any non-zero buy", () => {
    expect(getMinimumAgoraBuyFeesXec(10)).toBe(15.46);
  });
});
