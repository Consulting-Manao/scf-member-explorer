

# Add Official SCF & Stellar Icons

## What we have
- The reference ChimpDAO project has the official **SCF logo** (`scf-logo.svg`, 5.5KB) and **Stellar symbol** (`stellar-symbol.png`, 60KB) in `src/assets/`
- The ChimpDAO footer uses these with proper "Built on Stellar" and "Funded by SCF" badges with icon images
- It also uses inline SVG icons for Discord, X (Twitter), and GitHub social links
- Our current header uses a generic blue square with "S" letter — needs the real SCF logo
- Our current footer uses text-only links with generic `ExternalLink` icons

## Plan

### 1. Copy official assets from the ChimpDAO project
- `src/assets/scf-logo.svg` — the official SCF logo
- `src/assets/stellar-symbol.png` — the official Stellar rocket symbol

### 2. Update Header (`src/components/Header.tsx`)
- Replace the generic blue "S" square with the actual SCF logo SVG imported from `src/assets/scf-logo.svg`
- Keep the same layout and sizing

### 3. Update Footer (`src/components/Footer.tsx`)
- Add proper icon components for each social/external link:
  - **GitHub** — use lucide `Github` icon (already available)
  - **Discord** — inline SVG icon (same as ChimpDAO reference)
  - **X / Twitter** — not needed for SCF (no SCF Twitter link in our links)
- Replace generic `ExternalLink` icons with contextual icons per link
- Add the **Stellar symbol** image next to "Built on Stellar"
- Add the **SCF logo** image as a visual badge
- Style the footer links as icon buttons similar to ChimpDAO's approach, adapted for SCF's clean/light theme

### Technical details
- Assets copied via `cross_project--copy_project_asset`
- Icons imported as standard image assets
- Stellar symbol will need `dark:invert` class for theme compatibility
- SCF logo SVG should work in both themes

