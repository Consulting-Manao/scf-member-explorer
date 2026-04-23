import { describe, it, expect } from "vitest";
import { formatWithDecimals } from "@/lib/format";

describe("formatWithDecimals", () => {
  it("returns the value as-is when decimals is undefined", () => {
    expect(formatWithDecimals(1234)).toBe("1234");
    expect(formatWithDecimals("1234")).toBe("1234");
  });

  it("returns the value as-is when decimals is 0", () => {
    expect(formatWithDecimals(1234n, 0)).toBe("1234");
  });

  it("scales a bigint by the given decimals", () => {
    expect(formatWithDecimals(1234567890n, 6)).toBe("1234.56789");
  });

  it("trims trailing zeros from the fractional portion", () => {
    expect(formatWithDecimals(1500000n, 6)).toBe("1.5");
    expect(formatWithDecimals(1000000n, 6)).toBe("1");
  });

  it("pads short fractional remainders with leading zeros", () => {
    // 5 / 1e6 = 0.000005
    expect(formatWithDecimals(5n, 6)).toBe("0.000005");
  });

  it("accepts string input", () => {
    expect(formatWithDecimals("1234567890", 6)).toBe("1234.56789");
  });

  it("accepts number input", () => {
    expect(formatWithDecimals(1500000, 6)).toBe("1.5");
  });
});
