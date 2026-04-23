

# Unify IPFS Access Through Directory Listings + Caching

## Goal

All IPFS access goes through a single resolver that lists the directory once per CID, then reads files by name. No hardcoded extensions, no probing, no duplicate fetches. Cache directory listings and file payloads.

## Approach

Add a `listDirectory(cid)` helper in `src/services/ipfs.ts` that fetches `${gateway}${cid}/?format=dag-json` and returns `[{ name, cid }]` from `Links`. Cache the listing by root CID. Build all file URLs from the listing.

Token metadata and trait metadata URIs from the contract are usually direct file CIDs (not directory paths), but in some cases they may be directory CIDs containing e.g. `metadata.json`. The resolver handles both: if a fetch returns JSON, use it; if it returns a directory (dag-json with `Links`), look for the conventional filename inside.

## Changes

### `src/services/ipfs.ts` (rewrite)

1. **`listDirectory(cid: string): Promise<DirEntry[] | null>`**
   - Strip `ipfs://` / trailing slash from input, extract root CID.
   - Fetch `${gateway}${cid}/?format=dag-json`.
   - Parse `Links` → `[{ name: Link.Name, cid: Link.Hash["/"], size: Link.Tsize }]`.
   - Cache by CID via existing `getCached`/`setCache`.
   - Return `null` if not a directory or gateway rejects (caller falls back to direct fetch).

2. **`fetchJson<T>(uri: string, filename?: string): Promise<T>`** — generic cached JSON fetcher.
   - Cache key = full resolved URL.
   - If `filename` provided: try `listDirectory(cid)` first, find the entry, fetch `${gateway}${cid}/${entry.name}`.
   - Otherwise: fetch the URI directly.
   - Used for token metadata, trait metadata, and `profile.json`.

3. **`fetchMetadata(uri)`** → uses `fetchJson<NFTMetadata>(uri)` (token metadata is a direct file CID today; if it ever becomes a directory, callers can switch to passing `"metadata.json"`).

4. **`fetchMemberMeta(uri)`**
   - `entries = await listDirectory(uri)`.
   - If listing succeeded: find `profile.json` entry → fetch via cached `fetchJson`; find entry whose name starts with `profile-image.` → build picture URL from that exact filename.
   - If listing failed: fall back to fetching `${baseUrl}/profile.json` directly, leave `picture` undefined.
   - If `profile.json` contains a `picture` field, prefer it over the directory-derived URL.
   - Cache the resulting `MemberProfile` as today (`member:${uri}` key).

5. **Trait metadata** (`src/services/stellar.ts` line 184) — replace the raw `fetch(ipfsToHttp(uri))` with `fetchJson<TraitMetadata>(uri)` so it benefits from the same cache and (if it's ever a directory) directory resolution.

### `src/services/cache.ts`

No structural changes. Existing 12h localStorage cache is reused for: directory listings (`dir:${cid}`), JSON payloads (`json:${url}`), and member profiles (`member:${uri}`). Add a tiny in-memory `Map` layer in `ipfs.ts` to dedupe concurrent requests for the same key within a single session render (avoids duplicate inflight fetches when the collection page renders 50 cards at once).

### Files

- **Edit**: `src/services/ipfs.ts` — add `listDirectory`, `fetchJson`, in-memory inflight dedup; rewrite `fetchMemberMeta`.
- **Edit**: `src/services/stellar.ts` — route trait-metadata fetch through `fetchJson`.

### Out of scope

- No CAR decoding (not needed; `dag-json` directory listing is sufficient and dependency-free).
- No UI changes; `NFTCard` and `TokenPage` already handle missing pictures gracefully.

