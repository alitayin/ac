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
  partitionP2pkhRecipients,
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
    expect(SLP_MAX_BATCH_SIZE).toBe(18);
    expect(ALP_MAX_BATCH_SIZE).toBe(28);
    expect(getMaxTokenBatchSize("SLP")).toBe(18);
    expect(getMaxTokenBatchSize("ALP")).toBe(28);
    expect(getMaxTokenBatchSize("UNKNOWN")).toBe(18);
  });

  it("separates P2PKH recipients from unsupported P2SH recipients", () => {
    const recipients = [
      {
        address: "ecash:qzey4jkh2x23q2zngq50z8uxgw0ek4xazgh65we6y0",
        sources: ["holders"] as const,
        holdingAtoms: 50n,
      },
      {
        address: "ecash:prt9avp9jlcc9u0zhpagyuct047prywa55t9pk8t5n",
        sources: ["manual"] as const,
        holdingAtoms: 0n,
      },
    ];

    const result = partitionP2pkhRecipients(recipients);

    expect(result.supported).toHaveLength(1);
    expect(result.supported[0].address).toBe(
      "ecash:qzey4jkh2x23q2zngq50z8uxgw0ek4xazgh65we6y0",
    );
    expect(result.unsupported).toHaveLength(1);
    expect(result.unsupported[0].address).toBe(
      "ecash:prt9avp9jlcc9u0zhpagyuct047prywa55t9pk8t5n",
    );
  });

  it("validates XEC app message byte length", () => {
    expect(validateMessageInput("hello world")).toBeNull();
    expect(validateMessageInput("a".repeat(216))).toMatch(/215 byte limit/);
  });

  it("applies the active promote fee by mode", () => {
    expect(calculatePromoteFeeSats("token-airdrop", 1)).toBe(10_000n);
    expect(calculatePromoteFeeSats("platform-message", 1)).toBe(10_000n);
    expect(calculatePromoteFeeSats("token-airdrop", 3)).toBe(30_000n);
    expect(calculatePromoteFeeSats("platform-message", 0)).toBe(0n);

    const enabledConfig = {
      enabled: true,
      address: "ecash:qzey4jkh2x23q2zngq50z8uxgw0ek4xazgh65we6y0",
      tokenAirdropSats: 200n,
      messageBroadcastSats: 300n,
      tokenAirdropLabel: "test token",
      messageBroadcastLabel: "test message",
    } as const;

    expect(calculatePromoteFeeSats("token-airdrop", 4, enabledConfig)).toBe(800n);
    expect(calculatePromoteFeeSats("platform-message", 3, enabledConfig)).toBe(900n);
    expect(getPromoteFeeRecipients("platform-message", 3, enabledConfig)).toEqual([
      {
        address: enabledConfig.address,
        amount: 900n,
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
