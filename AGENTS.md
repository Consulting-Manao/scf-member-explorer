# AGENTS.md

Guidance for agents working in this repository.

## What this is

The membership of the Stellar community: a soulbound token per person,
the Soroban contract that holds it and the app to claim and manage it.
The token id is the identity of a person; the address is only the
current key. The README explains the flows, the architecture and the
deployment.

- `contract/` Soroban contract (Rust, soroban-sdk). `src/lib.rs` documents
  every function; one file per trait; tests in `src/tests/`, one per flow.
- `src/` React app (Vite, TanStack Router and Query, Tailwind, Stellar
  Wallets Kit). Reads the ledger directly, writes through the generated
  bindings, caches in the browser.
- `worker/` Hono API on Cloudflare Workers: OAuth exchange, attester
  co-signature, IPFS upload, PG Atlas proxy. Stateless, strict
  configuration, no placeholders.
- `shared/` types and helpers used by the app and the worker.
- `packages/stellar-membership` bindings **generated** by `make bindings`,
  never edited by hand.
- `scripts/smoke.ts` end-to-end flows on testnet with the two kept
  identities only.

## Commands

```bash
bun install && cp .dev.vars.example .dev.vars
bun dev                          # app and worker on http://127.0.0.1:5173
bun run dev:local                # same, worker under Bun when workerd has no network
bun run lint && bun run build    # prettier, eslint, tsc, vite
bun run test                     # vitest: worker and shared
bun run smoke                    # testnet flows through the worker
make test && make lint           # contract tests, clippy, rustfmt
make bindings                    # after a contract change
make deploy network=testnet      # or upgrade, invoke; see make help
```

`.claude/launch.json` starts the local stack for the browser preview tool.

## Conventions

- Radicle is the primary forge, GitHub a mirror. Trunk-based: branch,
  review, fast-forward `main`.
- Plain commit messages, no trailers.
- Every line has a reason: no leftovers, no defensive checks for impossible
  states, no comments that restate the code. Tests cover user flows, not
  cases per argument.
- Only the two Stellar CLI identities of a deployment are used,
  `stellar-members-<network>` (admin) and `stellar-members-attester-<network>`;
  never generate others. Secrets stay in `.dev.vars`.
- Users never pick a network: staging is testnet, production mainnet, the
  five network values in `wrangler.jsonc` are the only difference.
