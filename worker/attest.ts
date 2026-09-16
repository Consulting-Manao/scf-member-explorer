/**
 * Co-signature of auth entries by the attester.
 *
 * The attester vouches that external accounts (and the role at mint) were
 * verified through OAuth for the address that also authorizes the call.
 * It only signs its own `SorobanAuthorizationEntry`, never a transaction.
 */

import {
  authorizeEntry,
  buildInvocationTree,
  type ExecuteInvocation,
  inspectAuthEntry,
  type Keypair,
  xdr,
} from "@stellar/stellar-sdk";

import {
  PROVIDER_ID,
  toHex,
  type Claim,
  type SocialAccount,
} from "@shared/membership";

/** Maximum validity of a signature, about 10 minutes. */
export const MAX_VALIDITY_LEDGERS = 120;

export class AttestError extends Error {}

export interface MemberValue {
  status: number;
  role: number;
  external_accounts: {
    accounts: SocialAccount[];
    email_hash?: Uint8Array | null;
  };
}

export interface AttestContext {
  contractId: string;
  attester: Keypair;
  networkPassphrase: string;
  latestLedger: number;
  /** Claims with verified signature and expiry. */
  claims: Claim[];
  owner: (tokenId: number) => Promise<string | null>;
  member: (tokenId: number) => Promise<MemberValue | null>;
}

interface Invocation {
  functionName: string;
  args: unknown[];
}

function fail(message: string): never {
  throw new AttestError(message);
}

function decodeInvocation(
  entry: xdr.SorobanAuthorizationEntry,
  ctx: AttestContext,
): Invocation {
  const info = inspectAuthEntry(entry);
  if (info.address === null) fail("Expected address credentials");
  if (info.address !== ctx.attester.publicKey()) fail("Not an attester entry");
  if (info.signers.length !== 1) fail("Unexpected delegated signers");

  const tree = buildInvocationTree(info.invocation);
  if (tree.invocations.length > 0) fail("Unexpected sub-invocation");
  if (tree.type !== "execute") fail("Expected a contract call");
  const call = tree.args as ExecuteInvocation;
  if (call.source !== ctx.contractId) fail("Unexpected contract");

  return { functionName: call.function, args: call.args };
}

function claimsFor(address: unknown, ctx: AttestContext): Claim[] {
  if (ctx.claims.length === 0) fail("No verified account");
  if (ctx.claims.some((claim) => claim.address !== address)) {
    fail("Accounts were verified for another address");
  }
  return ctx.claims;
}

function sameAccount(a: SocialAccount, b: SocialAccount): boolean {
  return a.provider === b.provider && a.id === b.id && a.handle === b.handle;
}

function asAccounts(value: unknown): {
  accounts: SocialAccount[];
  emailHash: string | null;
} {
  const external = value as MemberValue["external_accounts"];
  if (!external || !Array.isArray(external.accounts)) {
    fail("Malformed external accounts");
  }
  return {
    accounts: external.accounts,
    emailHash: external.email_hash ? toHex(external.email_hash) : null,
  };
}

/**
 * Every account is either verified by a claim or already on-chain. The
 * resulting set must keep a Discord account.
 */
function checkAccounts(
  value: unknown,
  claims: Claim[],
  current: ReturnType<typeof asAccounts> = { accounts: [], emailHash: null },
): void {
  const { accounts, emailHash } = asAccounts(value);
  const verified: SocialAccount[] = claims.map((claim) => ({
    provider: PROVIDER_ID[claim.provider],
    id: claim.id,
    handle: claim.handle,
  }));

  for (const account of accounts) {
    const known = [...verified, ...current.accounts].some((other) =>
      sameAccount(account, other),
    );
    if (!known) fail("Account not verified");
  }
  if (!accounts.some((account) => account.provider === PROVIDER_ID.discord)) {
    fail("A Discord account is required");
  }
  if (
    emailHash !== null &&
    emailHash !== current.emailHash &&
    !claims.some((claim) => claim.emailHash === emailHash)
  ) {
    fail("Email not verified");
  }
}

async function checkMint(args: unknown[], ctx: AttestContext): Promise<void> {
  const [to, role, external] = args;
  if (args.length !== 3) fail("Unexpected arguments");
  const claims = claimsFor(to, ctx);

  const discord = claims.find((claim) => claim.provider === "discord");
  if (!discord) fail("A Discord account is required");
  if (role !== (discord.role ?? 0)) fail("Role not granted");

  checkAccounts(external, claims);
}

async function checkSetExternalAccounts(
  args: unknown[],
  ctx: AttestContext,
): Promise<void> {
  const [tokenId, external] = args;
  if (args.length !== 2 || typeof tokenId !== "number") {
    fail("Unexpected arguments");
  }
  const owner = await ctx.owner(tokenId);
  if (!owner) fail("Not an active member");
  const claims = claimsFor(owner, ctx);

  const member = await ctx.member(tokenId);
  if (!member) fail("Not an active member");
  checkAccounts(external, claims, asAccounts(member.external_accounts));
}

/** At least two matching accounts, or the only one the member has. */
async function checkProposeRecovery(
  args: unknown[],
  ctx: AttestContext,
): Promise<void> {
  const [tokenId, newAddress] = args;
  if (args.length !== 2 || typeof tokenId !== "number") {
    fail("Unexpected arguments");
  }
  const claims = claimsFor(newAddress, ctx);

  const member = await ctx.member(tokenId);
  if (!member || member.status !== 0) fail("Not an active member");

  const accounts = member.external_accounts.accounts;
  const required = Math.min(2, accounts.length);
  if (required === 0) fail("The member has no verified account");

  const matches = accounts.filter((account) =>
    claims.some(
      (claim) =>
        PROVIDER_ID[claim.provider] === account.provider &&
        claim.id === account.id,
    ),
  );
  if (matches.length < required) {
    fail(`Prove ${required} of the member's accounts`);
  }
}

const CHECKS: Record<
  string,
  (args: unknown[], ctx: AttestContext) => Promise<void>
> = {
  mint: checkMint,
  set_external_accounts: checkSetExternalAccounts,
  propose_recovery: checkProposeRecovery,
};

/** Verify an attester auth entry against the claims and sign it. */
export async function attest(
  entryXdr: string,
  validUntilLedger: number,
  ctx: AttestContext,
): Promise<string> {
  let entry: xdr.SorobanAuthorizationEntry;
  try {
    entry = xdr.SorobanAuthorizationEntry.fromXdr(entryXdr, "base64");
  } catch {
    fail("Malformed auth entry");
  }

  if (
    validUntilLedger <= ctx.latestLedger ||
    validUntilLedger > ctx.latestLedger + MAX_VALIDITY_LEDGERS
  ) {
    fail("Invalid signature expiration");
  }

  const { functionName, args } = decodeInvocation(entry, ctx);
  const check = CHECKS[functionName];
  if (!check) fail(`Cannot attest ${functionName}`);
  await check(args, ctx);

  const signed = await authorizeEntry(
    entry,
    ctx.attester,
    validUntilLedger,
    ctx.networkPassphrase,
  );
  return signed.toXdr("base64");
}
