import { getCached, setCache } from "./cache";

const IPFS_GATEWAY = "https://ipfs.io/ipfs/";
const IPFS_CACHE_VERSION = "v2";

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

function versionedKey(kind: string, value: string): string {
  return `ipfs:${IPFS_CACHE_VERSION}:${kind}:${value}`;
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

const inflight = new Map<string, Promise<unknown>>();

function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = fn().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

/**
 * Parse a public IPFS HTTP gateway directory-index HTML page into a list of
 * `{ name, cid }` entries. The gateway renders each child as
 * `<a href="/ipfs/<childCid>?filename=<name>">`. Exported for unit testing.
 */
export function parseDirectoryHtml(html: string): DirEntry[] {
  const re = /href="\/ipfs\/([^"/?]+)\?filename=([^"]+)"/g;
  const entries: DirEntry[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;

  while ((m = re.exec(html)) !== null) {
    const name = decodeURIComponent(m[2]);
    if (seen.has(name)) continue;
    seen.add(name);
    entries.push({ name, cid: m[1] });
  }

  return entries;
}

/**
 * List a UnixFS directory.
 *
 * Public IPFS HTTP gateways (ipfs.io, dweb.link, w3s.link, ...) refuse
 * `?format=dag-json` on `dag-pb` blocks ("codec conversion is not supported")
 * and Kubo's `/api/v0/ls` is disabled. The remaining stable, dependency-free
 * option is the gateway's HTML directory index, where each entry is rendered
 * as `<a href="/ipfs/<childCid>?filename=<name>">`. We parse those anchors.
 */
export async function listDirectory(uri: string): Promise<DirEntry[] | null> {
  const cid = extractCid(uri);
  if (!cid) return null;

  const cacheKey = versionedKey("dir", cid);
  const cached = getCached<DirEntry[] | null>(cacheKey);
  if (cached !== null && cached !== undefined) return cached;

  return dedupe(cacheKey, async () => {
    try {
      const res = await fetch(`${IPFS_GATEWAY}${cid}/`, {
        headers: { Accept: "text/html" },
      });
      if (!res.ok) {
        setCache(cacheKey, null);
        return null;
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html")) {
        setCache(cacheKey, null);
        return null;
      }

      const html = await res.text();
      const entries = parseDirectoryHtml(html);

      if (entries.length === 0) {
        setCache(cacheKey, null);
        return null;
      }

      setCache(cacheKey, entries);
      return entries;
    } catch {
      setCache(cacheKey, null);
      return null;
    }
  });
}

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

  const cacheKey = versionedKey("json", url);
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
  const cacheKey = versionedKey("member", uri);
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
      try {
        const res = await fetch(`${baseUrl}/profile.json`);
        if (res.ok) profileData = await res.json();
      } catch {
        // ignore fallback errors
      }
    }

    const explicitPicture = typeof profileData.picture === "string" ? profileData.picture : undefined;

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

