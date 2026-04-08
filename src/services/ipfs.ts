import { getCached, setCache } from "./cache";

const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

export function ipfsToHttp(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("http")) return uri;
  const cid = uri.replace("ipfs://", "").replace("ipfs/", "");
  return `${IPFS_GATEWAY}${cid}`;
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
}

export async function fetchMetadata(uri: string): Promise<NFTMetadata> {
  const cached = getCached<NFTMetadata>(uri);
  if (cached) return cached;

  const url = ipfsToHttp(uri);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch metadata: ${res.status}`);
  const data: NFTMetadata = await res.json();
  setCache(uri, data);
  return data;
}

export async function fetchMemberMeta(uri: string): Promise<MemberProfile> {
  const cacheKey = `member:${uri}`;
  const cached = getCached<MemberProfile>(cacheKey);
  if (cached) return cached;

  // The meta CID is a directory; the actual profile lives at /profile.json
  const baseUrl = ipfsToHttp(uri).replace(/\/$/, "");
  const profileUrl = `${baseUrl}/profile.json`;
  const res = await fetch(profileUrl);
  if (!res.ok) throw new Error(`Failed to fetch member metadata: ${res.status}`);
  const data = await res.json() as Record<string, unknown>;

  // Build profile; picture is conventionally at /profile-image.png
  const profile: MemberProfile = {
    name: data.name ? String(data.name) : undefined,
    description: data.description ? String(data.description) : undefined,
    picture: `${baseUrl}/profile-image.png`,
  };

  setCache(cacheKey, profile);
  return profile;
}
