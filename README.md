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
  admin cancels; an admin can approve sooner, and the request lapses if it
  is left unfinalized for another 7 days.
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
For a mint and an accounts change the member signs too, so the attester
alone cannot touch a membership. A recovery is the exception by design: it
is proposed by the attester and the new key, which is why it only takes
effect after seven days, lapses seven days later, and can be cancelled by
the member or the admin — and why replacing the attester voids everything
it proposed. The worker never
submits a transaction: the member's wallet is the source and pays the fees.

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
- `set_admin`, `set_attester`, `set_nqg_contract` and `upgrade` (admin).
  The name, the symbol and the two URIs have no setter: changing one is an
  upgrade.
- `extend_member(token_id)`: anyone, no signature. Writing to a member
  carries its entries forward, but only an active token takes writes, so a
  revoked record and the accounts it reserves would archive after 120 days
  and read as missing. This is what keeps them there.

What the contract trusts, and what it does not promise:

- The admin is trusted without reserve. `recover` moves any token, active
  or revoked, to any address on the admin's signature alone, with no delay,
  no cancellation window and no signature from the receiving key; `revoke`,
  `set_role` and `upgrade` are equally unilateral. An admin move is
  published as `admin_recovered`, never as `recovered`, so it is never read
  as a recovery the member asked for.
- The admin and the attester must never be the same key. The attester is
  online to co-sign every mint and is therefore the exposed one; the admin
  cancelling its proposals is the whole defence, and one key for both drops
  it.
- The seven days of a recovery are a watch period, not a safety property:
  they are worth what the monitoring behind them is worth. An alert to the
  admin on `recovery_proposed` is part of the design, not an operational
  extra. Nothing rate limits proposals either, so an attester holding the
  key can re-propose the moment one is cancelled.
- A recovery has to be finalized within seven days of becoming executable,
  after which it lapses. Replacing the attester voids what it proposed:
  `finalize_recovery` panics with `AttesterChanged`.
- The external accounts are public and permanent. Discord and GitHub ids
  and handles are stored as given; `email_hash` is a plain sha256, which a
  dictionary reverses for any address someone can guess, so it identifies
  about as well as the address does — it is the hash PG Atlas uses, and
  matching it is the point. A revoked record keeps all of it, and the only
  way to clear it needs the member's own key with the attester.

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
`/api/config?network=testnet` names what is missing. Public values live in
`worker/wrangler.jsonc`, secrets in `worker/.dev.vars` locally and in
Cloudflare in production, pushed there with `make deploy-secrets`.

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
the members it touched. The app is a PWA: the service worker precaches the
whole shell and caches profiles and pictures from IPFS, avatars, project
lookups and the configuration, so an installed app opens without the
network and shows what it last read. The RPC, the OAuth exchange and the
attestation are never cached.

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

Users never pick a network: a build of the app is for one network and shows
no trace of which one it is on. The worker is not: a single deployment
serves every network it is configured for, and each call names the one it
is for with `?network=`. Naming a network selects all of its settings at
once — `<NETWORK>_PASSPHRASE`, `_RPC_URL`, `_CONTRACT_ID`,
`_ATTESTER_PUBLIC` and the secret `_ATTESTER_SECRET` — so a request can
choose its network but never mix two, and the attester of one network never
signs for another. OAuth apps, IPFS and the other secrets are shared.
A network is served once it has all five: mainnet already has its
passphrase and RPC in `wrangler.jsonc` and joins the day its contract is
deployed and its attester key exists. Until then it is simply not served,
and nothing else is affected.

```bash
make deploy network=testnet           # deploy the contract, writes contracts/deployments/
make upgrade network=testnet          # upgrade it in place
make invoke fn=member args="--token_id 0"
make deploy-secrets                    # every secret of worker/.dev.vars, in one call
make deploy-worker
make pages-init                        # once, prepares the pages branch
make deploy-pages                      # build the app and publish it
```

The app is published on Radicle Pages, which serves the `pages` branch of
the Radicle repository. `make pages-init` prepares it once: it adds the
canonical reference rule for `refs/heads/pages` to the identity document,
since Radicle wants to know how delegates converge on a branch, and checks
that branch out as an orphan worktree in `pages/`. `make deploy-pages` then
builds the app against the deployed worker, copies it into that worktree,
commits and pushes; every push redeploys. `dapp/public/_redirects` serves
`index.html` for the paths the build does not contain, as the routes are
client side, and the files that exist keep precedence. The rest happens
once on radicle.garden: add the repository, then Settings, Pages, Publish.

Radicle Pages serves the repository under its alias, so the app is built
for a path rather than for a domain of its own. `BASE_PATH` is where that
path is written down, once, as the `base` variable of `deploy-pages`; the
router, the manifest, the service worker scope and the OAuth redirect read
it back through `import.meta.env.BASE_URL`. A domain of its own is the
default, `make deploy-pages base=/`. Whatever the path is, each provider's
OAuth app must list its callback: today
`https://consulting-manao.radicle.page/stellar-members/oauth/callback/discord`
and the same for GitHub.

Any other static host works the same way: upload `dapp/dist` somewhere that
serves `index.html` for unknown paths, with `VITE_API_URL` set to the
worker's origin at build time. The worker allows every origin: it is
public, stateless and rate limited, nothing in it trusts the origin.

The contract is deployed by the `stellar-members-<network>` identity of the
Stellar CLI (the admin) with `stellar-members-attester-<network>` as the
attester. The attester account only needs to exist on the ledger, with the
minimum balance, for its signatures to verify; it never pays fees. If its
key leaks, the admin replaces it from the admin panel and the worker secret
is updated; `set_attester` also voids the recoveries the old key proposed,
so they do not have to be cancelled one by one before their delay runs out.

The NQG score comes from the Neural Quorum Governance contract of the
Stellar Community Fund. Its address is given to the membership contract at
deployment, `nqg_contract` in the Makefile, and `set_nqg_contract` changes
it afterwards. A wrong address reads as a score of zero for everyone rather
than failing, so confirm with `governance` on a member known to have one.
