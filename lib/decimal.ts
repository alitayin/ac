export const parseDecimalToAtoms = (
  value: string,
  decimals: number,
): bigint | null => {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }

  const safeDecimals = Number.isFinite(decimals)
    ? Math.max(0, Math.trunc(decimals))
    : 0;
  const [integerPart, fractionPart = ""] = trimmed.split(".");

  if (fractionPart.length > safeDecimals) {
    return null;
  }

  const normalizedFraction = `${fractionPart}${"0".repeat(safeDecimals)}`.slice(
    0,
    safeDecimals,
  );

  try {
    return BigInt(`${integerPart}${normalizedFraction}`);
  } catch {
    return null;
  }
};
