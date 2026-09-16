import { rpc } from "@stellar/stellar-sdk";
import { Client } from "stellar-membership";

import type { MemberValue } from "./attest";
import type { Env } from "./env";

function client(env: Env): Client {
  return new Client({
    contractId: env.CONTRACT_ID,
    networkPassphrase: env.NETWORK_PASSPHRASE,
    rpcUrl: env.RPC_URL,
  });
}

export async function latestLedger(env: Env): Promise<number> {
  return (await new rpc.Server(env.RPC_URL).getLatestLedger()).sequence;
}

/** Current address of an active token, null otherwise. */
export async function readOwner(
  env: Env,
  tokenId: number,
): Promise<string | null> {
  try {
    return (await client(env).owner_of({ token_id: tokenId })).result;
  } catch {
    return null;
  }
}

export async function readMember(
  env: Env,
  tokenId: number,
): Promise<MemberValue | null> {
  try {
    return (await client(env).member({ token_id: tokenId }))
      .result as MemberValue;
  } catch {
    return null;
  }
}
