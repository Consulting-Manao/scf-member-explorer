import { sign, verify } from "hono/jwt";

import { PROVIDERS, type Claim } from "@shared/membership";

/** Claims are valid for a day: long enough to finish onboarding. */
export const CLAIM_TTL_SECONDS = 24 * 3600;

export async function signClaim(
  claim: Claim,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): Promise<string> {
  return sign(
    {
      sub: claim.address,
      provider: claim.provider,
      id: claim.id,
      handle: claim.handle,
      ...(claim.emailHash ? { email_hash: claim.emailHash } : {}),
      ...(claim.role !== undefined ? { role: claim.role } : {}),
      iat: now,
      exp: now + CLAIM_TTL_SECONDS,
    },
    secret,
    "HS256",
  );
}

/** Verify signature and expiry of a claim token. */
export async function verifyClaim(
  token: string,
  secret: string,
): Promise<Claim> {
  const payload = await verify(token, secret, "HS256");
  const provider = payload.provider as Claim["provider"];
  if (
    typeof payload.sub !== "string" ||
    !PROVIDERS.includes(provider) ||
    typeof payload.id !== "string" ||
    typeof payload.handle !== "string"
  ) {
    throw new Error("Malformed claim");
  }
  return {
    address: payload.sub,
    provider,
    id: payload.id,
    handle: payload.handle,
    emailHash:
      typeof payload.email_hash === "string" ? payload.email_hash : undefined,
    role: typeof payload.role === "number" ? payload.role : undefined,
  };
}
