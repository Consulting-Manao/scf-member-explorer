import { Keypair } from "@stellar/stellar-sdk";

export const NETWORK_NAMES = ["testnet", "mainnet"] as const;
export type NetworkName = (typeof NETWORK_NAMES)[number];

export interface Env {
  /** Only bound under Workers; the Bun dev server and tests run without. */
  RATE_LIMITER?: RateLimit;

  IPFS_GATEWAY: string;
  PGATLAS_URL: string;
  ROLE_SOURCE: "discord" | "verified";
  DISCORD_GUILD_ID: string;
  DISCORD_ROLE_MAP: string;
  DISCORD_CLIENT_ID: string;
  GITHUB_CLIENT_ID: string;

  // Per network, `<NETWORK>_` prefixed. A network is served when it has all
  // five, so staging a few of them ahead of time serves nothing and breaks
  // nothing.
  TESTNET_PASSPHRASE?: string;
  TESTNET_RPC_URL?: string;
  TESTNET_CONTRACT_ID?: string;
  TESTNET_ATTESTER_PUBLIC?: string;
  MAINNET_PASSPHRASE?: string;
  MAINNET_RPC_URL?: string;
  MAINNET_CONTRACT_ID?: string;
  MAINNET_ATTESTER_PUBLIC?: string;

  // secrets
  TESTNET_ATTESTER_SECRET?: string;
  MAINNET_ATTESTER_SECRET?: string;
  DISCORD_CLIENT_SECRET: string;
  GITHUB_CLIENT_SECRET: string;
  FILEBASE_TOKEN: string;
}

/** What one network needs. Each has its own contract and its own attester. */
export interface NetworkConfig {
  network: NetworkName;
  networkPassphrase: string;
  rpcUrl: string;
  contractId: string;
  attesterPublic: string;
  attesterSecret: string;
}

/** Names of the settings of one network, in the order they are reported. */
const PER_NETWORK = [
  "PASSPHRASE",
  "RPC_URL",
  "CONTRACT_ID",
  "ATTESTER_PUBLIC",
  "ATTESTER_SECRET",
] as const;

const setting = (network: NetworkName, name: string) =>
  `${network.toUpperCase()}_${name}` as keyof Env;

const read = (env: Partial<Env>, network: NetworkName, name: string) =>
  env[setting(network, name)] as string | undefined;

/** The networks this worker has every setting for. */
export function servedNetworks(env: Partial<Env>): NetworkName[] {
  return NETWORK_NAMES.filter((network) =>
    PER_NETWORK.every((name) => read(env, network, name)),
  );
}

const SHARED = [
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
  const missing: string[] = SHARED.filter((name) => !env[name]);

  const served = servedNetworks(env);
  if (served.length === 0) {
    missing.push(
      `the settings of a network (${NETWORK_NAMES.map((name) => `${name.toUpperCase()}_…`).join(" or ")})`,
    );
  }
  for (const network of served) {
    const secret = read(env, network, "ATTESTER_SECRET");
    const local = setting(network, "ATTESTER_SECRET");
    const declared = read(env, network, "ATTESTER_PUBLIC");
    if (secret && declared) {
      try {
        if (Keypair.fromSecret(secret).publicKey() !== declared) {
          missing.push(
            `${local} (is not ${setting(network, "ATTESTER_PUBLIC")})`,
          );
        }
      } catch {
        missing.push(`${local} (not a secret key)`);
      }
    }
  }

  if (env.ROLE_SOURCE && !["discord", "verified"].includes(env.ROLE_SOURCE)) {
    missing.push("ROLE_SOURCE (discord or verified)");
  }
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
  return missing;
}

export class UnknownNetwork extends Error {}

/**
 * The settings of one network, by name.
 *
 * Naming a network picks all of its settings at once: passphrase, contract,
 * RPC and attester key always come from the same one, so a request says
 * which network it is for and can never mix two.
 */
export function resolveNetwork(env: Env, name: string): NetworkConfig {
  const served = servedNetworks(env);
  const network = served.find((candidate) => candidate === name);
  if (!network) {
    throw new UnknownNetwork(
      `This worker serves ${served.join(" and ")}, not ${name}`,
    );
  }
  return {
    network,
    networkPassphrase: read(env, network, "PASSPHRASE")!,
    rpcUrl: read(env, network, "RPC_URL")!,
    contractId: read(env, network, "CONTRACT_ID")!,
    attesterPublic: read(env, network, "ATTESTER_PUBLIC")!,
    attesterSecret: read(env, network, "ATTESTER_SECRET")!,
  };
}
