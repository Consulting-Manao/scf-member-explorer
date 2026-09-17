import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { missingSettings, type Env } from "./env";

const attester = Keypair.random();

const complete: Partial<Env> = {
  TESTNET_PASSPHRASE: "Test SDF Network ; September 2015",
  TESTNET_RPC_URL: "https://soroban-testnet.stellar.org",
  TESTNET_CONTRACT_ID: "C",
  TESTNET_ATTESTER_PUBLIC: attester.publicKey(),
  TESTNET_ATTESTER_SECRET: attester.secret(),
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

  it("refuses an attester secret that is not that network's attester", () => {
    expect(
      missingSettings({
        ...complete,
        TESTNET_ATTESTER_SECRET: Keypair.random().secret(),
      }),
    ).toEqual(["TESTNET_ATTESTER_SECRET (is not TESTNET_ATTESTER_PUBLIC)"]);
  });

  it("asks for a network when not one is complete", () => {
    expect(missingSettings({ ...complete, TESTNET_CONTRACT_ID: "" })).toEqual([
      expect.stringContaining("the settings of a network"),
    ]);
  });

  it("ignores a network that is only half configured", () => {
    // the mainnet passphrase and RPC are known long before its contract is
    // deployed: staging them serves nothing and breaks nothing
    expect(
      missingSettings({
        ...complete,
        MAINNET_PASSPHRASE: "Public Global Stellar Network ; September 2015",
        MAINNET_RPC_URL: "https://rpc.lightsail.network",
      }),
    ).toEqual([]);
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
