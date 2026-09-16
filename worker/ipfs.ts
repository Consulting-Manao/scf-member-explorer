/**
 * Delegated IPFS upload of a profile directory.
 *
 * The app sends the CAR together with the signed transaction that stores
 * its CID on-chain. The upload is only accepted for a transaction signed by
 * its source account, calling this contract with the CID as argument.
 */

import { CarReader } from "@ipld/car";
import {
  Address,
  Keypair,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

import type { Env } from "./env";

export class UploadError extends Error {}

/** Contract functions storing a bio CID. */
const BIO_FUNCTIONS = ["mint", "set_bio"];
/** 5 MB is plenty for a profile and a picture. */
export const MAX_CAR_BYTES = 5 * 1024 * 1024;

export function checkUploadTransaction(
  signedTxXdr: string,
  cid: string,
  contractId: string,
  networkPassphrase: string,
): void {
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
    throw new UploadError("Expected a contract invocation");
  }
  const call = op.func.invokeContract;
  if (Address.fromScAddress(call.contractAddress).toString() !== contractId) {
    throw new UploadError("Unexpected contract");
  }
  if (!BIO_FUNCTIONS.includes(call.functionName.toString())) {
    throw new UploadError("Unexpected function");
  }
  const hasCid = call.args.some(
    (arg) => arg.type === "scvString" && arg.str.toString() === cid,
  );
  if (!hasCid)
    throw new UploadError("The CID is not stored by the transaction");
}

export async function rootCid(car: Uint8Array<ArrayBuffer>): Promise<string> {
  const reader = await CarReader.fromBytes(car);
  const [root] = await reader.getRoots();
  if (!root) throw new UploadError("CAR has no root");
  return root.toString();
}

async function importToFilebase(
  env: Env,
  cid: string,
  car: Uint8Array<ArrayBuffer>,
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const form = new FormData();
      form.append(
        "file",
        new Blob([car], { type: "application/vnd.ipld.car" }),
        `${cid}.car`,
      );
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
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  throw lastError;
}

export async function upload(
  env: Env,
  body: { cid: string; signedTxXdr: string; car: string },
): Promise<string> {
  const { cid, signedTxXdr, car } = body;
  if (!cid || !signedTxXdr || !car) {
    throw new UploadError("Missing cid, signedTxXdr or car");
  }
  checkUploadTransaction(
    signedTxXdr,
    cid,
    env.CONTRACT_ID,
    env.NETWORK_PASSPHRASE,
  );

  const bytes = Uint8Array.from(atob(car), (char) => char.charCodeAt(0));
  if (bytes.length === 0 || bytes.length > MAX_CAR_BYTES) {
    throw new UploadError("Invalid CAR size");
  }
  if ((await rootCid(bytes)) !== cid) {
    throw new UploadError("CID does not match the CAR");
  }

  await importToFilebase(env, cid, bytes);
  return cid;
}
