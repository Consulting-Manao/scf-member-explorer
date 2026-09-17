# AGENTS.md

Guidance for agents working in this repository.

## What this is

The membership of the Stellar community: a soulbound token per person,
the Soroban contract that holds it and the app to claim and manage it.
The token id is the identity of a person; the address is only the
current key. The README explains the flows, the architecture and the
deployment.

- `contracts/stellar-membership/` Soroban contract (Rust, soroban-sdk) in a
  Cargo workspace at the root. `src/lib.rs` documents every function; one
  file per trait; tests in `src/tests/`, one per flow.
- `dapp/` React app (Vite, TanStack Router and Query, Tailwind, Stellar
  Wallets Kit). Reads the ledger directly, writes through the generated
  bindings, caches in the browser.
- `worker/` Hono API on Cloudflare Workers: OAuth exchange, attester
  co-signature, IPFS upload, PG Atlas proxy. Stateless, strict
  configuration (`wrangler.jsonc`, `.dev.vars`), no placeholders, CORS
  open. The app is a static build served elsewhere, `VITE_API_URL` points
  it at the worker. `worker/scripts/smoke.ts` runs the flows on testnet
  with the two kept identities only.
- `shared/` dependency-free types and helpers, imported by the app and the
  worker as `@shared/membership` through a path alias; its test runs with
  the dapp's.
- `dapp/src/bindings/` and `worker/src/bindings/` contract bindings
  **generated** by `make bindings`, committed, never edited by hand.

The app and the worker are independent packages: their own `package.json`,
lockfile, eslint, prettier and tsconfig. There is no Bun workspace and no
root `package.json`; the Makefile chains the commands.

## Commands

```bash
make install && cp worker/.dev.vars.example worker/.dev.vars
make dev                         # app on http://localhost:5173, worker under Bun behind /api
cd worker && bun run dev:workerd # the worker under the Cloudflare runtime instead
make lint-js && make build-dapp  # prettier, eslint, tsc of both; vite build in dapp/dist
make test-js                     # shared, dapp and worker tests
make smoke                       # testnet flows through the worker
make test && make lint           # contract tests, clippy, rustfmt
make bindings                    # after a contract change
make deploy network=testnet      # or upgrade, invoke; see make help
make deploy-worker               # wrangler deploy
make deploy-pages                # build the app and publish it to Radicle Pages
```

Inside `dapp/` or `worker/`, `bun run lint`, `test` and `format` work on
that package alone, and `bun run build` builds the app.

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
  never generate others. Secrets stay in `worker/.dev.vars`.
- Users never pick a network: staging is testnet, production mainnet, the
  five network values in `worker/wrangler.jsonc` are the only difference.
