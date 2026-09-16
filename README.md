# Stellar Members

Onboarding, directory and management of the Stellar community membership.

A member is a soulbound NFT of the `stellar-membership` contract
(`contracts/stellar-membership` in the Tansu repository). **The token id is the identity of a person**: the address holding
it is only the current key, which can be rotated or recovered.

- Join: verify Discord (required, must be on the Stellar Discord server),
  GitHub and X, list projects from [PG Atlas](https://www.pgatlas.xyz), write
  a profile, mint.
- Manage: edit profile, projects and accounts, rotate the key.
- Recover: lost key, prove two accounts from a new account. The membership
  moves after 7 days unless the current key or an admin cancels it. An admin
  can approve earlier.
- Admin: pending recoveries, roles, revocation, attester rotation.

## Architecture

```
browser ──── Stellar RPC     reads (ledger entries) and transactions
   │
   └── /api  Cloudflare Worker (same deployment as the app)
             ├─ oauth    code exchange, returns a signed claim
             ├─ attest   co-signs auth entries matching verified claims
             ├─ ipfs     uploads profile CARs to Filebase
             └─ projects PG Atlas proxy
```

The worker is small and stateless. It holds the **attester** key, which
only signs `SorobanAuthorizationEntry` for `mint`, `set_external_accounts`
and `propose_recovery` after checking the arguments against OAuth claims.
The member always authorizes the call too, so the attester alone cannot act
on anyone's membership. It never signs transactions nor holds funds.

On-chain data per member: role, external accounts (provider id and handle),
sha256 of a verified email (same hash as PG Atlas contributors), IPFS CID of
the profile, DAOIP-5 project ids.

| Path               | Content                                                     |
| ------------------ | ----------------------------------------------------------- |
| `src/`             | React app: TanStack Router and Query, Tailwind, Wallets Kit |
| `worker/`          | Hono API                                                    |
| `shared/`          | Types and helpers used by both                              |
| `packages/`        | Contract bindings, generated                                |
| `scripts/smoke.ts` | End-to-end flows on testnet                                 |

## Development

```bash
bun install
cp .dev.vars.example .dev.vars   # secrets, can override any var
bun dev                          # app and worker on http://127.0.0.1:5173
```

Open the app on `127.0.0.1`, not `localhost`: the OAuth redirect URIs are
registered for `127.0.0.1`.

The worker refuses every request until its configuration is complete and
`/api/config` names what is missing. Public values live in `wrangler.jsonc`,
secrets in `.dev.vars` locally and in `wrangler secret put` in production.

If the local Cloudflare runtime cannot reach the network on your machine,
run the worker with Bun instead and let Vite proxy `/api` to it:

```bash
bun run dev:api                  # http://127.0.0.1:8787
bun run dev:app                  # Vite with API_PROXY set
```

```bash
bun run lint
bun run typecheck
bun run test
bun run smoke                    # testnet flows with the kept identities
bun run card                     # render public/social-card.png
```

The smoke test only uses the two Stellar CLI identities of the deployment,
`stellar-members-testnet` (admin, also the member) and the attester from
`.dev.vars`, and leaves the admin holding its membership.

After a contract change, regenerate the bindings:

```bash
CONTRACT_ID=C… bun run bindings
```

### OAuth apps

Discord and GitHub are required, X is optional. Register one app per
provider; the redirect URI is `<origin>/oauth/callback/<provider>`.

**Discord**, https://discord.com/developers/applications, New Application:

- OAuth2, Client ID to `DISCORD_CLIENT_ID`, Client Secret to
  `DISCORD_CLIENT_SECRET`.
- Redirects, exact match including the port:
  `http://127.0.0.1:5173/oauth/callback/discord` and the production URL.
- No bot is needed. Scopes used: `identify email guilds.members.read`.
- `DISCORD_GUILD_ID` is the Stellar Developers server, `897514728459468821`.
- `DISCORD_ROLE_MAP` maps the server's role ids to 0 Verified, 1 Pathfinder,
  2 Navigator, 3 Pilot. Copy role ids from Server Settings, Roles, with
  Developer Mode on.

**GitHub**, Settings, Developer settings, OAuth Apps, New OAuth App:

- Callback URLs: `http://127.0.0.1/oauth/callback/github` (no port, GitHub
  accepts any loopback port) and the production URL. Disable wildcard
  matching.
- Client ID to `GITHUB_CLIENT_ID`, generate a client secret to
  `GITHUB_CLIENT_SECRET`. Scopes used: `read:user user:email`.

**X**, https://console.x.com, only if wanted: app type Web App (confidential),
callback `http://127.0.0.1:5173/oauth/callback/x` exact, `X_CLIENT_ID` and
`X_CLIENT_SECRET`. The X API is pay-per-use, about $0.01 per verification
from prepaid credits; an empty balance blocks verification.

### Roles during the migration

With `ROLE_SOURCE=discord`, the role at mint comes from the member's roles on
the Discord server through `DISCORD_ROLE_MAP`. Once existing members are
onboarded, set `ROLE_SOURCE=verified`: new members mint as Verified and
roles change with `set_role` from the admin.

### Wallets

Any wallet of Stellar Wallets Kit connects. Rotating the key needs a wallet
that signs authorization entries (Freighter, Lobstr, Albedo); xBull does not.
The admin moves a membership with its own signature only, since the member
is not present. xBull is listed only when its extension is injected
on the page: in Brave, allow the extension on all sites.

## Testing

Unit tests cover the worker checks and the shared helpers. There is no
browser end-to-end suite yet: the wallet flows need a wallet mock. The
smoke script exercises the on-chain flows through the worker instead.

## Deployment

```bash
wrangler secret put ATTESTER_SECRET   # and the other secrets of .dev.vars.example
bun run deploy                        # staging, on testnet
```

Users never pick a network: staging runs on testnet and production on
mainnet, and the app shows no trace of which one it is on. The only values
that differ between the two are `NETWORK`, `NETWORK_PASSPHRASE`, `RPC_URL`,
`CONTRACT_ID` and `ATTESTER_PUBLIC` (with its secret). OAuth apps, IPFS and
the other secrets are shared. Production is added as an `env.mainnet` block
in `wrangler.jsonc` once the contract is deployed there.

The attester is an unfunded account. If its key leaks, the admin calls
`set_attester` with a new key and the secret is replaced.

## Reading members from other services

No database is needed, read the contract:

- `token_by_account(provider, id)`: token of a Discord (0), GitHub (1) or X
  (2) account id, e.g. to map a Discord user to a member.
- `member(token_id)`: role, status, accounts, email hash, profile CID,
  projects.
- `owner_of(token_id)`, `token_of(address)`, `governance(token_id)`.

Changes are published as events with the token id as topic: `minted`,
`role_set`, `external_accounts_set`, `bio_set`, `projects_set`,
`key_rotated`, `recovery_proposed`, `recovery_cancelled`, `recovered`,
`revoked`. Subscribe with RPC `getEvents` filtered on the contract.
