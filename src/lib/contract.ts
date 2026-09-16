/**
 * Contract access. Writes go through the generated client, member state is
 * read in batches straight from the ledger.
 */

import {
  Address,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { Client } from "stellar-membership";

import {
  toHex,
  type MemberRecord,
  type SocialAccount,
} from "@shared/membership";

import { config } from "./config";

export interface MemberView {
  tokenId: number;
  /** Current address, null when revoked. */
  owner: string | null;
  revoked: boolean;
  role: number;
  accounts: SocialAccount[];
  emailHash: string | null;
  bio: string;
  projects: string[];
}

export interface Recovery {
  newAddress: string;
  executableAt: Date;
}

export function membershipClient(publicKey?: string): Client {
  const { contractId, networkPassphrase, rpcUrl } = config();
  return new Client({ contractId, networkPassphrase, rpcUrl, publicKey });
}

function server(): rpc.Server {
  return new rpc.Server(config().rpcUrl);
}

/** `MemberKey::<variant>(...fields)`: a vector of the variant symbol and fields. */
export function memberKeyScVal(variant: string, ...fields: xdr.ScVal[]) {
  return xdr.ScVal.scvVec([
    nativeToScVal(variant, { type: "symbol" }),
    ...fields,
  ]);
}

/** Persistent storage key of the contract. */
function memberKey(variant: string, ...fields: xdr.ScVal[]): xdr.LedgerKey {
  return xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: new Address(config().contractId).toScAddress(),
      key: memberKeyScVal(variant, ...fields),
      durability: xdr.ContractDataDurability.persistent,
    }),
  );
}

export const u32 = (value: number) => nativeToScVal(value, { type: "u32" });

/** Read ledger entries, `undefined` for missing ones, in the keys order. */
async function readEntries(keys: xdr.LedgerKey[]): Promise<unknown[]> {
  const values = new Map<string, unknown>();
  // RPC accepts at most 200 keys per request
  for (let i = 0; i < keys.length; i += 200) {
    const { entries } = await server().getLedgerEntries(
      ...keys.slice(i, i + 200),
    );
    for (const entry of entries) {
      if (entry.val.type !== "contractData") continue;
      values.set(
        entry.key.toXdr("base64"),
        scValToNative(entry.val.contractData.val),
      );
    }
  }
  return keys.map((key) => values.get(key.toXdr("base64")));
}

export async function getMembers(
  tokenIds: number[],
): Promise<(MemberView | null)[]> {
  const keys = tokenIds.flatMap((id) => [
    memberKey("Member", u32(id)),
    memberKey("Owner", u32(id)),
  ]);
  const values = await readEntries(keys);
  return tokenIds.map((tokenId, i) => {
    const member = values[2 * i] as MemberRecord | undefined;
    if (!member) return null;
    return {
      tokenId,
      owner: (values[2 * i + 1] as string | undefined) ?? null,
      revoked: member.status === 1,
      role: member.role,
      accounts: member.external_accounts.accounts,
      emailHash: member.external_accounts.email_hash
        ? toHex(member.external_accounts.email_hash)
        : null,
      bio: member.bio,
      projects: member.projects,
    };
  });
}

export async function getMember(tokenId: number): Promise<MemberView | null> {
  const [member] = await getMembers([tokenId]);
  return member ?? null;
}

export async function getTokenOf(address: string): Promise<number | null> {
  const [tokenId] = await readEntries([
    memberKey("TokenOf", nativeToScVal(address, { type: "address" })),
  ]);
  return (tokenId as number | undefined) ?? null;
}

export async function getTokenByAccount(
  provider: number,
  id: string,
): Promise<number | null> {
  const [tokenId] = await readEntries([
    memberKey("Account", u32(provider), nativeToScVal(id, { type: "string" })),
  ]);
  return (tokenId as number | undefined) ?? null;
}

export async function getRecoveries(
  tokenIds: number[],
): Promise<(Recovery | null)[]> {
  const values = await readEntries(
    tokenIds.map((id) => memberKey("Recovery", u32(id))),
  );
  return values.map((value) => {
    const request = value as
      { new_address: string; executable_at: bigint } | undefined;
    return request
      ? {
          newAddress: request.new_address,
          executableAt: new Date(Number(request.executable_at) * 1000),
        }
      : null;
  });
}

export interface Instance {
  nextTokenId: number;
  admin: string;
  attester: string;
}

/** Key of the contract instance, whose storage holds the `DataKey` values. */
function instanceKey(): xdr.LedgerKey {
  return xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: new Address(config().contractId).toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent,
    }),
  );
}

/** Next token id, admin and attester in one ledger read. */
export async function getInstance(): Promise<Instance> {
  const { entries } = await server().getLedgerEntries(instanceKey());
  const entry = entries[0];
  if (!entry || entry.val.type !== "contractData") {
    throw new Error("Contract instance not found");
  }
  const value = entry.val.contractData.val;
  if (value.type !== "scvContractInstance") {
    throw new Error("Unexpected contract instance");
  }
  const values = new Map<string, unknown>();
  for (const item of value.instance.storage ?? []) {
    const key = scValToNative(item.key) as unknown;
    // unit variants of `DataKey` are one-symbol vectors
    if (Array.isArray(key) && key.length === 1) {
      values.set(String(key[0]), scValToNative(item.val));
    }
  }
  const nextTokenId = values.get("NextTokenId");
  const admin = values.get("Admin");
  const attester = values.get("Attester");
  if (
    typeof nextTokenId !== "number" ||
    typeof admin !== "string" ||
    typeof attester !== "string"
  ) {
    throw new Error("Unexpected contract instance");
  }
  return { nextTokenId, admin, attester };
}

export async function getNqg(tokenId: number): Promise<number | null> {
  try {
    const { result } = await membershipClient().governance({
      token_id: tokenId,
    });
    return Number(result.nqg) / 1e6;
  } catch {
    return null;
  }
}
