import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { CLAIM_TTL_SECONDS, signClaim, verifyClaim } from "./claims";

const attester = Keypair.random();
const claim = {
  address: "GABC",
  provider: "discord" as const,
  id: "1",
  handle: "grogu",
  role: 2,
  emailHash: "ab".repeat(32),
};

describe("claims", () => {
  it("round-trips", () => {
    expect(verifyClaim(signClaim(claim, attester), attester)).toEqual(claim);
  });

  it("rejects another signer", () => {
    const token = signClaim(claim, attester);
    expect(() => verifyClaim(token, Keypair.random())).toThrow("attester");
  });

  it("rejects expired claims", () => {
    const past = Math.floor(Date.now() / 1000) - CLAIM_TTL_SECONDS - 1;
    const token = signClaim(claim, attester, past);
    expect(() => verifyClaim(token, attester)).toThrow("expired");
  });

  it("rejects a tampered payload or a malformed token", () => {
    const [payload, signature] = signClaim(claim, attester).split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...claim, role: 3, exp: 2 ** 31 }),
    ).toString("base64url");
    expect(() => verifyClaim(`${forged}.${signature!}`, attester)).toThrow(
      "attester",
    );
    expect(() => verifyClaim(payload!, attester)).toThrow("Malformed claim");
  });

  it("keeps the email out of what it signs", () => {
    const token = signClaim({ ...claim, email: "grogu@example.org" }, attester);
    expect(verifyClaim(token, attester)).toEqual(claim);
  });
});
