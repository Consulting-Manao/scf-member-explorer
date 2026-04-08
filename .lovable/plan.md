

# Show IPFS CIDs in Details Section

## Changes to `src/pages/TokenPage.tsx`

**Details section (lines 235-267):**

1. **Rename** "Metadata" → "Token metadata" and show the IPFS CID (extracted from `tokenUri`) instead of just "IPFS". Extract CID by parsing the URL path after `/ipfs/`.

2. **Add** a new "Profile metadata" row when the member profile CID is available. Show the CID as a clickable link to the IPFS gateway.

3. To get the profile CID, we need to surface it from the Tansu service.

## Changes to `src/services/tansu.ts`

- Update `fetchMemberProfile` to return the `meta` CID alongside the profile data. Change return type to include `cid?: string` on `MemberProfile`, or return `{ profile, cid }`.

## Changes to `src/services/ipfs.ts`

- Add `cid` field to `MemberProfile` interface so it can carry the raw CID through.

## Helper

Add a small utility function (inline in TokenPage or in ipfs.ts) to extract a CID from a URL like `https://ipfs.io/ipfs/QmXYZ.../3` → `QmXYZ.../3`.

### Files to edit
- `src/services/ipfs.ts` — Add `cid` to `MemberProfile`
- `src/services/tansu.ts` — Pass `meta` CID into the returned profile
- `src/pages/TokenPage.tsx` — Update Details section with renamed labels, CID display, and profile metadata row

