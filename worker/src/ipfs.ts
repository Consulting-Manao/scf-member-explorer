/**
 * Delegated IPFS upload of a profile directory.
 *
 * The app sends the CAR together with the signed transaction that stores
 * its CID on-chain. The upload is accepted only for a transaction signed by
 * its source account, calling this contract with the CID as argument, where
 * that source is the member the call is about.
 */

import { CarReader } from "@ipld/car";
import {
  Address,
  Keypair,
  scValToNative,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { equals } from "multiformats/bytes";
import { sha256 } from "multiformats/hashes/sha2";

import type { Env } from "./env";

export class UploadError extends Error {}

/** 5 MB is plenty for a profile and a picture. */
const MAX_CAR_BYTES = 5 * 1024 * 1024;

export interface UploadCall {
  /** Address the call is about: `mint(to, …)` or `set_bio(caller, …)`. */
  member: string;
  /** Token the bio is written to, absent at mint. */
  tokenId: number | null;
}

export function checkUploadTransaction(
  signedTxXdr: string,
  cid: string,
  contractId: string,
  networkPassphrase: string,
): UploadCall {
  let tx: Transaction;
  try {
    const parsed = TransactionBuilder.fromXDR(signedTxXdr, networkPassphrase);
    if (!(parsed instanceof Transaction)) throw new Error();
    tx = parsed;
  } catch {
    throw new UploadError("Malformed transaction");
  }

  const source = Keypair.fromPublicKey(tx.source);
  const hash = tx.hash();
  if (!tx.signatures.some((sig) => source.verify(hash, sig.signature))) {
    throw new UploadError("Transaction not signed by its source account");
  }

  const [op] = tx.operations;
  if (tx.operations.length !== 1 || op?.type !== "invokeHostFunction") {
    throw new UploadError("Expected a single contract invocation");
  }
  if (op.func.type !== "hostFunctionTypeInvokeContract") {
    throw new UploadError("Expected a contract call, not a deploy");
  }
  const call = op.func.invokeContract;
  if (Address.fromScAddress(call.contractAddress).toString() !== contractId) {
    throw new UploadError("Unexpected contract");
  }

  const fn = call.functionName.toString();
  if (fn !== "mint" && fn !== "set_bio") {
    throw new UploadError("Unexpected function");
  }
  const hasCid = call.args.some(
    (arg) => arg.type === "scvString" && arg.str.toString() === cid,
  );
  if (!hasCid) {
    throw new UploadError("The CID is not stored by the transaction");
  }

  // both functions take the member first
  const member = scValToNative(call.args[0]!) as unknown;
  if (member !== tx.source) {
    throw new UploadError("The transaction is not signed by its member");
  }
  return {
    member,
    tokenId: fn === "set_bio" ? (scValToNative(call.args[1]!) as number) : null,
  };
}

/** Root CID of a CAR whose every block hashes to its own CID. */
async function verifiedRoot(car: Uint8Array<ArrayBuffer>): Promise<string> {
  const reader = await CarReader.fromBytes(car);
  const [root] = await reader.getRoots();
  if (!root) throw new UploadError("CAR has no root");

  let rooted = false;
  for await (const block of reader.blocks()) {
    if (block.cid.multihash.code !== sha256.code) {
      throw new UploadError("Unexpected hash in the CAR");
    }
    const { digest } = await sha256.digest(block.bytes);
    if (!equals(digest, block.cid.multihash.digest)) {
      throw new UploadError("A CAR block does not match its CID");
    }
    rooted ||= block.cid.equals(root);
  }
  if (!rooted) throw new UploadError("The CAR does not contain its root");

  return root.toString();
}

async function importToFilebase(
  env: Env,
  cid: string,
  car: Uint8Array<ArrayBuffer>,
): Promise<void> {
  const form = new FormData();
  form.append(
    "file",
    new Blob([car], { type: "application/vnd.ipld.car" }),
    `${cid}.car`,
  );
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("https://rpc.filebase.io/api/v0/dag/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.FILEBASE_TOKEN}` },
        body: form,
      });
      if (!res.ok) throw new Error(`Filebase HTTP ${res.status}`);
      if (!(await res.text()).includes(cid)) {
        throw new Error("Filebase did not confirm the CID");
      }
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      }
    }
  }
  throw lastError;
}

export interface UploadContext {
  env: Env;
  owner: (tokenId: number) => Promise<string | null>;
}

export async function upload(
  { env, owner }: UploadContext,
  body: { cid: string; signedTxXdr: string; car: string },
): Promise<string> {
  const { cid, signedTxXdr, car } = body;
  if (!cid || !signedTxXdr || !car) {
    throw new UploadError("Missing cid, signedTxXdr or car");
  }
  const { member, tokenId } = checkUploadTransaction(
    signedTxXdr,
    cid,
    env.CONTRACT_ID,
    env.NETWORK_PASSPHRASE,
  );
  // A newcomer holds nothing yet, so a mint is not checked against the
  // ledger: its signature is all there is, and the rate limit does the
  // rest. Editing a profile is another matter, the token has an owner.
  if (tokenId !== null && (await owner(tokenId)) !== member) {
    throw new UploadError("Not the member of that token");
  }

  // base64 is 4/3 of the bytes, checked before decoding
  if (car.length === 0 || car.length > (MAX_CAR_BYTES * 4) / 3 + 4) {
    throw new UploadError("Invalid CAR size");
  }
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = Uint8Array.from(atob(car), (char) => char.charCodeAt(0));
  } catch {
    throw new UploadError("Malformed CAR encoding");
  }
  let root: string;
  try {
    root = await verifiedRoot(bytes);
  } catch (error) {
    if (error instanceof UploadError) throw error;
    throw new UploadError("Malformed CAR");
  }
  if (root !== cid) throw new UploadError("CID does not match the CAR");

  await importToFilebase(env, cid, bytes);
  return cid;
}
