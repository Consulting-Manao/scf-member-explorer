

# Integrate Tansu Membership Data

## Summary

Call `get_member(owner_address)` on the Tansu contract to fetch membership metadata (name, description, picture). Use this data to enhance the token display: show member name instead of address on collection cards, use member picture instead of token image when available, and display member info on the token detail page.

## Technical Details

### 1. Add Tansu contract config to `src/config/networks.ts`

Add `TANSU_CONTRACT_ADDRESS` constant with testnet/mainnet values:
- Testnet: `CBXKUSLQPVF35FYURR5C42BPYA5UOVDXX2ELKIM2CAJMCI6HXG2BHGZA`
- Mainnet: `CDXINK2T3P46M4LWK35FVIXXHJ2XHAS4FOVCGVPJ63YV5OVTM24IY5BI`

### 2. Create `src/services/tansu.ts`

New service to interact with the Tansu contract:
- Create a separate `Contract` instance and `simulateCall` helper targeting the Tansu contract address (reuse the same `Server` / network config).
- Export `getMember(ownerAddress: string)` function:
  - Calls `get_member` with the address as an `Address` ScVal.
  - Returns `{ meta: string, projects: unknown[] }` or `null` on error (member may not exist).
- Export `fetchMemberProfile(ownerAddress: string)` higher-level function:
  - Calls `getMember` to get the meta CID.
  - Fetches the IPFS metadata using the existing `fetchMetadata` (or a raw fetch since the shape differs from NFTMetadata).
  - Returns `{ name?: string, description?: string, picture?: string }` or `null`.
  - The IPFS content is cached by CID (immutable).

The `get_member` contract call takes an `Address` type argument — use `nativeToScVal(address, { type: "address" })` or `new Address(ownerAddress).toScVal()`.

### 3. Update `src/services/ipfs.ts`

Add a `MemberProfile` interface: `{ name?: string, description?: string, picture?: string }`.
Add `fetchMemberMeta(uri: string): Promise<MemberProfile>` — fetches and caches IPFS JSON with those optional fields.

### 4. Update `src/pages/TokenPage.tsx`

After loading the owner address, call `fetchMemberProfile(owner)` to get the member data:
- If `profile.picture` exists, use it (via `ipfsToHttp`) as the displayed image instead of the token image.
- Display `profile.name` and `profile.description` alongside the owner info section (e.g. show name as a heading above the address, description below it).
- The member profile call should be non-blocking — token data loads first, member data enhances it.

### 5. Update `src/pages/CollectionPage.tsx` and `src/components/NFTCard.tsx`

- In `CollectionPage`, after loading each token's owner, also fetch `fetchMemberProfile(owner)` for each token that has an owner. Add `memberName` and `memberPicture` to the `TokenData` interface.
- Pass `memberName` and `memberPicture` as props to `NFTCard`.
- In `NFTCard`:
  - If `memberName` is present, show it instead of the truncated address in the card title area (keep address as subtitle).
  - If `memberPicture` is present, use it as the card image instead of the token metadata image.

### Files to create
- `src/services/tansu.ts` — Tansu contract interaction + member profile fetching

### Files to edit
- `src/config/networks.ts` — Add `TANSU_CONTRACT_ADDRESS`
- `src/services/ipfs.ts` — Add `MemberProfile` type and `fetchMemberMeta`
- `src/components/NFTCard.tsx` — Accept and display `memberName` / `memberPicture` props
- `src/pages/CollectionPage.tsx` — Fetch member profiles, pass to NFTCard
- `src/pages/TokenPage.tsx` — Fetch and display member profile data

