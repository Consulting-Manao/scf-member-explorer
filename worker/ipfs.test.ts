import {
  Account,
  Contract,
  Keypair,
  nativeToScVal,
  Networks,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { checkUploadTransaction, UploadError } from "./ipfs";

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

  it("rejects another network", () => {
    expect(() =>
      checkUploadTransaction(signedTx(), cid, contractId, Networks.PUBLIC),
    ).toThrow();
  });
});
