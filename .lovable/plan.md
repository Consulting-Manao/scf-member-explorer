

# Token Detail: Show Both Descriptions + Token Image Overlay

## Summary

Two changes to the token detail page:
1. Show **both** the token contract description and the member profile description (not just one or the other). Move member name/description into the Owner section.
2. When a member profile picture is used as the main image and a token contract image also exists, show the **token image as a small overlay** in the top-right corner of the main image.

## Changes

### `src/pages/TokenPage.tsx`

**Heading area (lines 158-170):**
- Show `metadata?.name` or `Member #${tokenId}` as the title (token contract name)
- Show `metadata?.description` below it if present (token description — always visible)
- Remove member profile info from this section

**Owner section (lines 172-196):**
- If `memberProfile?.name` exists, show it as a bold name above the address
- If `memberProfile?.description` exists, show it below the address as a secondary description
- Keep the copy button as-is

**Image area (lines 137-150):**
- Keep `displayImage` logic as-is (member picture takes priority)
- When member picture is being used AND `metadata?.image` also exists (and is different), render a small `48x48` rounded thumbnail of the token image in the top-right corner of the image container, with a border and slight shadow — positioned `absolute top-2 right-2`

