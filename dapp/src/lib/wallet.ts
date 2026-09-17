import type { StellarWalletsKit } from "@creit-tech/stellar-wallets-kit/sdk";
import { createContext, useContext } from "react";

import { config } from "./config";

/** Kit error for a function the wallet does not implement. */
export const UNSUPPORTED = -3;

let loading: Promise<typeof StellarWalletsKit> | undefined;

/** The wallets kit is heavy, load it on first use. */
export function kit(): Promise<typeof StellarWalletsKit> {
  loading ??= Promise.all([
    import("@creit-tech/stellar-wallets-kit/sdk"),
    import("@creit-tech/stellar-wallets-kit/modules/utils"),
  ]).then(([{ StellarWalletsKit }, { defaultModules }]) => {
    StellarWalletsKit.init({
      modules: defaultModules(),
      network: config().networkPassphrase as never,
    });
    return StellarWalletsKit;
  });
  return loading;
}

export type SignTransaction = (
  xdr: string,
  opts?: { networkPassphrase?: string; address?: string },
) => Promise<{ signedTxXdr: string; signerAddress?: string }>;

export type SignAuthEntry = (
  authEntry: string,
  opts?: { networkPassphrase?: string; address?: string },
) => Promise<{ signedAuthEntry: string; signerAddress?: string }>;

export interface WalletContextValue {
  address: string | null;
  /** Name of the connected wallet, for messages. */
  walletName: string | null;
  connect: () => Promise<string>;
  /** Let the user pick another account without changing `address`. */
  selectAccount: () => Promise<string>;
  /** Make `address` the connected one, e.g. after a key rotation. */
  adopt: (address: string) => void;
  disconnect: () => Promise<void>;
  signTransaction: SignTransaction;
  signAuthEntry: SignAuthEntry;
}

export const WalletContext = createContext<WalletContextValue | null>(null);

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet outside WalletProvider");
  return context;
}
