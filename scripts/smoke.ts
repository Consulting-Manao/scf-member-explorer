/**
 * End-to-end smoke test on testnet: runs the member flows against the
 * deployed contract, through the worker API.
 *
 *   bun scripts/smoke.ts                          # worker in-process, .dev.vars
 *   CLAIMS_SECRET=… bun scripts/smoke.ts <origin>  # a running worker
 *
 * OAuth is skipped: claims are signed with the worker's CLAIMS_SECRET.
 * Accounts are created and funded with friendbot.
 */

import { readFile } from "node:fs/promises";

import { Keypair, xdr } from "@stellar/stellar-sdk";
import {
  basicNodeSigner,
  type AssembledTransaction,
} from "@stellar/stellar-sdk/contract";
import { Client } from "stellar-membership";

import { PROVIDER_ID, type AppConfig, type Claim } from "../shared/membership";
import { signClaim } from "../worker/claims";
import type { Env } from "../worker/env";
import { app } from "../worker/index";

const origin = process.argv[2];

/** Worker vars from wrangler.jsonc, overridden by .dev.vars. */
async function localEnv(): Promise<Env> {
  const jsonc = await readFile("wrangler.jsonc", "utf8");
  const wrangler = JSON.parse(
    jsonc.replace(/^\s*\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1"),
  );
  const dotVars = Object.fromEntries(
    (await readFile(".dev.vars", "utf8"))
      .split("\n")
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => [
        line.slice(0, line.indexOf("=")),
        line.slice(line.indexOf("=") + 1),
      ]),
  );
  return { ...wrangler.vars, ...dotVars } as Env;
}

const env = origin ? undefined : await localEnv();

function api(path: string, init?: RequestInit): Promise<Response> {
  return origin
    ? fetch(`${origin}/api${path}`, init)
    : Promise.resolve(app.request(`/api${path}`, init, env));
}

const secret = process.env.CLAIMS_SECRET ?? env?.CLAIMS_SECRET;
if (!secret) throw new Error("CLAIMS_SECRET is required");

const config = (await (await api("/config")).json()) as AppConfig;
if (config.network !== "testnet") throw new Error("Only runs on testnet");

function step(message: string) {
  console.log(`\n▸ ${message}`);
}

async function funded(): Promise<Keypair> {
  const keypair = Keypair.random();
  const res = await fetch(
    `https://friendbot.stellar.org?addr=${keypair.publicKey()}`,
  );
  if (!res.ok) throw new Error(`friendbot ${res.status}`);
  return keypair;
}

function client(keypair: Keypair): Client {
  return new Client({
    contractId: config.contractId,
    networkPassphrase: config.networkPassphrase,
    rpcUrl: config.rpcUrl,
    publicKey: keypair.publicKey(),
    ...basicNodeSigner(keypair, config.networkPassphrase),
  });
}

async function attest(tx: AssembledTransaction<unknown>, claims: string[]) {
  await tx.signAuthEntries({
    address: config.attester,
    authorizeEntry: async (entry, _signer, validUntilLedger) => {
      const res = await api("/attest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry: entry.toXdr("base64"),
          validUntilLedger,
          claims,
        }),
      });
      const body = (await res.json()) as { entry?: string; error?: string };
      if (!body.entry) throw new Error(`attest: ${body.error}`);
      return xdr.SorobanAuthorizationEntry.fromXdr(body.entry, "base64");
    },
  });
  await tx.simulate();
}

async function expectFailure(label: string, run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    console.log(`  rejected as expected: ${(error as Error).message}`);
    return;
  }
  throw new Error(`${label} should have failed`);
}

const member = await funded();
const newKey = await funded();
const suffix = Date.now().toString();
const discord: Claim = {
  address: member.publicKey(),
  provider: "discord",
  id: `9${suffix}`,
  handle: "smoke",
  role: 3,
};
const github: Claim = {
  address: member.publicKey(),
  provider: "github",
  id: suffix,
  handle: "smoke-gh",
};
const accounts = [discord, github].map((c) => ({
  provider: PROVIDER_ID[c.provider],
  id: c.id,
  handle: c.handle,
}));
const claims = [
  await signClaim(discord, secret),
  await signClaim(github, secret),
];

step("mint with a role the attester did not grant");
await expectFailure("forged role", async () => {
  const tx = await client(member).mint({
    to: member.publicKey(),
    role: 2,
    external_accounts: { accounts, email_hash: undefined },
    bio: "",
    projects: [],
  });
  await attest(tx, claims);
});

step("mint");
const mintTx = await client(member).mint({
  to: member.publicKey(),
  role: 3,
  external_accounts: { accounts, email_hash: undefined },
  bio: "",
  projects: ["daoip-5:scf:project:tansu_-_soroban_versioning"],
});
await attest(mintTx, claims);
const tokenId = (await mintTx.signAndSend()).result;
console.log(`  member #${tokenId}`);
const minted = (await client(member).member({ token_id: tokenId })).result;
if (minted.role !== 3 || minted.external_accounts.accounts.length !== 2) {
  throw new Error("unexpected member record");
}

step("set projects");
await (
  await client(member).set_projects({
    caller: member.publicKey(),
    token_id: tokenId,
    projects: [],
  })
).signAndSend();

step("rotate key: old key authorizes, new key signs and pays");
const rotate = await client(newKey).rotate_key({
  token_id: tokenId,
  new_address: newKey.publicKey(),
});
await rotate.signAuthEntries({
  address: member.publicKey(),
  signAuthEntry: basicNodeSigner(member, config.networkPassphrase)
    .signAuthEntry,
});
await rotate.simulate();
await rotate.signAndSend();
const owner = (await client(newKey).owner_of({ token_id: tokenId })).result;
if (owner !== newKey.publicKey()) throw new Error("rotation failed");
console.log(`  owner ${owner}`);

step("propose recovery with a single account");
const lost = await funded();
const recoveryClaims = [
  await signClaim({ ...discord, address: lost.publicKey() }, secret),
];
await expectFailure("one of two accounts", async () => {
  const tx = await client(lost).propose_recovery({
    token_id: tokenId,
    new_address: lost.publicKey(),
  });
  await attest(tx, recoveryClaims);
});

step("propose recovery with both accounts");
const propose = await client(lost).propose_recovery({
  token_id: tokenId,
  new_address: lost.publicKey(),
});
await attest(propose, [
  ...recoveryClaims,
  await signClaim({ ...github, address: lost.publicKey() }, secret),
]);
await propose.signAndSend();
const pending = (await client(lost).recovery({ token_id: tokenId })).result;
console.log(
  `  pending until ${new Date(Number(pending!.executable_at) * 1000)}`,
);

step("the current key cancels it");
await (
  await client(newKey).cancel_recovery({
    caller: newKey.publicKey(),
    token_id: tokenId,
  })
).signAndSend();
if ((await client(newKey).recovery({ token_id: tokenId })).result) {
  throw new Error("recovery still pending");
}

console.log(`\n✓ all flows passed, member #${tokenId}`);
