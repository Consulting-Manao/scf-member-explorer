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
  X_CLIENT_ID: string;

  // secrets
  ATTESTER_SECRET: string;
  CLAIMS_SECRET: string;
  DISCORD_CLIENT_SECRET: string;
  GITHUB_CLIENT_SECRET: string;
  X_CLIENT_SECRET: string;
  FILEBASE_TOKEN: string;
}
