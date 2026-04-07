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

export async function fetchMetadata(uri: string): Promise<NFTMetadata> {
  const url = ipfsToHttp(uri);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch metadata: ${res.status}`);
  return res.json();
}
