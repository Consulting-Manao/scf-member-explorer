import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { config } from "@/lib/config";
import {
  kit,
  WalletContext,
  type SignAuthEntry,
  type SignTransaction,
} from "@/lib/wallet";

const STORAGE_KEY = "wallet:address";

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function store(address: string | null) {
  try {
    if (address) localStorage.setItem(STORAGE_KEY, address);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable, the session still works
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(readStored);
  const [walletName, setWalletName] = useState<string | null>(null);

  const rememberWallet = useCallback(async () => {
    try {
      setWalletName((await kit()).selectedModule.productName);
    } catch {
      setWalletName(null);
    }
  }, []);

  useEffect(() => {
    if (!address) return;
    kit()
      .then((k) => k.getAddress())
      .then(({ address: current }) => {
        if (current !== address) {
          setAddress(current);
          store(current);
        }
        void rememberWallet();
      })
      .catch(() => {
        // the wallet is gone or locked: start disconnected
        setAddress(null);
        store(null);
      });
    // only reconcile once on load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Open the wallet selector. Also used to switch account. */
  const connect = useCallback(async () => {
    const { address: selected } = await (await kit()).authModal();
    setAddress(selected);
    store(selected);
    await rememberWallet();
    return selected;
  }, [rememberWallet]);

  const selectAccount = useCallback(async () => {
    const { address: selected } = await (await kit()).authModal();
    await rememberWallet();
    return selected;
  }, [rememberWallet]);

  const adopt = useCallback((selected: string) => {
    setAddress(selected);
    store(selected);
  }, []);

  const disconnect = useCallback(async () => {
    await (await kit()).disconnect();
    setAddress(null);
    setWalletName(null);
    store(null);
  }, []);

  const signTransaction = useCallback<SignTransaction>(
    async (xdr, opts) =>
      (await kit()).signTransaction(xdr, {
        networkPassphrase: config().networkPassphrase,
        ...opts,
      }),
    [],
  );

  const signAuthEntry = useCallback<SignAuthEntry>(
    async (entry, opts) =>
      (await kit()).signAuthEntry(entry, {
        networkPassphrase: config().networkPassphrase,
        ...opts,
      }),
    [],
  );

  const value = useMemo(
    () => ({
      address,
      walletName,
      connect,
      selectAccount,
      adopt,
      disconnect,
      signTransaction,
      signAuthEntry,
    }),
    [
      address,
      walletName,
      connect,
      selectAccount,
      adopt,
      disconnect,
      signTransaction,
      signAuthEntry,
    ],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}
