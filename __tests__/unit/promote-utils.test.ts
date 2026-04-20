import { describe, expect, it } from "vitest";

import { calculatePromoteFeeSats, getPromoteFeeRecipients } from "@/lib/promote/fee";
import {
  ALP_MAX_BATCH_SIZE,
  SLP_MAX_BATCH_SIZE,
  buildMessageBatchPlan,
  buildTokenDistributionPlan,
  getMaxTokenBatchSize,
  mergeRecipients,
  parseManualAddresses,
  validateMessageInput,
} from "@/lib/promote/utils";

describe("promote utils", () => {
  it("parses manual addresses, removes duplicates, and reports invalid entries", () => {
    const result = parseManualAddresses(`
      ecash:qzey4jkh2x23q2zngq50z8uxgw0ek4xazgh65we6y0
      ecash:qzey4jkh2x23q2zngq50z8uxgw0ek4xazgh65we6y0,
      not-an-address
      ecash:qpaw7v7sfvlsm4px33saggr63jgsalsx4q49m7n6v4
    `);

    expect(result.addresses).toEqual([
      "ecash:qzey4jkh2x23q2zngq50z8uxgw0ek4xazgh65we6y0",
      "ecash:qpaw7v7sfvlsm4px33saggr63jgsalsx4q49m7n6v4",
    ]);
    expect(result.duplicateCount).toBe(1);
    expect(result.invalidEntries).toEqual(["not-an-address"]);
  });

  it("merges holder and manual recipients without losing source metadata", () => {
    const recipients = mergeRecipients(
      [
        {
          address: "ecash:qzey4jkh2x23q2zngq50z8uxgw0ek4xazgh65we6y0",
          atoms: 50n,
        },
      ],
      [
        "ecash:qzey4jkh2x23q2zngq50z8uxgw0ek4xazgh65we6y0",
        "ecash:qpaw7v7sfvlsm4px33saggr63jgsalsx4q49m7n6v4",
      ],
    );

    expect(recipients).toHaveLength(2);
    expect(recipients[0]).toEqual({
      address: "ecash:qzey4jkh2x23q2zngq50z8uxgw0ek4xazgh65we6y0",
      sources: ["holders", "manual"],
      holdingAtoms: 50n,
    });
    expect(recipients[1]).toEqual({
      address: "ecash:qpaw7v7sfvlsm4px33saggr63jgsalsx4q49m7n6v4",
      sources: ["manual"],
      holdingAtoms: 0n,
    });
  });

  it("builds an exact proportional token plan", () => {
    const plan = buildTokenDistributionPlan(
      [
        {
          address: "ecash:qzey4jkh2x23q2zngq50z8uxgw0ek4xazgh65we6y0",
          sources: ["holders"],
          holdingAtoms: 3n,
        },
        {
          address: "ecash:qpaw7v7sfvlsm4px33saggr63jgsalsx4q49m7n6v4",
          sources: ["holders"],
          holdingAtoms: 1n,
        },
      ],
      "proportional",
      10n,
      0n,
    );

    expect(plan.map((recipient) => recipient.amountAtoms)).toEqual([8n, 2n]);
    expect(
      plan.reduce((total, recipient) => total + recipient.amountAtoms, 0n),
    ).toBe(10n);
  });

  it("returns protocol-aware token batch sizes", () => {
    expect(getMaxTokenBatchSize("SLP")).toBe(SLP_MAX_BATCH_SIZE);
    expect(getMaxTokenBatchSize("ALP")).toBe(ALP_MAX_BATCH_SIZE);
    expect(getMaxTokenBatchSize("UNKNOWN")).toBe(SLP_MAX_BATCH_SIZE);
  });

  it("validates XEC app message byte length", () => {
    expect(validateMessageInput("hello world")).toBeNull();
    expect(validateMessageInput("a".repeat(216))).toMatch(/215 byte limit/);
  });

  it("applies the active promote fee by mode", () => {
    expect(calculatePromoteFeeSats("token-airdrop")).toBe(10_000n);
    expect(calculatePromoteFeeSats("platform-message")).toBe(10_000n);

    const enabledConfig = {
      enabled: true,
      address: "ecash:qzey4jkh2x23q2zngq50z8uxgw0ek4xazgh65we6y0",
      tokenAirdropSats: 200n,
      messageBroadcastSats: 300n,
      tokenAirdropLabel: "test token",
      messageBroadcastLabel: "test message",
    } as const;

    expect(calculatePromoteFeeSats("token-airdrop", enabledConfig)).toBe(200n);
    expect(calculatePromoteFeeSats("platform-message", enabledConfig)).toBe(300n);
    expect(getPromoteFeeRecipients("platform-message", enabledConfig)).toEqual([
      {
        address: enabledConfig.address,
        amount: 300n,
      },
    ]);
  });

  it("builds multiple message batches when one transaction would be too large", () => {
    const recipients = Array.from({ length: 3000 }, (_, index) => ({
      address:
        index % 2 === 0
          ? "ecash:qzey4jkh2x23q2zngq50z8uxgw0ek4xazgh65we6y0"
          : "ecash:qpaw7v7sfvlsm4px33saggr63jgsalsx4q49m7n6v4",
      sources: ["manual"] as const,
      holdingAtoms: 0n,
    })).map((recipient, index) => ({
      ...recipient,
      address:
        index === 0
          ? "ecash:qzey4jkh2x23q2zngq50z8uxgw0ek4xazgh65we6y0"
          : `ecash:qq${index.toString(16).padStart(40, "0").slice(0, 40)}`,
    }));

    const plan = buildMessageBatchPlan(
      recipients,
      [5_000_000n],
      "One clean message for every holder.",
    );

    expect(plan.blockedReason).toBeNull();
    expect(plan.batches.length).toBeGreaterThan(1);
    expect(plan.estimates.every((estimate) => estimate.feasible)).toBe(true);
  });

  it("blocks message batching when wallet has no spendable XEC utxos", () => {
    const plan = buildMessageBatchPlan(
      [
        {
          address: "ecash:qzey4jkh2x23q2zngq50z8uxgw0ek4xazgh65we6y0",
          sources: ["manual"],
          holdingAtoms: 0n,
        },
      ],
      [],
      "Hello",
    );

    expect(plan.batches).toEqual([]);
    expect(plan.blockedReason).toMatch(/Wallet balance|UTXOs/);
  });
});
