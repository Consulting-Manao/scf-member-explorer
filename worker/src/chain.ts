import { rpc } from "@stellar/stellar-sdk";
import { Client } from "./bindings";

import type { MemberRecord } from "@shared/membership";
import type { NetworkConfig } from "./env";

/** One client per contract and endpoint: they hold no state beyond those. */
const clients = new Map<string, Client>();

function client(net: NetworkConfig): Client {
  const key = `${net.contractId}@${net.rpcUrl}`;
  let existing = clients.get(key);
  if (!existing) {
    existing = new Client({
      contractId: net.contractId,
      networkPassphrase: net.networkPassphrase,
      rpcUrl: net.rpcUrl,
    });
    clients.set(key, existing);
  }
  return existing;
}

export async function latestLedger(net: NetworkConfig): Promise<number> {
  return (await new rpc.Server(net.rpcUrl).getLatestLedger()).sequence;
}

/** Address of an active token; null when absent, revoked or unreachable. */
export async function readOwner(
  net: NetworkConfig,
  tokenId: number,
): Promise<string | null> {
  try {
    return (await client(net).owner_of({ token_id: tokenId })).result;
  } catch {
    return null;
  }
}

/** Record of a token; null when absent or unreachable. */
export async function readMember(
  net: NetworkConfig,
  tokenId: number,
): Promise<MemberRecord | null> {
  try {
    return (await client(net).member({ token_id: tokenId }))
      .result as MemberRecord;
  } catch {
    return null;
  }
}
