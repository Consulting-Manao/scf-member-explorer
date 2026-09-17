/**
 * A claim is what the worker hands back after an OAuth exchange, so that a
 * later attestation request can prove the worker itself verified the
 * account. It is signed by the attester key: `base64url(payload).base64url(signature)`.
 */

import type { Keypair } from "@stellar/stellar-sdk";

import type { Claim } from "@shared/membership";

/** Claims are valid for a day: long enough to finish onboarding. */
export const CLAIM_TTL_SECONDS = 24 * 3600;

const encode = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");
const decode = (text: string) => Buffer.from(text, "base64url");

export function signClaim(
  claim: Claim,
  attester: Keypair,
  now = Math.floor(Date.now() / 1000),
): string {
  // the plain email stays in the browser: only its hash is ever checked
  const { email: _email, ...signed } = claim;
  const payload = Buffer.from(
    JSON.stringify({ ...signed, exp: now + CLAIM_TTL_SECONDS }),
  );
  return `${encode(payload)}.${encode(attester.sign(payload))}`;
}

/** Verify signature and expiry of a claim token. */
export function verifyClaim(token: string, attester: Keypair): Claim {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) throw new Error("Malformed claim");
  const bytes = decode(payload);
  if (!attester.verify(bytes, decode(signature))) {
    throw new Error("Claim not signed by the attester");
  }
  const { exp, ...claim } = JSON.parse(bytes.toString()) as Claim & {
    exp: number;
  };
  if (exp <= Math.floor(Date.now() / 1000)) throw new Error("Claim expired");
  return claim;
}
