import { describe, expect, it } from "vitest";

import {
  accountsFromClaims,
  fromHex,
  hashEmail,
  toHex,
  type Claim,
} from "./membership";

describe("hashEmail", () => {
  it("matches PG Atlas: sha256 of the trimmed, lowercased email", async () => {
    // hashlib.sha256("grogu@example.com".encode()).hexdigest()
    const expected =
      "fbe25738a7a7d6cc6a007ea5b72262d3216a907e22f29e2e8e33362e1f17e5ca";
    expect(await hashEmail("  Grogu@Example.COM ")).toBe(expected);
    expect(toHex(fromHex(expected))).toBe(expected);
  });
});

describe("accountsFromClaims", () => {
  const claim = (provider: Claim["provider"], emailHash?: string): Claim => ({
    address: "G",
    provider,
    id: `${provider}-id`,
    handle: provider,
    emailHash,
  });

  it("orders by provider and picks the chosen email", () => {
    const result = accountsFromClaims(
      [claim("x"), claim("github", "bb"), claim("discord", "aa")],
      "github",
    );
    expect(result.accounts.map((a) => a.provider)).toEqual([0, 1, 2]);
    expect(result.emailHash).toBe("bb");
    expect(accountsFromClaims([claim("discord", "aa")]).emailHash).toBe(
      undefined,
    );
  });
});
