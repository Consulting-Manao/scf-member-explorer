/**
 * Definitions shared by the app and the worker. Mirrors the constants and
 * enums of the stellar-membership contract.
 */

export const PROVIDERS = ["discord", "github", "x"] as const;
export type ProviderName = (typeof PROVIDERS)[number];

/** `Provider` enum of the contract. */
export const PROVIDER_ID: Record<ProviderName, number> = {
  discord: 0,
  github: 1,
  x: 2,
};

export const PROVIDER_LABEL: Record<ProviderName, string> = {
  discord: "Discord",
  github: "GitHub",
  x: "X",
};

export function providerName(id: number): ProviderName {
  const name = PROVIDERS[id];
  if (!name) throw new Error(`Unknown provider ${id}`);
  return name;
}

/** `Role` enum of the contract. */
export const ROLES = ["Verified", "Pathfinder", "Navigator", "Pilot"] as const;
export type RoleName = (typeof ROLES)[number];

export const MAX_PROJECTS = 10;
export const MAX_PROJECT_LEN = 128;
export const MAX_BIO_LEN = 128;
export const MAX_ACCOUNT_LEN = 64;
export const RECOVERY_DELAY_SECONDS = 7 * 24 * 3600;

/** An external account verified by the worker through OAuth. */
export interface Claim {
  /** Address the claim was issued for. */
  address: string;
  provider: ProviderName;
  /** Stable account id on the provider. */
  id: string;
  handle: string;
  /** Hex sha256 of the normalized verified email, if the provider has one. */
  emailHash?: string;
  /** The verified email itself, for its owner to see; never stored. */
  email?: string;
  /** Role derived from the Discord roles, only on Discord claims. */
  role?: number;
}

export interface SocialAccount {
  provider: number;
  id: string;
  handle: string;
}

/** Public configuration served by the worker on `/api/config`. */
export interface AppConfig {
  network: "testnet" | "mainnet";
  networkPassphrase: string;
  rpcUrl: string;
  contractId: string;
  attester: string;
  ipfsGateway: string;
  roleSource: "discord" | "verified";
  oauth: Partial<Record<ProviderName, string>>;
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  }
  return bytes;
}

/** sha256 of the trimmed, lowercased email, as done by PG Atlas. */
export async function hashEmail(email: string): Promise<string> {
  const data = new TextEncoder().encode(email.trim().toLowerCase());
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", data)));
}

/**
 * External accounts of the contract from verified claims, ordered by
 * provider. The email hash is taken from `emailFrom` when it has one.
 */
export function accountsFromClaims(
  claims: Claim[],
  emailFrom?: ProviderName,
): { accounts: SocialAccount[]; emailHash?: string } {
  const accounts = [...claims]
    .sort((a, b) => PROVIDER_ID[a.provider] - PROVIDER_ID[b.provider])
    .map((claim) => ({
      provider: PROVIDER_ID[claim.provider],
      id: claim.id,
      handle: claim.handle,
    }));
  const emailHash = claims.find((c) => c.provider === emailFrom)?.emailHash;
  return { accounts, emailHash };
}
