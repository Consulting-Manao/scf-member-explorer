

# Write a Professional README

## Approach

Replace the placeholder `README.md` with a concise technical document covering the architecture and standards this explorer is built on. No badges, no emojis, no filler.

## Content Outline

1. **Project title and one-line description** -- SCF Member Explorer, a client-side viewer for Stellar Community Fund membership NFTs.

2. **Overview** -- What this app does: reads on-chain NFT data from a SEP-50 compliant contract, enriches it with Tansu membership profiles, and displays governance scores computed by Neural Quorum Governance.

3. **Standards and Contracts**
   - **SEP-50 (Smart Contract NFTs)** -- explain the standard briefly, reference the SEP, note the contract methods used (`token_uri`, `owner_of`, `governance`, `trait_metadata_uri`, `next_token_id`).
   - **Dynamic Traits** -- explain `governance()` returns mutable on-chain data (role, NQG score) and `trait_metadata_uri()` provides display instructions (decimals, value mappings). Contrast with static `attributes` in IPFS metadata.
   - **Tansu Membership** -- explain how `get_member(address)` returns an IPFS CID pointing to a profile directory (`profile.json` + `profile-image.png`). Used to enrich token display with human-readable names and pictures.
   - **Neural Quorum Governance (NQG)** -- explain the `nqg_score` dynamic trait, reference the `stellar-community-fund-contracts` repo, note that scores are computed off-chain by neurons and written on-chain.

4. **Architecture** -- A mermaid diagram showing the data flow: Browser -> Soroban RPC (NFT contract + Tansu contract) -> IPFS (token metadata + member profiles + trait metadata). Mention it's 100% client-side, uses `simulateTransaction` for read-only calls.

5. **Configuration** -- explain `src/config/networks.ts` with testnet/mainnet addresses.

6. **Tech stack** -- one short list: React, Vite, TypeScript, Tailwind, `@stellar/stellar-sdk`.

7. **References** -- links to SEP-50, Tansu repo, NQG contracts repo, SCF handbook.

## File to edit
- `README.md` -- full replacement

