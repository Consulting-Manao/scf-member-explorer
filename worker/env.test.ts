import { describe, expect, it } from "vitest";

import { missingSettings, type Env } from "./env";

const complete: Partial<Env> = {
  NETWORK: "testnet",
  NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  RPC_URL: "https://soroban-testnet.stellar.org",
  CONTRACT_ID: "C",
  ATTESTER_PUBLIC: "G",
  ATTESTER_SECRET: "S",
  CLAIMS_SECRET: "x",
  IPFS_GATEWAY: "https://ipfs.filebase.io/ipfs/",
  PGATLAS_URL: "https://api.pgatlas.xyz",
  ROLE_SOURCE: "discord",
  DISCORD_CLIENT_ID: "1",
  DISCORD_CLIENT_SECRET: "s",
  DISCORD_GUILD_ID: "897514728459468821",
  DISCORD_ROLE_MAP: '{"1082331251899379762":3}',
  GITHUB_CLIENT_ID: "2",
  GITHUB_CLIENT_SECRET: "s",
  FILEBASE_TOKEN: "t",
};

describe("missingSettings", () => {
  it("names exactly the missing settings", () => {
    expect(missingSettings(complete)).toEqual([]);
    expect(
      missingSettings({
        ...complete,
        DISCORD_CLIENT_ID: "",
        FILEBASE_TOKEN: "",
      }),
    ).toEqual(["DISCORD_CLIENT_ID", "FILEBASE_TOKEN"]);
  });

  it("refuses an empty or invalid role map when roles come from Discord", () => {
    expect(missingSettings({ ...complete, DISCORD_ROLE_MAP: "{}" })).toEqual([
      "DISCORD_ROLE_MAP (role id to 0-3, not empty)",
    ]);
    expect(
      missingSettings({ ...complete, DISCORD_ROLE_MAP: '{"1":9}' }),
    ).toHaveLength(1);
    expect(missingSettings({ ...complete, DISCORD_ROLE_MAP: "nope" })).toEqual([
      "DISCORD_ROLE_MAP (invalid JSON)",
    ]);
    expect(
      missingSettings({
        ...complete,
        ROLE_SOURCE: "verified",
        DISCORD_ROLE_MAP: "{}",
      }),
    ).toEqual([]);
  });
});
