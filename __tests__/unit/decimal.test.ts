import { describe, expect, it } from "vitest";

import { parseDecimalToAtoms } from "@/lib/decimal";

describe("decimal utils", () => {
  it("parses display-unit decimals into exact atoms", () => {
    expect(parseDecimalToAtoms("1.234567", 6)).toBe(1_234_567n);
    expect(parseDecimalToAtoms("1.2", 6)).toBe(1_200_000n);
    expect(parseDecimalToAtoms("42", 0)).toBe(42n);
  });

  it("rejects values that cannot be represented at token precision", () => {
    expect(parseDecimalToAtoms("1.2345678", 6)).toBeNull();
    expect(parseDecimalToAtoms("-1", 6)).toBeNull();
    expect(parseDecimalToAtoms("1e-6", 6)).toBeNull();
    expect(parseDecimalToAtoms("", 6)).toBeNull();
  });
});
