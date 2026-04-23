

# Engineering cleanup pass (favicon preserved)

Same scope as before, with the favicon left untouched per your note.

## 1. Project identity

- **`package.json`** — rename `"vite_react_shadcn_ts"` → `"scf-member-explorer"`, set `"version": "1.0.0"`, add `"description"`, `"license": "MIT"`. Drop unused `"build:dev"` script. Add `"typecheck": "tsc -b --noEmit"`.

## 2. Remove leftovers

- **Delete `.lovable/plan.md`** and the `.lovable/` directory — stale, not consumed by any tooling.
- **Delete `public/placeholder.svg`** — unreferenced anywhere in `src/` or `index.html`.
- **Delete `public/robots.txt`** — current contents (allow everything) is the default crawler behaviour.
- **Keep `public/favicon.ico`** — user-provided custom favicon. Add an explicit `<link rel="icon" href="/favicon.ico" sizes="any" />` to `index.html` so it's declared rather than only relying on the implicit browser request.

## 3. Vite + Vitest config hygiene

- **`vite.config.ts`** — trim the `dedupe` array to `["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"]` (the `@tanstack/*` entries reference removed deps). Drop the obsolete `// https://vitejs.dev/config/` comment.
- **`vitest.config.ts`** — switch `environment: "jsdom"` → `"node"` (no test renders React). Drop `setupFiles` and delete `src/test/setup.ts`. Tighten `include` to the new test location.

## 4. Service-layer correctness

- **New `src/services/soroban.ts`** — extract the duplicated `simulateCall` into `simulate(contractAddress, method, ...args)`. Both `stellar.ts` and `tansu.ts` become thin wrappers, removing ~30 lines of identical SDK boilerplate.
- **`src/services/stellar.ts`** — delete unused exports `getCollectionName` and `getCollectionSymbol` (no importers). Replace the `console.error("trait_metadata_uri error:", err)` with a silent return — the function already returns `null` and the call site doesn't surface errors, so the log is noise in production.
- **`src/lib/format.ts`** (new) — move `formatWithDecimals` out of `GovernanceTraits.tsx` so it's testable in isolation; import it back into the component.

## 5. TypeScript strictness

- **`tsconfig.app.json`** — flip `"strict": true`, `"strictNullChecks": true`, `"noImplicitAny": true`, `"noUnusedLocals": true`, `"noUnusedParameters": true`. Mirror in `tsconfig.json`. Fix any errors surfaced (expected to be tiny; the codebase already uses `?.` and explicit types throughout).

## 6. ESLint

- **`eslint.config.js`** — remove the `"@typescript-eslint/no-unused-vars": "off"` override so unused symbols are flagged.

## 7. Tests — small, real, and useful

Delete the trivial existing test and replace with focused unit tests of the actual fragile logic.

- **Delete** `src/test/ipfs.test.ts`, `src/test/setup.ts`, `src/test/` directory.
- **Add `src/services/__tests__/ipfs.test.ts`**:
  - `ipfsToHttp`: `ipfs://` prefix, http passthrough, `ipfs/` prefix, empty string.
  - Extract the directory-index regex parser from `listDirectory` into an exported `parseDirectoryHtml(html)` helper and unit-test it against a fixture string. This is the single most fragile piece of the IPFS layer (gateway HTML format).
- **Add `src/lib/__tests__/format.test.ts`** for `formatWithDecimals`: zero/undefined decimals passthrough, fractional truncation of trailing zeros, bigint input, string input.
- **Drop dev deps**: `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` — none are used after the switch to a `node` environment. Saves ~30 MB in `node_modules`.

## 8. README

- Replace the placeholder contract addresses with the real values from `src/config/networks.ts` and add a one-line quick start (`bun install && bun dev`).

## Files touched

- `package.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `eslint.config.js`, `index.html`, `README.md`
- `src/services/stellar.ts`, `src/services/tansu.ts`, `src/services/ipfs.ts`
- New: `src/services/soroban.ts`, `src/lib/format.ts`, `src/services/__tests__/ipfs.test.ts`, `src/lib/__tests__/format.test.ts`
- `src/components/GovernanceTraits.tsx` (import `formatWithDecimals` from `@/lib/format`)

## Files deleted

- `.lovable/plan.md` and `.lovable/` directory
- `public/placeholder.svg`, `public/robots.txt`
- `src/test/ipfs.test.ts`, `src/test/setup.ts`, `src/test/` directory

## Out of scope

- `public/favicon.ico` — kept (user-supplied).
- `lovable-tagger` Vite plugin and `lovable-agent-playwright-config` — platform tooling, not user-facing code.
- No contract integration, RPC, styling, or UX changes.

