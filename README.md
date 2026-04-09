# SCF Member Explorer

Client-side explorer for Stellar Community Fund membership NFTs. Reads on-chain token data from a [SEP-50](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0050.md) compliant contract, enriches it with [Tansu](https://tansu.dev) membership profiles, and displays governance scores computed by [Neural Quorum Governance](https://github.com/stellar/stellar-community-fund-contracts).

## Standards and contracts

### SEP-50 — Smart Contract NFTs

[SEP-50](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0050.md) defines a standard interface for NFTs on Soroban. The explorer reads the following contract methods:

| Method | Returns |
|---|---|
| `name()` / `symbol()` | Collection metadata |
| `token_uri(token_id)` | IPFS URI pointing to token metadata (name, description, image, attributes) |
| `owner_of(token_id)` | Stellar address of the current owner |
| `governance(token_id)` | Dynamic on-chain traits (role, NQG score) |
| `trait_metadata_uri()` | Display instructions for dynamic traits (decimals, value mappings) |
| `next_token_id()` | Used to determine total minted supply |

All calls are read-only, executed via `simulateTransaction` with a throwaway keypair — no wallet connection or signing required.

### Dynamic traits

SEP-50 distinguishes between **static attributes** (immutable, stored in IPFS metadata) and **dynamic traits** (mutable, returned by `governance()`). This explorer renders both.

`trait_metadata_uri()` returns an IPFS document describing how to interpret dynamic trait values: decimal precision, human-readable labels via value mappings, and display names. For example, `nqg_score` is stored on-chain as a scaled integer and the trait metadata specifies the number of decimals to apply.

### Neural Quorum Governance (NQG)

NQG is the governance framework used by the Stellar Community Fund. Scores reflect a member's participation and standing as evaluated by a quorum of neurons — automated agents that assess governance activity off-chain and write results on-chain.

The `nqg_score` dynamic trait on each membership NFT is the output of this process. The contracts and neuron implementations live in [stellar-community-fund-contracts](https://github.com/stellar/stellar-community-fund-contracts).

### Tansu membership

Each NFT is owned by a Stellar address. The explorer resolves that address against the [Tansu](https://tansu.dev) membership contract (`get_member(address)`), which returns an IPFS CID pointing to a profile directory:

```
<cid>/
  profile.json       # { name, description, links, ... }
  profile-image.png   # member avatar
```

When a member profile exists, the explorer uses the member's name and picture in place of the raw address and default token image. The original token image is preserved as a small overlay thumbnail.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Browser                         │
│  React + TypeScript + @stellar/stellar-sdk          │
│                                                     │
│  simulateTransaction()                              │
│       │                  │                          │
│       ▼                  ▼                          │
│  ┌─────────┐      ┌───────────┐                    │
│  │   NFT   │      │   Tansu   │                    │
│  │Contract │      │ Contract  │                    │
│  │(SEP-50) │      │(Members)  │                    │
│  └────┬────┘      └─────┬─────┘                    │
│       │                  │                          │
│       │   IPFS CIDs      │                          │
│       ▼                  ▼                          │
│  ┌──────────────────────────┐                      │
│  │      IPFS Gateway        │                      │
│  │  Token metadata          │                      │
│  │  Trait metadata          │                      │
│  │  Member profiles         │                      │
│  └──────────────────────────┘                      │
└─────────────────────────────────────────────────────┘
```

The application is entirely client-side. There is no backend, no API server, no database. All state is read from Soroban RPC and IPFS at render time, with in-memory caching for the session.

## Configuration

Network and contract addresses are defined in `src/config/networks.ts`:

```ts
export const NETWORK = "testnet" as const;
export const CONTRACT_ADDRESS = "CATJ45...";       // SEP-50 NFT contract
export const TANSU_CONTRACT_ADDRESS = "CBXKU...";  // Tansu membership contract
```

Switch `NETWORK` between `"testnet"` and `"mainnet"` to change the target environment. RPC URLs, network passphrase, and explorer links are derived automatically.

## Tech stack

React, Vite, TypeScript, Tailwind CSS, `@stellar/stellar-sdk`, TanStack Query.

## References

- [SEP-50 — Smart Contract NFTs](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0050.md)
- [NQG Contracts](https://github.com/stellar/stellar-community-fund-contracts)
- [SCF Handbook — Verified Members](https://stellar.gitbook.io/scf-handbook/governance/verified-members)
- [SCF Handbook — Neural Quorum Governance](https://stellarcommunityfund.gitbook.io/scf-handbook/community-involvement/governance/neural-quorum-governance)
- [Tansu](https://tansu.dev)
- [Stellar Community Fund](https://communityfund.stellar.org)
