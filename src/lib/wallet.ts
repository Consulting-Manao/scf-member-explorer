import type { StellarWalletsKit } from "@creit-tech/stellar-wallets-kit/sdk";
import { createContext, useContext } from "react";

let loading: Promise<typeof StellarWalletsKit> | undefined;

/** The wallets kit is heavy, load it on first use. */
export function kit(): Promise<typeof StellarWalletsKit> {
  loading ??= Promise.all([
    import("@creit-tech/stellar-wallets-kit/sdk"),
    import("@creit-tech/stellar-wallets-kit/modules/utils"),
  ]).then(([{ StellarWalletsKit }, { defaultModules }]) => {
    StellarWalletsKit.init({ modules: defaultModules() });
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
  connect: () => Promise<string>;
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
