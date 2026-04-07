

# Fix: `next_token_id` replaces `getTotalTokens` + cache guards + icon visibility

## `src/services/stellar.ts`
- Replace `getTotalTokens` with `getNextTokenId` that calls `simulateCall("next_token_id")`
- Return the value directly as the total count (no subtraction)
- Remove the binary search fallback entirely
- Guard all `setCache` calls: only cache if value is non-empty/non-zero

## `src/pages/CollectionPage.tsx`
- Import `getNextTokenId` instead of `getTotalTokens`
- Use it directly as the total token count (no math needed)

## `src/components/Footer.tsx`
- Remove `opacity-70` from brand images
- Add `dark:invert` to SCF logo for dark mode

## `src/components/Header.tsx`
- Add `dark:invert` to SCF logo for dark mode visibility

