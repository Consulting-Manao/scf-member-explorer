/**
 * End-to-end flows on testnet with the two kept identities only:
 * the admin (member) and the attester (also used as the rotated key).
 *
 *   bun scripts/smoke.ts                          # worker in-process, .dev.vars
 *   CLAIMS_SECRET=… bun scripts/smoke.ts <origin>  # a running worker
 *
 * OAuth is skipped: claims are signed with the worker's CLAIMS_SECRET.
 * Idempotent: the admin ends up holding its membership, whatever the state.
 */

import { execFileSync } from "node:child_process";

import { Keypair, xdr } from "@stellar/stellar-sdk";
import {
  basicNodeSigner,
  type AssembledTransaction,
} from "@stellar/stellar-sdk/contract";
import { Client } from "stellar-membership";

import { PROVIDER_ID, type AppConfig, type Claim } from "../shared/membership";
import { signClaim } from "../worker/claims";
import { app } from "../worker/index";
import { localEnv } from "./env";

const origin = process.argv[2];
const env = origin ? undefined : await localEnv();

function api(path: string, init?: RequestInit): Promise<Response> {
  return origin
    ? fetch(`${origin}/api${path}`, init)
    : Promise.resolve(app.request(`/api${path}`, init, env));
}

const secret = process.env.CLAIMS_SECRET ?? env?.CLAIMS_SECRET;
if (!secret) throw new Error("CLAIMS_SECRET is required");
const attesterSecret = process.env.ATTESTER_SECRET ?? env?.ATTESTER_SECRET;
if (!attesterSecret) throw new Error("ATTESTER_SECRET is required");

const config = (await (await api("/config")).json()) as AppConfig;
if (config.network !== "testnet") throw new Error("Only runs on testnet");

/** Secret of a Stellar CLI identity. */
function identity(name: string): Keypair {
  const secret = execFileSync("stellar", ["keys", "show", name], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  return Keypair.fromSecret(secret);
}

const admin = identity(process.env.ADMIN_IDENTITY ?? "stellar-members-testnet");
const attester = Keypair.fromSecret(attesterSecret);
if (attester.publicKey() !== config.attester) {
  throw new Error("ATTESTER_SECRET does not match the configured attester");
}

function step(message: string) {
  console.log(`\n▸ ${message}`);
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

/** Authorize with `signer` when it is not the transaction source. */
async function cosign(tx: AssembledTransaction<unknown>, signer: Keypair) {
  if (!tx.needsNonInvokerSigningBy().includes(signer.publicKey())) return;
  await tx.signAuthEntries({
    address: signer.publicKey(),
    signAuthEntry: basicNodeSigner(signer, config.networkPassphrase)
      .signAuthEntry,
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

async function tokenOf(address: string): Promise<number | null> {
  return (await client(admin).token_of({ owner: address })).result ?? null;
}

async function owner(tokenId: number): Promise<string | null> {
  try {
    return (await client(admin).owner_of({ token_id: tokenId })).result;
  } catch {
    return null;
  }
}

const discord: Claim = {
  address: admin.publicKey(),
  provider: "discord",
  id: "stellar-members-admin",
  handle: "stellar-members",
  role: 3,
};
const github: Claim = {
  address: admin.publicKey(),
  provider: "github",
  id: "stellar-members-admin",
  handle: "stellar-members",
};
const accounts = [discord, github].map((c) => ({
  provider: PROVIDER_ID[c.provider],
  id: c.id,
  handle: c.handle,
}));
const forAdmin = [
  await signClaim(discord, secret),
  await signClaim(github, secret),
];

step("reset: the admin holds its membership");
let tokenId = await tokenOf(admin.publicKey());
if (tokenId === null) {
  const stranded = await tokenOf(attester.publicKey());
  if (stranded !== null) {
    // a previous run stopped after the rotation
    const tx = await client(admin).recover({
      token_id: stranded,
      new_address: admin.publicKey(),
    });
    await tx.signAndSend();
    tokenId = stranded;
    console.log(`  recovered #${tokenId} from the attester`);
  }
}
if (tokenId === null) {
  await expectFailure("forged role", async () => {
    const tx = await client(admin).mint({
      to: admin.publicKey(),
      role: 2,
      external_accounts: { accounts, email_hash: undefined },
      bio: "",
      projects: [],
    });
    await attest(tx, forAdmin);
  });

  const tx = await client(admin).mint({
    to: admin.publicKey(),
    role: 3,
    external_accounts: { accounts, email_hash: undefined },
    bio: "",
    projects: ["daoip-5:scf:project:tansu_-_soroban_versioning"],
  });
  await attest(tx, forAdmin);
  tokenId = (await tx.signAndSend()).result;
  console.log(`  minted #${tokenId}`);
} else {
  console.log(`  member #${tokenId}`);
}
const minted = (await client(admin).member({ token_id: tokenId })).result;
if (minted.external_accounts.accounts.length !== 2) {
  throw new Error("unexpected member record");
}

step("set projects");
await (
  await client(admin).set_projects({
    caller: admin.publicKey(),
    token_id: tokenId,
    projects: ["daoip-5:scf:project:tansu_-_soroban_versioning"],
  })
).signAndSend();

step("rotate key to the attester: admin authorizes, attester signs and pays");
const rotate = await client(attester).rotate_key({
  token_id: tokenId,
  new_address: attester.publicKey(),
});
await cosign(rotate, admin);
await rotate.signAndSend();
if ((await owner(tokenId)) !== attester.publicKey()) {
  throw new Error("rotation failed");
}
console.log(`  owner ${attester.publicKey()}`);

step("propose recovery back to the admin with a single account");
const oneClaim = [await signClaim(discord, secret)];
await expectFailure("one of two accounts", async () => {
  const tx = await client(admin).propose_recovery({
    token_id: tokenId,
    new_address: admin.publicKey(),
  });
  await attest(tx, oneClaim);
});

step("propose recovery with both accounts");
const propose = await client(admin).propose_recovery({
  token_id: tokenId,
  new_address: admin.publicKey(),
});
await attest(propose, forAdmin);
await propose.signAndSend();
const pending = (await client(admin).recovery({ token_id: tokenId })).result;
console.log(
  `  pending until ${new Date(Number(pending!.executable_at) * 1000)}`,
);

step("the current key cancels it");
await (
  await client(attester).cancel_recovery({
    caller: attester.publicKey(),
    token_id: tokenId,
  })
).signAndSend();
if ((await client(admin).recovery({ token_id: tokenId })).result) {
  throw new Error("recovery still pending");
}

step("the admin moves the membership back to itself");
await (
  await client(admin).recover({
    token_id: tokenId,
    new_address: admin.publicKey(),
  })
).signAndSend();
if ((await owner(tokenId)) !== admin.publicKey()) {
  throw new Error("recover failed");
}

console.log(`\n✓ all flows passed, member #${tokenId} held by the admin`);
