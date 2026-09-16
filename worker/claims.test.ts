import { describe, expect, it } from "vitest";

import { CLAIM_TTL_SECONDS, signClaim, verifyClaim } from "./claims";

const claim = {
  address: "GABC",
  provider: "discord" as const,
  id: "1",
  handle: "grogu",
  role: 2,
  emailHash: "ab".repeat(32),
};

describe("claims", () => {
  it("round-trips", async () => {
    const token = await signClaim(claim, "secret");
    expect(await verifyClaim(token, "secret")).toEqual(claim);
  });

  it("rejects another secret", async () => {
    const token = await signClaim(claim, "secret");
    await expect(verifyClaim(token, "other")).rejects.toThrow();
  });

  it("rejects expired claims", async () => {
    const past = Math.floor(Date.now() / 1000) - CLAIM_TTL_SECONDS - 1;
    const token = await signClaim(claim, "secret", past);
    await expect(verifyClaim(token, "secret")).rejects.toThrow();
  });
});
