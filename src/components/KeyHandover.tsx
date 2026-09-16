import { StrKey } from "@stellar/stellar-sdk";
import type { AssembledTransaction } from "@stellar/stellar-sdk/contract";
import { ArrowRightIcon, KeyRoundIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { getTokenOf } from "@/lib/contract";
import { cn, errorMessage, shortAddress } from "@/lib/utils";
import { UNSUPPORTED, useWallet } from "@/lib/wallet";

import { Alert } from "./ui/alert";
import { Button } from "./ui/button";
import { Input, Label } from "./ui/input";

/**
 * Move a membership to a new key in two steps, with a single account switch:
 * the connected account authorizes its auth entry, then the new key, which
 * is the transaction source, signs and pays.
 */
export function KeyHandover({
  build,
  actionLabel,
  adoptNewKey = false,
  onDone,
}: {
  /** Build the call with the new key as source. */
  build: (newAddress: string) => Promise<AssembledTransaction<unknown>>;
  actionLabel: string;
  /** The new key becomes the connected account once done. */
  adoptNewKey?: boolean;
  onDone: (newAddress: string) => Promise<void> | void;
}) {
  const {
    address,
    walletName,
    selectAccount,
    adopt,
    signAuthEntry,
    signTransaction,
  } = useWallet();
  const [newAddress, setNewAddress] = useState("");
  const [authorized, setAuthorized] =
    useState<AssembledTransaction<unknown> | null>(null);
  const [busy, setBusy] = useState(false);

  const valid = StrKey.isValidEd25519PublicKey(newAddress);

  const authorize = async () => {
    if (!address) return;
    setBusy(true);
    try {
      if (newAddress === address) throw new Error("This is the current key.");
      if ((await getTokenOf(newAddress)) !== null) {
        throw new Error("The new key already holds a membership.");
      }
      const tx = await build(newAddress);
      try {
        await tx.signAuthEntries({
          address,
          signAuthEntry: (entry, opts) =>
            signAuthEntry(entry, { ...opts, address }),
        });
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === UNSUPPORTED
        ) {
          throw new Error(
            `${walletName ?? "This wallet"} cannot sign authorization entries. Connect with Freighter, Lobstr or Albedo for this step.`,
            { cause: error },
          );
        }
        throw error;
      }
      await tx.simulate();
      setAuthorized(tx);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!authorized) return;
    setBusy(true);
    try {
      // the app keeps showing the current key while the wallet switches
      const selected = await selectAccount();
      if (selected !== newAddress) {
        throw new Error(`Select ${shortAddress(newAddress)} in your wallet.`);
      }
      await authorized.sign({
        signTransaction: (xdr, opts) =>
          signTransaction(xdr, { ...opts, address: newAddress }),
      });
      await authorized.send();
      toast.success("Key updated");
      setAuthorized(null);
      if (adoptNewKey) adopt(newAddress);
      await onDone(newAddress);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="new-key">New key</Label>
        <Input
          id="new-key"
          value={newAddress}
          onChange={(e) => {
            setNewAddress(e.target.value.trim());
            setAuthorized(null);
          }}
          placeholder="G…"
          aria-invalid={Boolean(newAddress) && !valid}
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          A funded Stellar account you control. It pays the transaction fee.
        </p>
      </div>
      <ol className="space-y-3">
        <li
          className={cn(
            "flex flex-wrap items-center gap-3 rounded-xl border p-4",
            authorized && "opacity-60",
          )}
        >
          <KeyRoundIcon className="size-4" />
          <span className="flex-1 text-sm">
            1. Authorize with the connected key
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={!valid || busy || Boolean(authorized)}
            onClick={authorize}
          >
            {authorized ? "Authorized" : "Authorize"}
          </Button>
        </li>
        <li className="flex flex-wrap items-center gap-3 rounded-xl border p-4">
          <ArrowRightIcon className="size-4" />
          <span className="flex-1 text-sm">
            2. Switch to the new key, sign and {actionLabel.toLowerCase()}
          </span>
          <Button size="sm" disabled={!authorized || busy} onClick={submit}>
            {actionLabel}
          </Button>
        </li>
      </ol>
      {authorized && (
        <Alert>
          Your wallet opens to select an account: pick{" "}
          <span className="font-mono">{shortAddress(newAddress, 6)}</span>.
        </Alert>
      )}
    </div>
  );
}
