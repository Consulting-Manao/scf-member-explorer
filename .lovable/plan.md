

# Stellar Community Fund — NFT Member Explorer (Revised)

## Changes from Previous Plan
- **Added**: Dark/light theme toggle with system preference detection
- Network and contract address remain **code-level constants**

## Pages & Routes

### `/` — Collection Grid (home)
- Header: "Stellar Community Fund" title, short SCF description, **theme toggle** (sun/moon icon)
- Responsive grid of NFT cards with **infinite scroll** (~20 cards per batch)
- Each card: NFT image, name, token ID
- Unminted tokens: placeholder card
- Click → `/token/:tokenId`
- Fully responsive: 1 col mobile, 2 col tablet, 3-4 col desktop

### `/token/:tokenId` — Token Detail Page
- Back button to collection
- Large NFT image, token name, owner address (copyable)
- **Governance Traits** (highlighted section):
  - **SCF Role** → links to SCF Handbook roles page
  - **NQG Score** → links to NQG contracts repo
- **Vanity Traits** — accessories as simple badges
- Technical info: contract address, IPFS link
- Responsive: stacked layout on mobile, side-by-side on desktop

## Theme System
- Toggle button in header (sun/moon icon)
- Persisted in `localStorage`
- Defaults to system preference via `prefers-color-scheme`
- Uses existing Tailwind `dark` class strategy — the CSS variables for `.dark` are already defined in `index.css`
- SCF light: clean whites/blues. Dark: deep navy/slate with same accent colors.

## Config (code-level only)
```ts
// src/config/networks.ts
export const NETWORK = "testnet";
export const CONTRACT_ADDRESS = "CAXOCXBNKO3IN3UNDLYXZG3GR3B3IULTPKL42NQSMJJSLXG4J4AGN6I4";
export const RPC_URL = NETWORK === "testnet" 
  ? "https://soroban-testnet.stellar.org" 
  : "https://soroban.stellar.org";
```

## Smart Contract Integration
- `token_uri(token_id)` → IPFS metadata URI
- `owner_of(token_id)` → owner; null = not minted
- `governance(token_id)` → role + NQG score
- `trait_metadata_uri()` → cached 24h, maps governance values
- `name()` / `symbol()` → collection info
- All via Soroban `simulateTransaction` (read-only, no signing)

## Design
- Light default: white backgrounds, SCF blue accents, subtle card shadows
- Dark mode: deep navy/slate, same blue accents adjusted for contrast
- All components use Tailwind dark: variants
- Cards, badges, footer all adapt to theme

## Footer
- "Built on Stellar" → stellar.org
- "Stellar Community Fund" → communityfund.stellar.org
- SCF Handbook link, Stellar Dev Discord
- © 2026 Stellar Community Fund

## Key Files
- `src/config/networks.ts` — network, RPC, contract constants
- `src/hooks/useTheme.ts` — theme toggle + localStorage + system pref
- `src/components/ThemeToggle.tsx` — sun/moon button
- `src/services/stellar.ts` — Soroban contract calls
- `src/services/ipfs.ts` — IPFS gateway + metadata fetch
- `src/services/cache.ts` — localStorage cache with TTL
- `src/pages/CollectionPage.tsx` — grid + infinite scroll
- `src/pages/TokenPage.tsx` — detail view
- `src/components/NFTCard.tsx` — card component
- `src/components/GovernanceTraits.tsx` — role + NQG display
- `src/components/AttributeBadge.tsx` — vanity trait badge
- `src/components/Footer.tsx` — SCF footer
- `src/components/Header.tsx` — title + theme toggle

## Dependencies
- `@stellar/stellar-sdk` (latest)
- Update all existing deps to latest

