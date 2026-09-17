import {
  Account,
  Contract,
  Keypair,
  nativeToScVal,
  Networks,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { CarWriter } from "@ipld/car";
import { CID } from "multiformats/cid";
import * as raw from "multiformats/codecs/raw";
import { sha256 } from "multiformats/hashes/sha2";
import { describe, expect, it, vi } from "vitest";

import type { Env } from "./env";
import { checkUploadTransaction, upload, UploadError } from "./ipfs";

const contractId = "CATJ45GRCHCTXLR4H2GKTUW7L5CBCKYO6P3PTRLHPASBIVT3BESZ37WN";
const cid = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

function signedTx(
  options: {
    fn?: string;
    contract?: string;
    bio?: string;
    signer?: Keypair;
  } = {},
): string {
  const source = Keypair.random();
  const tx = new TransactionBuilder(new Account(source.publicKey(), "1"), {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      new Contract(options.contract ?? contractId).call(
        options.fn ?? "set_bio",
        nativeToScVal(source.publicKey(), { type: "address" }),
        nativeToScVal(0, { type: "u32" }),
        nativeToScVal(options.bio ?? cid, { type: "string" }),
      ),
    )
    .setTimeout(30)
    .build();
  tx.sign(options.signer ?? source);
  return tx.toXDR();
}

function check(xdr: string) {
  return () => checkUploadTransaction(xdr, cid, contractId, Networks.TESTNET);
}

describe("checkUploadTransaction", () => {
  it("accepts a signed set_bio storing the CID", () => {
    expect(check(signedTx())).not.toThrow();
    expect(check(signedTx({ fn: "mint" }))).not.toThrow();
  });

  it("rejects a transaction not signed by its source", () => {
    expect(check(signedTx({ signer: Keypair.random() }))).toThrow(
      "not signed by its source",
    );
  });

  it("rejects another contract or function", () => {
    expect(
      check(
        signedTx({
          contract: "CBXKUSLQPVF35FYURR5C42BPYA5UOVDXX2ELKIM2CAJMCI6HXG2BHGZA",
        }),
      ),
    ).toThrow("Unexpected contract");
    expect(check(signedTx({ fn: "set_projects" }))).toThrow(
      "Unexpected function",
    );
  });

  it("rejects when the CID is not in the call", () => {
    expect(check(signedTx({ bio: "bafyother" }))).toThrow(UploadError);
  });
});

/** A CAR of one raw block, optionally declaring a root it does not hold. */
async function car(
  content: string,
  root?: CID,
): Promise<{ base64: string; root: CID }> {
  const bytes = new TextEncoder().encode(content);
  const block = CID.create(1, raw.code, await sha256.digest(bytes));
  const { writer, out } = CarWriter.create([root ?? block]);
  const chunks: Uint8Array[] = [];
  const collected = (async () => {
    for await (const chunk of out) chunks.push(chunk);
  })();
  await writer.put({ cid: block, bytes });
  await writer.close();
  await collected;
  return { base64: Buffer.concat(chunks).toString("base64"), root: block };
}

const env = {
  CONTRACT_ID: contractId,
  NETWORK_PASSPHRASE: Networks.TESTNET,
} as Env;

const owner = (address: string | null) => () => Promise.resolve(address);

describe("upload", () => {
  it("rejects a CAR whose root is not the CID", async () => {
    const { base64 } = await car("not the profile");
    await expect(
      upload(
        { env, owner: owner(null) },
        { cid, signedTxXdr: signedTx({ fn: "mint" }), car: base64 },
      ),
    ).rejects.toThrow("CID does not match the CAR");
  });

  it("rejects a CAR that does not hold the root it declares", async () => {
    const declared = CID.parse(cid);
    const { base64 } = await car("something else", declared);
    await expect(
      upload(
        { env, owner: owner(null) },
        { cid, signedTxXdr: signedTx({ fn: "mint" }), car: base64 },
      ),
    ).rejects.toThrow("does not contain its root");
  });

  it("accepts a mint from an address that holds nothing yet", async () => {
    // onboarding: the profile goes up with the transaction that mints, so
    // there is no token and no owner to read
    const { base64, root } = await car("a newcomer's profile");
    const uploaded = root.toString();
    vi.stubGlobal("fetch", () => Promise.resolve(new Response(uploaded)));
    await expect(
      upload(
        {
          env,
          owner: () => Promise.reject(new Error("the chain must not be read")),
        },
        {
          cid: uploaded,
          signedTxXdr: signedTx({ fn: "mint", bio: uploaded }),
          car: base64,
        },
      ),
    ).resolves.toBe(uploaded);
    vi.unstubAllGlobals();
  });

  it("rejects a set_bio from someone who is not the token's member", async () => {
    const { base64 } = await car("a profile");
    await expect(
      upload(
        { env, owner: owner(Keypair.random().publicKey()) },
        { cid, signedTxXdr: signedTx(), car: base64 },
      ),
    ).rejects.toThrow("Not the member of that token");
  });
});
