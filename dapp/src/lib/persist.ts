/**
 * Keeps the member queries in the browser between visits (IndexedDB), so a
 * return visit renders from what was already read and refreshes in the
 * background.
 */
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { Query } from "@tanstack/react-query";
import { del, get, set } from "idb-keyval";

const DAY = 24 * 60 * 60 * 1000;

export const MAX_AGE = 7 * DAY;

export const persister = createAsyncStoragePersister({
  storage: {
    getItem: (key: string) => get<string>(key).then((v) => v ?? null),
    setItem: (key: string, value: string) => set(key, value),
    removeItem: (key: string) => del(key),
  },
  key: "stellar-members-queries",
  throttleTime: 1000,
});

const PERSISTED = new Set(["list", "detail", "tokenOf", "nqg"]);

/** Member pages, details, the wallet's token and NQG scores. */
export function shouldPersist(query: Query): boolean {
  const [root, kind] = query.queryKey;
  return (
    root === "members" &&
    typeof kind === "string" &&
    PERSISTED.has(kind) &&
    query.state.status === "success"
  );
}

/** Ask the browser not to evict the caches of an installed app. */
export function requestPersistentStorage() {
  navigator.storage?.persist?.().catch(() => {});
}
