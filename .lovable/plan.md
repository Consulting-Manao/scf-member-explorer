

# Fix Governance Data, Stellar Logo, Token Detail Layout

## 1. Fix governance data retrieval (`src/services/stellar.ts`)

The `governance` method returns a Soroban map, but `scValToNative` may produce keys that don't match our expected `role` / `nqg_score`. Two approaches available:

- **Option A (current)**: Keep calling `governance(token_id)` which returns role as a string and NQG score. Add `console.log` to inspect raw output shape, then adapt key lookups.
- **Option B**: Call `trait_values(token_id, ["role", "nqg"])` to get raw trait values, then use `trait_metadata_uri` to convert the role integer to a string label.

**Plan**: Add a temporary `console.log` of the raw `scValToNative(result)` in `getGovernance` so we can see the actual key names. Also make the function resilient by iterating all keys of the returned object and mapping common variations (`nqg_score`, `nqg`, `nqgScore`) to the expected fields. If the governance call fails or returns unexpected structure, fall back to calling `trait_values`.

### Technical detail
```ts
export async function getGovernance(tokenId: number): Promise<GovernanceData | null> {
  try {
    const result = await simulateCall("governance", nativeToScVal(tokenId, { type: "u32" }));
    const raw = scValToNative(result);
    console.log("governance raw:", JSON.stringify(raw));
    
    // Normalize: handle both Map and object structures
    const data = raw instanceof Map ? Object.fromEntries(raw) : raw;
    
    return {
      role: data.role ?? data.scf_role,
      nqg_score: data.nqg_score ?? data.nqg ?? data.nqgScore,
      ...data,
    } as GovernanceData;
  } catch {
    return null;
  }
}
```

Key insight: `scValToNative` converts Soroban maps to JS `Map` objects, not plain objects. We need `Object.fromEntries()` to convert it, then look up keys.

## 2. Fix Stellar logo inversion (`src/components/Footer.tsx`)

The Stellar symbol PNG is dark-colored natively. Currently has `invert dark:invert-0` which wrongly inverts it in light mode. User said "the other way around" — change to `dark:invert` (no invert in light mode, invert to light in dark mode).

- Line 39: `invert dark:invert-0` → `dark:invert`

## 3. Redesign token detail layout (`src/pages/TokenPage.tsx`)

Move GovernanceTraits below the image in the left column for better space usage:

```text
Left column:            Right column:
┌────────────────┐     ┌──────────────────────┐
│    Image       │     │ Name / Description   │
│                │     │ Owner                │
├────────────────┤     │ Attributes           │
│  Governance    │     │ Contract details     │
└────────────────┘     └──────────────────────┘
```

Restructure the 2-column grid so the left column contains both the image and GovernanceTraits component, while the right column has name, description, owner, vanity attributes, and technical details.

## Files changed
- `src/services/stellar.ts` — fix `getGovernance` to handle Map return type, add console.log, normalize keys
- `src/components/Footer.tsx` — line 39: fix Stellar logo class
- `src/pages/TokenPage.tsx` — move GovernanceTraits to left column under image

