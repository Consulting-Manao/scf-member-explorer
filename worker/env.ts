export interface Env {
  ASSETS: Fetcher;
  RATE_LIMITER?: RateLimit;

  NETWORK: "testnet" | "mainnet";
  NETWORK_PASSPHRASE: string;
  RPC_URL: string;
  CONTRACT_ID: string;
  ATTESTER_PUBLIC: string;
  IPFS_GATEWAY: string;
  PGATLAS_URL: string;
  ROLE_SOURCE: "discord" | "verified";
  DISCORD_GUILD_ID: string;
  DISCORD_ROLE_MAP: string;
  DISCORD_CLIENT_ID: string;
  GITHUB_CLIENT_ID: string;
  /** X is optional: enabled when both id and secret are set. */
  X_CLIENT_ID?: string;

  // secrets
  ATTESTER_SECRET: string;
  CLAIMS_SECRET: string;
  DISCORD_CLIENT_SECRET: string;
  GITHUB_CLIENT_SECRET: string;
  X_CLIENT_SECRET?: string;
  FILEBASE_TOKEN: string;
}

const REQUIRED = [
  "NETWORK",
  "NETWORK_PASSPHRASE",
  "RPC_URL",
  "CONTRACT_ID",
  "ATTESTER_PUBLIC",
  "ATTESTER_SECRET",
  "CLAIMS_SECRET",
  "IPFS_GATEWAY",
  "PGATLAS_URL",
  "ROLE_SOURCE",
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
  "DISCORD_GUILD_ID",
  "DISCORD_ROLE_MAP",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "FILEBASE_TOKEN",
] as const;

/** Names of the missing or invalid settings, empty when the worker is usable. */
export function missingSettings(env: Partial<Env>): string[] {
  const missing: string[] = REQUIRED.filter((name) => !env[name]);
  if (env.ROLE_SOURCE === "discord" && env.DISCORD_ROLE_MAP) {
    try {
      const map = JSON.parse(env.DISCORD_ROLE_MAP) as Record<string, unknown>;
      if (
        Object.keys(map).length === 0 ||
        Object.values(map).some(
          (role) => typeof role !== "number" || role < 0 || role > 3,
        )
      ) {
        missing.push("DISCORD_ROLE_MAP (role id to 0-3, not empty)");
      }
    } catch {
      missing.push("DISCORD_ROLE_MAP (invalid JSON)");
    }
  }
  if (Boolean(env.X_CLIENT_ID) !== Boolean(env.X_CLIENT_SECRET)) {
    missing.push("X_CLIENT_ID and X_CLIENT_SECRET (both or none)");
  }
  return missing;
}

export function xEnabled(env: Env): boolean {
  return Boolean(env.X_CLIENT_ID && env.X_CLIENT_SECRET);
}
