

# Add Token Image Overlay to Collection Cards + Extract Shared Component

## Summary

Extract the image overlay thumbnail (currently in TokenPage) into a reusable component, then use it in both TokenPage and NFTCard.

## Changes

### 1. Create `src/components/TokenImageOverlay.tsx`

A small component that renders a thumbnail in the top-right corner of a container. Props: `tokenImage` (the token contract image URL, already resolved via `ipfsToHttp`), `alt` string. Renders a `absolute right-1 top-1` (small on cards) or `right-2 top-2` (larger on detail page) thumbnail with border/shadow. Accept a `size` prop (`"sm" | "lg"`, default `"sm"`) to control dimensions — `sm` = `h-8 w-8` for cards, `lg` = `h-12 w-12` for detail page.

### 2. Update `src/components/NFTCard.tsx`

- Add `tokenImage` prop (the raw `metadata?.image` value) — the card already has `metadata` so we can derive it, but passing explicitly is cleaner since we need to check both `memberPicture` and `metadata?.image`.
- After the main `<img>`, when `memberPicture` is used AND `metadata?.image` exists and differs, render `<TokenImageOverlay>` with size `"sm"`.

### 3. Update `src/pages/TokenPage.tsx` (lines 150-158)

- Replace the inline overlay markup with `<TokenImageOverlay>` with size `"lg"`.

### 4. Update `src/pages/CollectionPage.tsx`

- NFTCard already receives `metadata` which contains `image`, so no data changes needed — the NFTCard can check internally.

### Files
- **Create**: `src/components/TokenImageOverlay.tsx`
- **Edit**: `src/components/NFTCard.tsx` — add overlay when member picture replaces token image
- **Edit**: `src/pages/TokenPage.tsx` — use shared overlay component

