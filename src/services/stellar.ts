import { Contract, TransactionBuilder, Account, nativeToScVal, scValToNative, xdr } from "@stellar/stellar-sdk";
import { Server, Api } from "@stellar/stellar-sdk/rpc";
import { CONTRACT_ADDRESS, RPC_URL, NETWORK_PASSPHRASE } from "@/config/networks";
import { getCached, setCache } from "./cache";

const server = new Server(RPC_URL);
const contract = new Contract(CONTRACT_ADDRESS);

async function simulateCall(method: string, ...args: xdr.ScVal[]): Promise<xdr.ScVal> {
  const account = new Account(
    "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF6",
    "0"
  );

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const response = await server.simulateTransaction(tx);

  if (Api.isSimulationError(response)) {
    throw new Error(`Simulation error: ${response.error}`);
  }

  if (!Api.isSimulationSuccess(response)) {
    throw new Error("Simulation failed");
  }

  return response.result!.retval;
}

export async function getCollectionName(): Promise<string> {
  const cacheKey = "collection_name";
  const cached = getCached<string>(cacheKey);
  if (cached) return cached;

  const result = await simulateCall("name");
  const name = scValToNative(result) as string;
  setCache(cacheKey, name);
  return name;
}

export async function getCollectionSymbol(): Promise<string> {
  const cacheKey = "collection_symbol";
  const cached = getCached<string>(cacheKey);
  if (cached) return cached;

  const result = await simulateCall("symbol");
  const symbol = scValToNative(result) as string;
  setCache(cacheKey, symbol);
  return symbol;
}

export async function getTokenUri(tokenId: number): Promise<string> {
  const cacheKey = `token_uri_${tokenId}`;
  const cached = getCached<string>(cacheKey);
  if (cached) return cached;

  const result = await simulateCall(
    "token_uri",
    nativeToScVal(tokenId, { type: "u32" })
  );
  const uri = scValToNative(result) as string;
  setCache(cacheKey, uri);
  return uri;
}

export async function getOwnerOf(tokenId: number): Promise<string | null> {
  try {
    const result = await simulateCall(
      "owner_of",
      nativeToScVal(tokenId, { type: "u32" })
    );
    return scValToNative(result) as string;
  } catch {
    return null;
  }
}

export interface GovernanceData {
  role?: string;
  nqg_score?: number;
  [key: string]: unknown;
}

export async function getGovernance(tokenId: number): Promise<GovernanceData | null> {
  try {
    const result = await simulateCall(
      "governance",
      nativeToScVal(tokenId, { type: "u32" })
    );
    return scValToNative(result) as GovernanceData;
  } catch {
    return null;
  }
}

export async function getTraitMetadataUri(): Promise<Record<string, unknown> | null> {
  const cacheKey = "trait_metadata_uri";
  const cached = getCached<Record<string, unknown>>(cacheKey);
  if (cached) return cached;

  try {
    const result = await simulateCall("trait_metadata_uri");
    const data = scValToNative(result) as Record<string, unknown>;
    setCache(cacheKey, data);
    return data;
  } catch {
    return null;
  }
}

export async function getTotalTokens(): Promise<number> {
  const cacheKey = "total_tokens";
  const cached = getCached<number>(cacheKey);
  if (cached) return cached;

  try {
    const result = await simulateCall("total_supply");
    const total = Number(scValToNative(result));
    setCache(cacheKey, total);
    return total;
  } catch {
    // fallback: binary search
  }

  let low = 0;
  let high = 10000;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    try {
      await getTokenUri(mid);
      low = mid + 1;
    } catch {
      high = mid;
    }
  }

  const total = low;
  if (total > 0) setCache(cacheKey, total);
  return total;
}
