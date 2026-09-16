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
bun dev                          # app and worker on http://localhost:5173
```

If the local Cloudflare runtime cannot reach the network on your machine,
run the worker with Bun instead and let Vite proxy `/api` to it:

```bash
bun run dev:api                  # http://127.0.0.1:8787
bun run dev:app                  # Vite with API_PROXY set
```

Public configuration is in `wrangler.jsonc` and served to the app on
`/api/config`. Set `CONTRACT_ID` and `ATTESTER_PUBLIC` there, or in
`.dev.vars` for local testing.

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

Register one app per provider with the redirect URI
`https://<domain>/oauth/callback/<provider>`, and set the client id var and
secret.

| Provider | Scopes                               | Notes                                    |
| -------- | ------------------------------------ | ---------------------------------------- |
| Discord  | `identify email guilds.members.read` | `DISCORD_GUILD_ID`: the Stellar server   |
| GitHub   | `read:user user:email`               | primary verified email                   |
| X        | `users.read tweet.read`              | OAuth 2.0 with PKCE, confidential client |

### Roles during the migration

With `ROLE_SOURCE=discord`, the role at mint comes from the member's roles on
the Discord server through `DISCORD_ROLE_MAP` (Discord role id to 0 Verified,
1 Pathfinder, 2 Navigator, 3 Pilot). Once existing members are onboarded,
set `ROLE_SOURCE=verified`: new members mint as Verified and roles change
with `set_role` from the admin.

## Testing

Unit tests cover the worker checks and the shared helpers. There is no
browser end-to-end suite yet: the wallet flows need a wallet mock. The
smoke script exercises the on-chain flows through the worker instead.

## Deployment

```bash
wrangler secret put ATTESTER_SECRET   # and the other secrets of .dev.vars.example
bun run deploy                        # testnet
bun run build && wrangler deploy --env mainnet
```

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
