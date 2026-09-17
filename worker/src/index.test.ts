import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { app } from "./index";
import type { Env } from "./env";

const attester = Keypair.random();

const env = {
  NETWORK: "testnet",
  NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  RPC_URL: "https://soroban-testnet.stellar.org",
  CONTRACT_ID: "CBXKUSLQPVF35FYURR5C42BPYA5UOVDXX2ELKIM2CAJMCI6HXG2BHGZA",
  ATTESTER_PUBLIC: attester.publicKey(),
  ATTESTER_SECRET: attester.secret(),
  IPFS_GATEWAY: "https://ipfs.filebase.io/ipfs/",
  PGATLAS_URL: "https://api.pgatlas.xyz",
  ROLE_SOURCE: "verified",
  DISCORD_CLIENT_ID: "1",
  DISCORD_CLIENT_SECRET: "s",
  DISCORD_GUILD_ID: "897514728459468821",
  DISCORD_ROLE_MAP: "{}",
  GITHUB_CLIENT_ID: "2",
  GITHUB_CLIENT_SECRET: "s",
  FILEBASE_TOKEN: "t",
} as Env;

function post(path: string, body: unknown, over: Partial<Env> = {}) {
  return app.request(
    path,
    { method: "POST", body: JSON.stringify(body) },
    { ...env, ...over },
  );
}

async function error(res: Response): Promise<string> {
  return ((await res.json()) as { error: string }).error;
}

describe("the API", () => {
  it("serves the public configuration", async () => {
    const res = await app.request("/api/config", {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      contractId: env.CONTRACT_ID,
      attester: attester.publicKey(),
      oauth: { discord: "1", github: "2" },
    });
  });

  it("names the missing settings on /config only", async () => {
    const broken = { ...env, FILEBASE_TOKEN: "" };
    const config = await app.request("/api/config", {}, broken);
    expect(config.status).toBe(500);
    expect(await error(config)).toContain("FILEBASE_TOKEN");

    const attest = await post("/api/attest", {}, { FILEBASE_TOKEN: "" });
    expect(attest.status).toBe(500);
    expect(await error(attest)).toBe("Worker not configured");
  });

  it("refuses an unknown provider and a malformed body", async () => {
    const unknown = await post("/api/oauth/myspace/exchange", {
      code: "c",
      codeVerifier: "v",
      redirectUri: "http://localhost:5173/oauth/callback/myspace",
      address: "G",
    });
    expect(unknown.status).toBe(404);

    const missing = await post("/api/oauth/github/exchange", { code: "c" });
    expect(missing.status).toBe(400);
    expect(await error(missing)).toBe("Missing parameters");

    const malformed = await app.request(
      "/api/attest",
      { method: "POST", body: "{" },
      env,
    );
    expect(malformed.status).toBe(400);
    expect(await error(malformed)).toBe("Malformed JSON body");
  });

  it("reports an attestation failure as a client error", async () => {
    const res = await post("/api/attest", {
      entry: "e",
      validUntilLedger: 1,
      claims: ["not-a-claim"],
    });
    expect(res.status).toBe(400);
    expect(await error(res)).toBe("Invalid or expired verification");
  });

  it("refuses more claims than there are providers", async () => {
    const res = await post("/api/attest", {
      entry: "e",
      validUntilLedger: 1,
      claims: ["a", "b", "c", "d"],
    });
    expect(res.status).toBe(400);
  });
});
