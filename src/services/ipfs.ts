import { getCached, setCache } from "./cache";

const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

export function ipfsToHttp(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("http")) return uri;
  const cid = uri.replace("ipfs://", "").replace("ipfs/", "");
  return `${IPFS_GATEWAY}${cid}`;
}

function extractCid(uri: string): string {
  return uri
    .replace(/^ipfs:\/\//, "")
    .replace(/^ipfs\//, "")
    .replace(/^https?:\/\/[^/]+\/ipfs\//, "")
    .replace(/\/$/, "");
}

export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

export interface MemberProfile {
  name?: string;
  description?: string;
  picture?: string;
  cid?: string;
}

export interface DirEntry {
  name: string;
  cid: string;
  size?: number;
}

// In-memory inflight dedup — coalesce concurrent requests for the same key
const inflight = new Map<string, Promise<unknown>>();

function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = fn().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

/**
 * List a UnixFS directory via the trustless gateway's dag-json view.
 * Returns null if the CID is not a directory or the gateway rejects the request.
 */
export async function listDirectory(uri: string): Promise<DirEntry[] | null> {
  const cid = extractCid(uri);
  if (!cid) return null;

  const cacheKey = `dir:${cid}`;
  const cached = getCached<DirEntry[] | null>(cacheKey);
  if (cached !== null && cached !== undefined) return cached;

  return dedupe(cacheKey, async () => {
    try {
      const res = await fetch(`${IPFS_GATEWAY}${cid}/?format=dag-json`, {
        headers: { Accept: "application/vnd.ipld.dag-json" },
      });
      if (!res.ok) {
        setCache(cacheKey, null);
        return null;
      }
      const data = await res.json() as { Links?: Array<{ Name: string; Hash: { "/": string }; Tsize?: number }> };
      if (!data || !Array.isArray(data.Links)) {
        setCache(cacheKey, null);
        return null;
      }
      const entries: DirEntry[] = data.Links.map((l) => ({
        name: l.Name,
        cid: l.Hash["/"],
        size: l.Tsize,
      }));
      setCache(cacheKey, entries);
      return entries;
    } catch {
      setCache(cacheKey, null);
      return null;
    }
  });
}

/**
 * Cached JSON fetcher.
 * - If `filename` is provided, resolve via directory listing first.
 * - Otherwise fetch the URI directly (treats it as a file CID).
 */
export async function fetchJson<T>(uri: string, filename?: string): Promise<T> {
  const cid = extractCid(uri);
  let url: string;

  if (filename) {
    const entries = await listDirectory(uri);
    const entry = entries?.find((e) => e.name === filename);
    url = entry
      ? `${IPFS_GATEWAY}${cid}/${entry.name}`
      : `${IPFS_GATEWAY}${cid}/${filename}`;
  } else {
    url = ipfsToHttp(uri);
  }

  const cacheKey = `json:${url}`;
  const cached = getCached<T>(cacheKey);
  if (cached !== null && cached !== undefined) return cached;

  return dedupe(cacheKey, async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    const data = (await res.json()) as T;
    setCache(cacheKey, data);
    return data;
  });
}

export async function fetchMetadata(uri: string): Promise<NFTMetadata> {
  return fetchJson<NFTMetadata>(uri);
}

export async function fetchMemberMeta(uri: string): Promise<MemberProfile> {
  const cacheKey = `member:${uri}`;
  const cached = getCached<MemberProfile>(cacheKey);
  if (cached) return cached;

  return dedupe(cacheKey, async () => {
    const cid = extractCid(uri);
    const baseUrl = `${IPFS_GATEWAY}${cid}`;
    const entries = await listDirectory(uri);

    let profileData: Record<string, unknown> = {};
    let pictureUrl: string | undefined;

    if (entries) {
      const profileEntry = entries.find((e) => e.name === "profile.json");
      const imageEntry = entries.find((e) => e.name.startsWith("profile-image."));

      if (profileEntry) {
        try {
          profileData = await fetchJson<Record<string, unknown>>(uri, "profile.json");
        } catch {
          profileData = {};
        }
      }

      if (imageEntry) {
        pictureUrl = `${baseUrl}/${imageEntry.name}`;
      }
    } else {
      // Fallback: gateway didn't expose dag-json. Try profile.json directly.
      try {
        const res = await fetch(`${baseUrl}/profile.json`);
        if (res.ok) profileData = await res.json();
      } catch {
        // leave empty
      }
    }

    // profile.json may include an explicit picture field — prefer it.
    const explicitPicture =
      typeof profileData.picture === "string" ? (profileData.picture as string) : undefined;

    const profile: MemberProfile = {
      name: profileData.name ? String(profileData.name) : undefined,
      description: profileData.description ? String(profileData.description) : undefined,
      picture: explicitPicture
        ? (explicitPicture.startsWith("http") || explicitPicture.startsWith("ipfs://")
            ? ipfsToHttp(explicitPicture)
            : `${baseUrl}/${explicitPicture.replace(/^\//, "")}`)
        : pictureUrl,
      cid,
    };

    setCache(cacheKey, profile);
    return profile;
  });
}
