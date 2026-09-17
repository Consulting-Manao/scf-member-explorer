# Stellar Membership

The membership of the Stellar community: a soulbound token per person, the
contract that holds it, and the app to claim and manage it.

**The token id is the identity of a person.** The address holding it is only
the current key, which can be rotated or recovered. On-chain, a member has a
role, verified external accounts (Discord id and handle, GitHub id and
handle), the sha256 of a verified email (the same hash PG Atlas uses for
contributors), the IPFS CID of a profile and DAOIP-5 project ids.

- Claim: verify Discord (required, on the Stellar Developers server) and
  GitHub, write a profile, list projects from
  [PG Atlas](https://www.pgatlas.xyz), mint.
- Manage: edit the profile, the projects and the accounts, rotate the key.
- Recover: from a new account, prove two of the membership's accounts, or its
  only one. The membership moves after 7 days unless the current key or an
  admin cancels; an admin can approve sooner.
- Admin: pending recoveries, roles, projects, revocation, moving a
  membership to a new key, attester rotation.

| Path         | Content                                                     |
| ------------ | ----------------------------------------------------------- |
| `contracts/` | Soroban contract, Rust, a Cargo workspace at the root       |
| `dapp/`      | React app: TanStack Router and Query, Tailwind, Wallets Kit |
| `worker/`    | Hono API, a Cloudflare Worker, and the testnet smoke script |
| `shared/`    | Types and helpers imported by both as `@shared/*`           |

## Architecture

```
browser ──── Stellar RPC     reads (ledger entries) and transactions
   │
   └── /api  Cloudflare Worker
             ├─ oauth    code exchange, returns a signed claim
             ├─ attest   co-signs auth entries matching verified claims
             ├─ ipfs     uploads profile CARs to Filebase
             └─ projects PG Atlas proxy
```

The worker is small and stateless. It holds the **attester** key, which
only signs `SorobanAuthorizationEntry` for `mint`, `set_external_accounts`
and `propose_recovery` after checking the arguments against OAuth claims.
The member always authorizes the call too, so the attester alone cannot act
on anyone's membership. It never submits a transaction: the member's wallet
is the source and pays the fees.

### Contract

`contracts/stellar-membership/src/lib.rs` documents every function. In short:

- `mint(to, role, external_accounts, bio, projects)`: the member and the
  attester both authorize; the attester only over `(to, role,
external_accounts)`.
- `set_role` (admin), `set_bio` and `set_projects` (owner or admin),
  `set_external_accounts` (owner and attester).
- `rotate_key(token_id, new_address)`: both keys sign.
- `propose_recovery` (attester and new key), `cancel_recovery` (owner or
  admin), `finalize_recovery` (anyone after 7 days, the admin before),
  `recover` (admin only, also reinstates a revoked token).
- `revoke` (admin): the address is released, the record and accounts stay.
- `governance(token_id)`: role and NQG score, read from the NQG contract.

Every change is published as an event with the token id as topic. Other
services read the contract directly: `token_by_account(provider, id)` maps a
Discord or GitHub id to a member, `member(token_id)` returns the record,
`owner_of`, `token_of` and `governance` the rest. No database is needed.

## Development

The app and the worker are independent Bun packages, each with its own
lockfile and tooling; the Makefile only chains their commands.

```bash
make install                     # bun install in dapp/ and worker/
cp worker/.dev.vars.example worker/.dev.vars   # secrets, can override any var
make dev                         # app on http://localhost:5173, worker behind /api
```

Open the app on `localhost`, not `127.0.0.1`: browser wallet extensions
such as xBull only inject themselves on `localhost` and `https` origins,
and the OAuth redirect URIs are registered for `localhost`. The worker
refuses every request until its configuration is complete and
`/api/config` names what is missing. Public values live in
`worker/wrangler.jsonc`, secrets in `worker/.dev.vars` locally and in
`wrangler secret put` in production.

`make dev` runs the worker under Bun on port 8787 and Vite proxies `/api`
to it. `cd worker && bun run dev:workerd` runs it under the Cloudflare
runtime instead, on the same port, when that runtime can reach the network
on your machine.

Contract work goes through `make` too (`make help` lists the targets):

```bash
make test                        # contract tests
make lint                        # clippy and rustfmt
make bindings                    # regenerate dapp/src/bindings and worker/src/bindings
```

The bindings are committed: they change only with the contract, and each
package keeps its own copy so that it resolves them like its own code.

### OAuth apps

One app per provider; the redirect URI is `<origin>/oauth/callback/<provider>`.

**Discord**, https://discord.com/developers/applications, New Application:

- OAuth2, Client ID to `DISCORD_CLIENT_ID`, Client Secret to
  `DISCORD_CLIENT_SECRET`.
- Redirects, exact match including the port:
  `http://localhost:5173/oauth/callback/discord` and the production URL.
- No bot is needed. Scopes used: `identify email guilds.members.read`.
- `DISCORD_GUILD_ID` is the Stellar Developers server, `897514728459468821`.
- `DISCORD_ROLE_MAP` maps the server's role ids to 0 Verified, 1 Pathfinder,
  2 Navigator, 3 Pilot. Copy role ids from Server Settings, Roles, with
  Developer Mode on.

**GitHub**, Settings, Developer settings, OAuth Apps, New OAuth App:

- Callback URLs: `http://localhost:5173/oauth/callback/github` and the
  production URL. Disable wildcard matching.
- Client ID to `GITHUB_CLIENT_ID`, generate a client secret to
  `GITHUB_CLIENT_SECRET`. Scopes used: `read:user user:email`.

The contract also knows an X provider (id 2) for accounts bound before X
verification was dropped: the app shows them and lets their owner remove
them, and never offers to verify one.

### Roles during the migration

With `ROLE_SOURCE=discord`, the role at mint comes from the member's roles on
the Discord server through `DISCORD_ROLE_MAP`. Once existing members are
onboarded, set `ROLE_SOURCE=verified`: new members mint as Verified and
roles change with `set_role` from the admin panel.

### Wallets

Any wallet of Stellar Wallets Kit connects. Rotating the key needs a wallet
that signs authorization entries (Freighter, Lobstr, Albedo); xBull does not.
The admin moves a membership with its own signature only, since the member
is not present.

### Caching

Members are read straight from the ledger, 100 per RPC call (two keys
each), newest first, and only when the list scrolls that far. A filter by
role, project or text loads the remaining pages while it shows results. The
NQG score is one simulation per member through the contract, read when its
card is on screen.

The member queries are kept in the browser (IndexedDB) between visits and
refreshed in the background after ten minutes. A transaction refreshes only
the members it touched. The app is a PWA: the service worker caches the
app shell, profiles and pictures from IPFS, avatars and project lookups;
the other API calls and the RPC are never cached by it.

## Testing

```bash
make test                        # contract: one test per user flow
make test-js                     # shared helpers, dapp, worker
make smoke                       # end to end on testnet
make lint-js && make build-dapp
```

The contract tests cover each flow with its authorizations, events and
errors. The worker tests cover what guards identity: the attester's checks,
the claim signatures, the Discord guild and roles, the CID bound to a signed
transaction and the configuration. The smoke script runs the real flows
against testnet through the worker: mint, accounts update, profile on IPFS,
projects, key rotation, recovery proposal and cancellation, admin recover.
It uses only the two identities of the deployment, `stellar-members-testnet`
(admin, also the member) and the attester from `worker/.dev.vars`, and
leaves the admin holding its membership. There is no browser suite: the wallet flows
would need a wallet mock.

## Deployment

Users never pick a network: staging runs on testnet and production on
mainnet, and the app shows no trace of which one it is on. The only values
that differ are `NETWORK`, `NETWORK_PASSPHRASE`, `RPC_URL`, `CONTRACT_ID`
and `ATTESTER_PUBLIC` (with its secret). OAuth apps, IPFS and the other
secrets are shared. Production is added as an `env.mainnet` block in
`worker/wrangler.jsonc` once the contract is deployed there.

```bash
make deploy network=testnet           # deploy the contract, writes contracts/deployments/
make upgrade network=testnet          # upgrade it in place
make invoke fn=member args="--token_id 0"
cd worker && bunx wrangler secret put ATTESTER_SECRET   # and the other secrets of .dev.vars.example
make deploy-worker
VITE_API_URL=https://api.example.org make build-dapp    # the app, in dapp/dist
```

The app is static: upload `dapp/dist` to any host that serves `index.html`
for unknown paths (the routes are client side), with `VITE_API_URL` set to
the worker's origin at build time. The worker allows every origin: it is
public, stateless and rate limited, nothing in it trusts the origin.

The contract is deployed by the `stellar-members-<network>` identity of the
Stellar CLI (the admin) with `stellar-members-attester-<network>` as the
attester. The attester account only needs to exist on the ledger, with the
minimum balance, for its signatures to verify; it never pays fees. If its
key leaks, the admin replaces it from the admin panel and the worker secret
is updated.

The NQG score comes from the Neural Quorum Governance contract of the
Stellar Community Fund. Its address is given to the membership contract at
deployment, `nqg_contract` in the Makefile.
