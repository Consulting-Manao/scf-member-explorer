/**
 * Format a fixed-point integer (string, number, or bigint) as a decimal string,
 * trimming trailing zeros from the fractional portion.
 *
 * Used to render Soroban dynamic-trait values whose `decimals` is declared in
 * the trait metadata document (e.g. `nqg_score` is stored as a scaled int).
 */
export function formatWithDecimals(value: unknown, decimals?: number): string {
  if (decimals === undefined || decimals === 0) return String(value);

  const divisor = BigInt(`1${"0".repeat(decimals)}`);
  const big = typeof value === "bigint" ? value : BigInt(String(value));
  const whole = big / divisor;
  const remainder = big % divisor;
  const fracStr = remainder.toString().padStart(decimals, "0").replace(/0+$/, "");

  return fracStr ? `${whole}.${fracStr}` : `${whole}`;
}
