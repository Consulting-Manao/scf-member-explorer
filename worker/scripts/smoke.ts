/**
 * End-to-end flows on testnet with the two kept identities only:
 * the admin (member) and the attester (also used as the rotated key).
 *
 *   bun scripts/smoke.ts                            # worker in-process, .dev.vars
 *   ATTESTER_SECRET=… bun scripts/smoke.ts <origin>  # a running worker
 *
 * OAuth is skipped: claims are signed with the attester key directly.
 * Idempotent: the admin ends up holding its membership, whatever the state.
 *
 * The profile is packed with the dapp's own code rather than a copy, so the
 * upload is exactly the one the app sends. That is why `ipfs-car` is a
 * devDependency here.
 */

import { execFileSync } from "node:child_process";

import { Keypair, xdr } from "@stellar/stellar-sdk";
import {
  basicNodeSigner,
  type AssembledTransaction,
} from "@stellar/stellar-sdk/contract";
import { Client } from "../src/bindings";

import { accountOf, type AppConfig, type Claim } from "@shared/membership";
import { packCar, profileFiles } from "../../dapp/src/lib/profile";
import { signClaim } from "../src/claims";
import { app } from "../src/index";
import { localEnv } from "./env";

const origin = process.argv[2];
const env = origin ? undefined : await localEnv();

// the worker serves every network it is configured for, this only runs on
// testnet, so every call names it
function api(path: string, init?: RequestInit): Promise<Response> {
  const at = `${path}${path.includes("?") ? "&" : "?"}network=testnet`;
  return origin
    ? fetch(`${origin}/api${at}`, init)
    : Promise.resolve(app.request(`/api${at}`, init, env));
}

const attesterSecret =
  process.env.TESTNET_ATTESTER_SECRET ?? env?.TESTNET_ATTESTER_SECRET;
if (!attesterSecret) throw new Error("TESTNET_ATTESTER_SECRET is required");

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

const admin = identity("stellar-members-testnet");
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

/** `run` must fail for the `expected` reason, not for any reason. */
async function expectFailure(
  label: string,
  expected: RegExp,
  run: () => Promise<unknown>,
) {
  try {
    await run();
  } catch (error) {
    const message = (error as Error).message;
    if (!expected.test(message)) {
      throw new Error(`${label} failed for the wrong reason: ${message}`, {
        cause: error,
      });
    }
    console.log(`  rejected as expected: ${message}`);
    return;
  }
  throw new Error(`${label} should have failed`);
}

async function member(tokenId: number) {
  return (await client(admin).member({ token_id: tokenId })).result;
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
const accounts = [discord, github].map(accountOf);
const forAdmin = [signClaim(discord, attester), signClaim(github, attester)];

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
  const tx = await client(admin).mint({
    to: admin.publicKey(),
    role: 3,
    external_accounts: { accounts, email_hash: undefined },
    bio: "",
    projects: ["daoip-5:scf:project:pg_atlas"],
  });
  await attest(tx, forAdmin);
  tokenId = (await tx.signAndSend()).result;
  console.log(`  minted #${tokenId}`);
} else {
  console.log(`  member #${tokenId}`);
}

step("update the accounts: a new GitHub handle, attested");
const renamed = { ...github, handle: `stellar-members-${Date.now()}` };
const update = await client(admin).set_external_accounts({
  token_id: tokenId,
  external_accounts: {
    accounts: [discord, renamed].map(accountOf),
    email_hash: undefined,
  },
});
await attest(update, [
  signClaim(discord, attester),
  signClaim(renamed, attester),
]);
await update.signAndSend();
const handles = (await member(tokenId)).external_accounts.accounts.map(
  (a) => a.handle,
);
if (!handles.includes(renamed.handle)) {
  throw new Error(`GitHub handle not updated, found ${handles.join(", ")}`);
}
const restore = await client(admin).set_external_accounts({
  token_id: tokenId,
  external_accounts: { accounts, email_hash: undefined },
});
await attest(restore, forAdmin);
await restore.signAndSend();

step("publish a profile on IPFS, bound to the set_bio transaction");
const { cid, car } = await packCar(
  profileFiles({
    name: "Stellar Members",
    description: "Smoke test profile",
    social: "",
    image: null,
  }),
);
const setBio = await client(admin).set_bio({
  caller: admin.publicKey(),
  token_id: tokenId,
  bio: cid,
});
await setBio.sign();
const uploaded = await api("/ipfs", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    cid,
    signedTxXdr: setBio.signed!.toXDR(),
    car: Buffer.from(car).toString("base64"),
  }),
});
if (!uploaded.ok) throw new Error(`ipfs: ${await uploaded.text()}`);
await setBio.send();
if ((await member(tokenId)).bio !== cid) throw new Error("bio not stored");
console.log(`  profile ${cid}`);
await (
  await client(admin).set_bio({
    caller: admin.publicKey(),
    token_id: tokenId,
    bio: "",
  })
).signAndSend();

step("set projects");
const projects = ["daoip-5:scf:project:stellar_community_forum"];
await (
  await client(admin).set_projects({
    caller: admin.publicKey(),
    token_id: tokenId,
    projects,
  })
).signAndSend();
if ((await member(tokenId)).projects.join() !== projects.join()) {
  throw new Error("projects not stored");
}

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
const oneClaim = [signClaim(discord, attester)];
await expectFailure("one of two accounts", /Prove 2/, async () => {
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
if (!pending) throw new Error("recovery was not recorded");
console.log(
  `  pending until ${new Date(Number(pending.executable_at) * 1000)}`,
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
