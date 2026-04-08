

# Dependency Audit & Cleanup

## Summary

The app only uses a small fraction of the installed dependencies. Most shadcn/ui components were scaffolded but never used by actual app code. Many heavy libraries are completely unused.

## Unused Dependencies to Remove

### Libraries (not imported anywhere outside `src/components/ui/`)
These are only pulled in by UI component files that themselves are never used:

| Package | Why unused |
|---|---|
| `@hookform/resolvers` | No forms in the app |
| `react-hook-form` | No forms in the app |
| `zod` | No validation in the app |
| `date-fns` | Only used by calendar UI (unused) |
| `recharts` | Only used by chart UI (unused) |
| `next-themes` | Only used by sonner UI wrapper (app uses custom `useTheme` hook) |
| `react-resizable-panels` | Only used by resizable UI (unused) |
| `input-otp` | Only used by input-otp UI (unused) |
| `embla-carousel-react` | Only used by carousel UI (unused) |
| `cmdk` | Only used by command UI (unused) |
| `vaul` | Only used by drawer UI (unused) |
| `react-day-picker` | Only used by calendar UI (unused) |

### Radix UI packages (only used by unused UI components)
| Package | Used by (unused component) |
|---|---|
| `@radix-ui/react-accordion` | accordion.tsx |
| `@radix-ui/react-alert-dialog` | alert-dialog.tsx |
| `@radix-ui/react-aspect-ratio` | aspect-ratio.tsx |
| `@radix-ui/react-avatar` | avatar.tsx |
| `@radix-ui/react-checkbox` | checkbox.tsx |
| `@radix-ui/react-collapsible` | collapsible.tsx |
| `@radix-ui/react-context-menu` | context-menu.tsx |
| `@radix-ui/react-hover-card` | hover-card.tsx |
| `@radix-ui/react-menubar` | menubar.tsx |
| `@radix-ui/react-navigation-menu` | navigation-menu.tsx |
| `@radix-ui/react-popover` | popover.tsx |
| `@radix-ui/react-progress` | progress.tsx |
| `@radix-ui/react-radio-group` | radio-group.tsx |
| `@radix-ui/react-scroll-area` | scroll-area.tsx |
| `@radix-ui/react-select` | select.tsx |
| `@radix-ui/react-slider` | slider.tsx |
| `@radix-ui/react-switch` | switch.tsx |
| `@radix-ui/react-tabs` | tabs.tsx |
| `@radix-ui/react-toggle` | toggle.tsx |
| `@radix-ui/react-toggle-group` | toggle-group.tsx |

### Dev dependency to remove
| Package | Why unused |
|---|---|
| `@tailwindcss/typography` | No `prose` classes used in the app |

## Dependencies to Keep
- `@radix-ui/react-dialog` — used by sonner/toaster
- `@radix-ui/react-label` — used by form (but form is unused... however label may be needed)
- `@radix-ui/react-separator` — check if used
- `@radix-ui/react-slot` — used by Button
- `@radix-ui/react-toast` — used by toaster (actively used)
- `@radix-ui/react-tooltip` — used by TooltipProvider in App.tsx
- `@radix-ui/react-dropdown-menu` — check if used
- `@stellar/stellar-sdk`, `@tanstack/react-query`, `react`, `react-dom`, `react-router-dom` — core app deps
- `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate` — styling utilities
- `lucide-react` — icons
- `sonner` — toast notifications

## Unused UI Component Files to Delete

All `src/components/ui/` files not imported by app code:
- accordion, alert-dialog, alert, aspect-ratio, avatar, breadcrumb, calendar, carousel, chart, checkbox, collapsible, command, context-menu, drawer, dropdown-menu, form, hover-card, input-otp, input, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, slider, switch, table, tabs, textarea, toggle, toggle-group

## UI Components to Keep
- `button.tsx` — used by ThemeToggle, TokenPage
- `card.tsx` — used by NFTCard
- `skeleton.tsx` — used by NFTCard, TokenPage
- `sonner.tsx` — used by App.tsx
- `toast.tsx` + `toaster.tsx` + `use-toast.ts` — used by App.tsx
- `tooltip.tsx` — used by App.tsx

## Sonner/next-themes Issue
`sonner.tsx` imports `useTheme` from `next-themes`, but the app uses a custom `useTheme` hook. We should update `sonner.tsx` to use the custom hook or simplify it to not need `next-themes` at all.

## Plan

### Step 1: Update `src/components/ui/sonner.tsx`
Replace `next-themes` import with the app's custom `useTheme` hook so we can drop `next-themes`.

### Step 2: Delete ~35 unused UI component files
Remove all unused `src/components/ui/` files listed above.

### Step 3: Remove unused hooks
- `src/hooks/use-mobile.tsx` — check if used, likely not
- `src/hooks/use-toast.ts` — duplicate of `src/components/ui/use-toast.ts`, check which is used

### Step 4: Remove ~30 unused packages from `package.json`
Remove all packages listed in the "Unused Dependencies" tables above.

### Files to edit
- `package.json` — remove ~30 unused deps
- `src/components/ui/sonner.tsx` — swap `next-themes` for custom hook
- Delete ~35 unused UI component files
- Possibly delete `src/hooks/use-mobile.tsx`

