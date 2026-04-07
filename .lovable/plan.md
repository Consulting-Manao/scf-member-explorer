

# Codebase Cleanup — No Visual or Behavioral Changes

## Issues Found

### 1. Debug `console.log` statements (6 total)
Leftover from debugging. Should be removed:
- `src/services/stellar.ts` lines 110, 195, 208, 218, 232
- `src/components/GovernanceTraits.tsx` line 54

### 2. Unused file: `src/components/NavLink.tsx`
Not imported anywhere in the app. Dead code — delete it.

### 3. Unused file: `src/App.css`
Vite boilerplate CSS, never imported. Delete it.

### 4. Unused IPFS gateways in `src/services/ipfs.ts`
`IPFS_GATEWAYS` array declares 3 gateways but only index `[0]` is ever used. Simplify to a single constant.

### 5. `GovernanceData` has redundant `nqg` field access
In `getGovernance`, the return normalizes `nqg_score` from `normalized.nqg_score ?? normalized.nqg ?? normalized.nqgScore`. Then in `GovernanceTraits`, it reads `governance.nqg_score ?? governance.nqg`. The spread `...normalized` already includes the raw `nqg` key, so both `governance.nqg_score` and `governance.nqg` exist. This works but is confusing. Clean up: just set `nqg_score` and don't spread unknown keys.

### 6. `NotFound` page uses `console.error` for 404
Minor, but logging a 404 as `console.error` is noisy. Remove it.

## Plan

### Files to edit
- **Delete** `src/components/NavLink.tsx`
- **Delete** `src/App.css`
- **`src/services/stellar.ts`** — Remove 5 `console.log` lines. Clean up `getGovernance` return to only set known keys (`role`, `nqg_score`).
- **`src/components/GovernanceTraits.tsx`** — Remove debug `console.log`. Simplify `nqgRaw` to just `governance.nqg_score` since we normalize it upstream.
- **`src/services/ipfs.ts`** — Replace gateway array with single `IPFS_GATEWAY` constant.
- **`src/pages/NotFound.tsx`** — Remove `console.error` and the `useEffect`/`useLocation` imports.

