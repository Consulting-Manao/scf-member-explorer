import * as StellarSdk from "@stellar/stellar-sdk";
import { CONTRACT_ADDRESS, RPC_URL, NETWORK_PASSPHRASE } from "@/config/networks";
import { getCached, setCache } from "./cache";

const server = new StellarSdk.SorobanRpc.Server(RPC_URL);
const contract = new StellarSdk.Contract(CONTRACT_ADDRESS);

async function simulateCall(method: string, ...args: StellarSdk.xdr.ScVal[]): Promise<StellarSdk.xdr.ScVal> {
  const account = new StellarSdk.Account(
    "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF6",
    "0"
  );

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const response = await server.simulateTransaction(tx);

  if (StellarSdk.SorobanRpc.Api.isSimulationError(response)) {
    throw new Error(`Simulation error: ${response.error}`);
  }

  if (!StellarSdk.SorobanRpc.Api.isSimulationSuccess(response)) {
    throw new Error("Simulation failed");
  }

  return response.result!.retval;
}

function scValToString(val: StellarSdk.xdr.ScVal): string {
  return StellarSdk.scValToNative(val) as string;
}

export async function getCollectionName(): Promise<string> {
  const cacheKey = "collection_name";
  const cached = getCached<string>(cacheKey);
  if (cached) return cached;

  const result = await simulateCall("name");
  const name = scValToString(result);
  setCache(cacheKey, name);
  return name;
}

export async function getCollectionSymbol(): Promise<string> {
  const cacheKey = "collection_symbol";
  const cached = getCached<string>(cacheKey);
  if (cached) return cached;

  const result = await simulateCall("symbol");
  const symbol = scValToString(result);
  setCache(cacheKey, symbol);
  return symbol;
}

export async function getTokenUri(tokenId: number): Promise<string> {
  const cacheKey = `token_uri_${tokenId}`;
  const cached = getCached<string>(cacheKey);
  if (cached) return cached;

  const result = await simulateCall(
    "token_uri",
    StellarSdk.nativeToScVal(tokenId, { type: "u32" })
  );
  const uri = scValToString(result);
  setCache(cacheKey, uri);
  return uri;
}

export async function getOwnerOf(tokenId: number): Promise<string | null> {
  try {
    const result = await simulateCall(
      "owner_of",
      StellarSdk.nativeToScVal(tokenId, { type: "u32" })
    );
    return StellarSdk.scValToNative(result) as string;
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
      StellarSdk.nativeToScVal(tokenId, { type: "u32" })
    );
    return StellarSdk.scValToNative(result) as GovernanceData;
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
    const data = StellarSdk.scValToNative(result) as Record<string, unknown>;
    setCache(cacheKey, data);
    return data;
  } catch {
    return null;
  }
}

// Try to discover total supply or iterate until we get errors
export async function getTotalTokens(): Promise<number> {
  const cacheKey = "total_tokens";
  const cached = getCached<number>(cacheKey);
  if (cached) return cached;

  // Try common methods for total supply
  try {
    const result = await simulateCall("total_supply");
    const total = Number(StellarSdk.scValToNative(result));
    setCache(cacheKey, total);
    return total;
  } catch {
    // fallback: binary search for max token ID
  }

  // Binary search approach
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
