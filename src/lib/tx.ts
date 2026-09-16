import { xdr } from "@stellar/stellar-sdk";
import type { AssembledTransaction } from "@stellar/stellar-sdk/contract";

import { api } from "./api";
import { config } from "./config";
import type { SignAuthEntry, SignTransaction } from "./wallet";

export type Step = "attest" | "authorize" | "sign" | "upload" | "submit";

export interface ExecuteOptions {
  signTransaction: SignTransaction;
  /** Claim tokens to have the attester co-sign the call. */
  claims?: string[];
  /** Other addresses which must authorize the call, with their signer. */
  cosigners?: { address: string; signAuthEntry: SignAuthEntry }[];
  /** Called with the signed envelope before submission. */
  beforeSubmit?: (signedTxXdr: string) => Promise<void>;
  onStep?: (step: Step) => void;
}

/**
 * Collect the authorizations, sign and submit a contract call.
 *
 * Signatures of auth entries add verification costs, so the call is
 * simulated again once they are in place.
 */
export async function execute<T>(
  tx: AssembledTransaction<T>,
  options: ExecuteOptions,
): Promise<T> {
  const { onStep = () => {} } = options;
  let resimulate = false;

  if (options.claims) {
    onStep("attest");
    const claims = options.claims;
    await tx.signAuthEntries({
      address: config().attester,
      authorizeEntry: async (entry, _signer, validUntilLedger) => {
        const { entry: signed } = await api.attest({
          entry: entry.toXdr("base64"),
          validUntilLedger,
          claims,
        });
        return xdr.SorobanAuthorizationEntry.fromXdr(signed, "base64");
      },
    });
    resimulate = true;
  }

  for (const cosigner of options.cosigners ?? []) {
    if (!tx.needsNonInvokerSigningBy().includes(cosigner.address)) continue;
    onStep("authorize");
    await tx.signAuthEntries({
      address: cosigner.address,
      signAuthEntry: (entry, opts) =>
        cosigner.signAuthEntry(entry, { ...opts, address: cosigner.address }),
    });
    resimulate = true;
  }

  if (resimulate) await tx.simulate();

  onStep("sign");
  await tx.sign({ signTransaction: options.signTransaction });

  if (options.beforeSubmit) {
    onStep("upload");
    await options.beforeSubmit(tx.signed!.toXDR());
  }

  onStep("submit");
  const sent = await tx.send();
  return sent.result;
}
