

# Fix Role Label Mapping and NQG Score Decimal Formatting

## Problems
1. **Role shows "Member" instead of the actual role name** (e.g., "Pilot", "Navigator"): The `governance` method returns the role as an integer. The `trait_metadata_uri` response contains a mapping from integer values to role labels (e.g., `{0: "Pilot", 1: "Navigator"}`). Currently the code just displays the raw value or falls back to "Member".
2. **NQG score not properly formatted**: The decimal shift from `trait_metadata_uri` may not be correctly applied because the key lookup (`traitMeta?.nqg?.decimals`) might not match the actual key in the returned data.

## Plan

### 1. Update `TraitMetadata` type (`src/services/stellar.ts`)
Add a `mapping` (or `values`) field to `TraitMetadata` to capture integer-to-string role mappings:
```ts
export interface TraitMetadata {
  decimals?: number;
  mapping?: Record<string, string>;
  [key: string]: unknown;
}
```

### 2. Improve `getTraitMetadataUri` normalization (`src/services/stellar.ts`)
Recursively convert nested Maps at all levels (the mapping field inside each trait is also likely a Soroban Map). Add deeper conversion.

### 3. Fix `getGovernance` to preserve raw values (`src/services/stellar.ts`)
Stop converting the role to a string prematurely. Keep the raw integer for `role` so the UI can map it using trait metadata. Also add a `console.log` showing all keys and values for debugging.

### 4. Update `GovernanceTraits` component (`src/components/GovernanceTraits.tsx`)
- **Role**: Look up `traitMeta?.role?.mapping?.[governance.role]` to convert the integer to a human-readable label (e.g., "Pilot"). Fall back to the raw value if no mapping exists.
- **NQG score**: Try multiple key variations in traitMeta (`nqg`, `nqg_score`) for the decimals value. Log what keys are available in traitMeta for debugging.
- Keep the existing BigInt-safe `formatWithDecimals` function.

### Files to edit
- `src/services/stellar.ts` — update `TraitMetadata` interface, deepen Map normalization in `getTraitMetadataUri`, keep raw values in `getGovernance`
- `src/components/GovernanceTraits.tsx` — use trait metadata mapping for role label, improve decimals key lookup for NQG score

