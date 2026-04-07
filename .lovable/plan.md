

# Fix trait_metadata_uri parsing and governance display

## Root Cause

The console logs reveal two bugs:

1. **`traitMeta` contains character-indexed URL string** (`"0": "h", "1": "t", ...`): The `getTraitMetadataUri` function's fallback path at line 213-216 checks `metadata.traits` — if it's undefined (which it would be if `metadata` is actually a string), it falls back to `metadata` itself. `Object.entries()` on a string produces character-indexed entries like `[["0","h"],["1","t"],...]`. This means the IPFS fetch is either failing silently or never happening, and the raw string is being treated as the metadata object.

2. **No network request to the trait metadata IPFS URL** visible in the logs, confirming the fetch never fires or a broken cached result is being served.

## Actual trait metadata (from IPFS)

The JSON at the IPFS URL contains:
```json
{
  "traits": {
    "role": {
      "valueMappings": { "0": "Verified", "1": "Pathfinder", "2": "Navigator", "3": "Pilot" }
    },
    "nqg": {
      "dataType": { "type": "decimal", "decimals": 6 }
    }
  }
}
```

So for token 0 with raw `{"nqg": "8341693", "role": 3}`:
- Role `3` should display as **"Pilot"**
- NQG `8341693` with 6 decimals should display as **"8.341693"**

## Plan

### 1. Fix `getTraitMetadataUri` in `src/services/stellar.ts`

- Add an early guard: if `raw` (from `scValToNative`) is a string, use it as the URI. If it's a Map/object, extract `.uri`/`.url`. If URI extraction fails, return `null` immediately — do NOT fall through to treating the raw value as metadata.
- After fetching the JSON, validate that the result is an object before processing. If it's a string or primitive, return `null`.
- Clear any previously cached bad data by checking the structure before caching.

### 2. Fix `GovernanceTraits` in `src/components/GovernanceTraits.tsx`

- For role: look up `traitMeta?.role?.valueMappings?.[String(governance.role)]` (the actual key name from the JSON is `valueMappings`, not `mapping`)
- For NQG decimals: get from `traitMeta?.nqg?.dataType?.decimals` (the actual path in the JSON)
- The existing `formatWithDecimals` BigInt helper should work once it receives the correct decimals value (6)

### 3. Fix `getGovernance` in `src/services/stellar.ts`

- The `nqg` value comes back as a BigInt. Keep it as-is (the `formatWithDecimals` function already handles BigInt).
- Map `nqg_score` from `nqg` key since the contract uses `nqg` not `nqg_score`.

### Files to edit
- `src/services/stellar.ts` — fix URI extraction guard, prevent string-as-metadata fallback
- `src/components/GovernanceTraits.tsx` — use correct metadata paths (`valueMappings`, `dataType.decimals`)

