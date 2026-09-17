import {
  Address,
  authorizeInvocation,
  inspectAuthEntry,
  Keypair,
  Networks,
  xdr,
} from "@stellar/stellar-sdk";
import { Client } from "stellar-membership";
import { describe, expect, it } from "vitest";

import {
  accountOf,
  type Claim,
  type MemberRecord,
} from "@stellar-membership/shared";

import {
  attest,
  AttestError,
  MAX_VALIDITY_LEDGERS,
  type AttestContext,
} from "./attest";

const networkPassphrase = Networks.TESTNET;
const attester = Keypair.random();
const member = Keypair.random().publicKey();
const contractId = "CATJ45GRCHCTXLR4H2GKTUW7L5CBCKYO6P3PTRLHPASBIVT3BESZ37WN";
const latestLedger = 1_000;

const spec = new Client({
  contractId,
  networkPassphrase,
  rpcUrl: "https://soroban-testnet.stellar.org",
}).spec;

const discord: Claim = {
  address: member,
  provider: "discord",
  id: "123456789",
  handle: "grogu",
  role: 3,
  emailHash: "aa".repeat(32),
};
const github: Claim = {
  address: member,
  provider: "github",
  id: "42",
  handle: "grogu-gh",
  emailHash: "bb".repeat(32),
};

function external(claims: Claim[], emailHash?: string) {
  return {
    accounts: claims.map(accountOf),
    email_hash: emailHash ? Buffer.from(emailHash, "hex") : undefined,
  };
}

async function entryFor(
  functionName: string,
  args: xdr.ScVal[],
  options: { signer?: Keypair; contract?: string } = {},
): Promise<string> {
  const invocation = new xdr.SorobanAuthorizedInvocation({
    function:
      xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: new Address(
            options.contract ?? contractId,
          ).toScAddress(),
          functionName,
          args,
        }),
      ),
    subInvocations: [],
  });
  const entry = await authorizeInvocation({
    signer: options.signer ?? attester,
    validUntilLedgerSeq: latestLedger + 10,
    invocation,
    networkPassphrase,
  });
  return entry.toXdr("base64");
}

/** The attester entry of mint only covers (to, role, external_accounts). */
function mintArgs(
  to: string,
  role: number,
  accounts: ReturnType<typeof external>,
): xdr.ScVal[] {
  return spec
    .funcArgsToScVals("mint", {
      to,
      role,
      external_accounts: accounts,
      bio: "",
      projects: [],
    })
    .slice(0, 3);
}

const onChain: MemberRecord = {
  status: 0,
  role: 0,
  external_accounts: {
    accounts: [accountOf(discord), accountOf(github)],
    email_hash: Buffer.from(discord.emailHash!, "hex"),
  },
  bio: "",
  projects: [],
};

function context(overrides: Partial<AttestContext> = {}): AttestContext {
  return {
    contractId,
    attester,
    networkPassphrase,
    latestLedger,
    claims: [discord, github],
    owner: async () => member,
    member: async () => onChain,
    ...overrides,
  };
}

async function rejects(promise: Promise<unknown>, message: string | RegExp) {
  await expect(promise).rejects.toThrow(AttestError);
  await expect(promise).rejects.toThrow(message);
}

describe("attest mint", () => {
  it("signs verified accounts and role", async () => {
    const entry = await entryFor(
      "mint",
      mintArgs(member, 3, external([discord, github], github.emailHash)),
    );
    const signed = await attest(entry, latestLedger + 60, context());

    const info = inspectAuthEntry(
      xdr.SorobanAuthorizationEntry.fromXdr(signed, "base64"),
    );
    expect(info.address).toBe(attester.publicKey());
    expect(info.signatureExpirationLedger).toBe(latestLedger + 60);
    expect(info.signed).toBe(true);
  });

  it("rejects a role that was not granted", async () => {
    const entry = await entryFor(
      "mint",
      mintArgs(member, 2, external([discord])),
    );
    await rejects(attest(entry, latestLedger + 60, context()), "Role");
  });

  it("rejects an account that was not verified", async () => {
    const forged = { ...github, handle: "someone-else" };
    const entry = await entryFor(
      "mint",
      mintArgs(member, 3, external([discord, forged])),
    );
    await rejects(
      attest(entry, latestLedger + 60, context()),
      "Account not verified",
    );
  });

  it("rejects an email that was not verified", async () => {
    const entry = await entryFor(
      "mint",
      mintArgs(member, 3, external([discord], "cc".repeat(32))),
    );
    await rejects(attest(entry, latestLedger + 60, context()), "Email");
  });

  it("only signs its own entries on this contract", async () => {
    const args = mintArgs(member, 3, external([discord]));

    const wrongSigner = await entryFor("mint", args, {
      signer: Keypair.random(),
    });
    await rejects(
      attest(wrongSigner, latestLedger + 60, context()),
      "Not an attester entry",
    );

    const wrongContract = await entryFor("mint", args, {
      contract: "CBXKUSLQPVF35FYURR5C42BPYA5UOVDXX2ELKIM2CAJMCI6HXG2BHGZA",
    });
    await rejects(
      attest(wrongContract, latestLedger + 60, context()),
      "Unexpected contract",
    );

    const wrongFunction = await entryFor("set_role", args);
    await rejects(
      attest(wrongFunction, latestLedger + 60, context()),
      "Cannot attest",
    );
  });

  it("bounds the signature expiration", async () => {
    const entry = await entryFor(
      "mint",
      mintArgs(member, 3, external([discord])),
    );
    await rejects(attest(entry, latestLedger, context()), "expiration");
    await rejects(
      attest(entry, latestLedger + MAX_VALIDITY_LEDGERS + 1, context()),
      "expiration",
    );
  });

  it("rejects garbage", async () => {
    await rejects(attest("AAAA", latestLedger + 60, context()), "Malformed");
  });
});

describe("attest set_external_accounts", () => {
  function args(tokenId: number, accounts: ReturnType<typeof external>) {
    return spec.funcArgsToScVals("set_external_accounts", {
      token_id: tokenId,
      external_accounts: accounts,
    });
  }

  it("accepts a new verified account next to existing ones", async () => {
    const x: Claim = { address: member, provider: "x", id: "7", handle: "g" };
    const entry = await entryFor(
      "set_external_accounts",
      args(0, external([discord, github, x], discord.emailHash)),
    );
    await attest(entry, latestLedger + 60, context({ claims: [x] }));
  });

  it("rejects removing Discord", async () => {
    const entry = await entryFor(
      "set_external_accounts",
      args(0, external([github])),
    );
    await rejects(attest(entry, latestLedger + 60, context()), "Discord");
  });

  it("rejects inactive tokens", async () => {
    const entry = await entryFor(
      "set_external_accounts",
      args(0, external([discord])),
    );
    await rejects(
      attest(entry, latestLedger + 60, context({ owner: async () => null })),
      "Not an active member",
    );
  });
});

describe("attest propose_recovery", () => {
  const newKey = Keypair.random().publicKey();
  const recovered = (claim: Claim): Claim => ({ ...claim, address: newKey });

  function args(tokenId: number) {
    return spec.funcArgsToScVals("propose_recovery", {
      token_id: tokenId,
      new_address: newKey,
    });
  }

  it("requires two matching accounts, or the only one of the member", async () => {
    const entry = await entryFor("propose_recovery", args(0));
    await attest(
      entry,
      latestLedger + 60,
      context({ claims: [recovered(discord), recovered(github)] }),
    );
    await rejects(
      attest(
        entry,
        latestLedger + 60,
        context({ claims: [recovered(discord)] }),
      ),
      "Prove 2",
    );

    const single: MemberRecord = {
      ...onChain,
      external_accounts: { accounts: [accountOf(discord)] },
    };
    await attest(
      entry,
      latestLedger + 60,
      context({ claims: [recovered(discord)], member: async () => single }),
    );
  });

  it("matches on ids, handles may have changed", async () => {
    const entry = await entryFor("propose_recovery", args(0));
    await attest(
      entry,
      latestLedger + 60,
      context({
        claims: [
          { ...recovered(discord), handle: "renamed" },
          recovered(github),
        ],
      }),
    );
  });

  it("requires claims, issued for the new address", async () => {
    const entry = await entryFor("propose_recovery", args(0));
    await rejects(
      attest(entry, latestLedger + 60, context()),
      "another address",
    );
    await rejects(
      attest(entry, latestLedger + 60, context({ claims: [] })),
      "No verified account",
    );
  });

  it("rejects revoked tokens", async () => {
    const entry = await entryFor("propose_recovery", args(0));
    await rejects(
      attest(
        entry,
        latestLedger + 60,
        context({
          claims: [recovered(discord), recovered(github)],
          member: async () => ({ ...onChain, status: 1 }),
        }),
      ),
      "Not an active member",
    );
  });
});
