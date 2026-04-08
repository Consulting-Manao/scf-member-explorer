

# Remove Contract Call Caching — Only Cache IPFS Content

## Summary

Currently, every contract call result is cached in localStorage (collection name, symbol, token URIs, next_token_id, trait metadata). The user wants to always hit the contract for fresh data, and only cache IPFS-fetched content (metadata JSON files, trait metadata JSON) since those are immutable by CID.

## What changes

### 1. `src/services/stellar.ts` — Remove all contract call caching

Remove `getCached`/`setCache` from these functions (always call the contract):
- `getCollectionName` — remove cache check + set
- `getCollectionSymbol` — remove cache check + set
- `getTokenUri` — remove cache check + set
- `getNextTokenId` — remove cache check + set
- `getTraitMetadataUri` — remove cache check at top, but **keep** caching the parsed IPFS JSON result (the fetch from `ipfsToHttp(uri)` is IPFS content). However, the cache key should be based on the IPFS URI itself (the CID), not a generic key — so if the contract returns a new URI, we fetch fresh content.

For `getTraitMetadataUri` specifically: call the contract every time to get the URI, then use the URI as the cache key for the fetched JSON. If the URI hasn't changed, return cached parsed data. If it has, fetch and cache the new one.

### 2. `src/services/ipfs.ts` — Add caching to `fetchMetadata`

Cache the result of `fetchMetadata(uri)` keyed by the IPFS URI/CID. Since IPFS content is immutable, this is safe to cache indefinitely.

### 3. `src/services/cache.ts` — Keep as-is

The cache utility remains useful for IPFS content caching. The contract-match clearing logic can be simplified or removed since we're no longer caching contract data, but it doesn't hurt to keep it for the IPFS cache entries.

### Files to edit
- **`src/services/stellar.ts`** — Strip caching from `getCollectionName`, `getCollectionSymbol`, `getTokenUri`, `getNextTokenId`. Rework `getTraitMetadataUri` to cache by IPFS URI.
- **`src/services/ipfs.ts`** — Add `getCached`/`setCache` to `fetchMetadata` keyed by URI.

