import { Contract, TransactionBuilder, Account, nativeToScVal, scValToNative, xdr, Keypair } from "@stellar/stellar-sdk";
import { Server, Api } from "@stellar/stellar-sdk/rpc";
import { CONTRACT_ADDRESS, RPC_URL, NETWORK_PASSPHRASE } from "@/config/networks";
import { getCached, setCache } from "./cache";

const server = new Server(RPC_URL);
const contract = new Contract(CONTRACT_ADDRESS);

async function simulateCall(method: string, ...args: xdr.ScVal[]): Promise<xdr.ScVal> {
  const keypair = Keypair.random();
  const account = new Account(keypair.publicKey(), "0");

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
  if (name) setCache(cacheKey, name);
  return name;
}

export async function getCollectionSymbol(): Promise<string> {
  const cacheKey = "collection_symbol";
  const cached = getCached<string>(cacheKey);
  if (cached) return cached;

  const result = await simulateCall("symbol");
  const symbol = scValToNative(result) as string;
  if (symbol) setCache(cacheKey, symbol);
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
  if (uri) setCache(cacheKey, uri);
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
    const raw = scValToNative(result);
    console.log("governance raw:", raw);

    // scValToNative may return a Map for Soroban maps
    const data = raw instanceof Map ? Object.fromEntries(raw) : raw;

    return {
      role: data.role ?? data.scf_role,
      nqg_score: data.nqg_score ?? data.nqg ?? data.nqgScore,
      ...data,
    } as GovernanceData;
  } catch {
    return null;
  }
}

export interface TraitMetadata {
  decimals?: number;
  [key: string]: unknown;
}

export async function getTraitMetadataUri(): Promise<Record<string, TraitMetadata> | null> {
  const cacheKey = "trait_metadata_uri";
  const cached = getCached<Record<string, TraitMetadata>>(cacheKey);
  if (cached) return cached;

  try {
    const result = await simulateCall("trait_metadata_uri");
    const raw = scValToNative(result);
    console.log("trait_metadata_uri raw:", raw);

    const data = raw instanceof Map ? Object.fromEntries(raw) : raw;
    // Recursively convert nested Maps
    const normalized: Record<string, TraitMetadata> = {};
    for (const [key, val] of Object.entries(data)) {
      normalized[key] = val instanceof Map ? Object.fromEntries(val) : val as TraitMetadata;
    }

    if (Object.keys(normalized).length > 0) setCache(cacheKey, normalized);
    return normalized;
  } catch {
    return null;
  }
}

export async function getNextTokenId(): Promise<number> {
  const cacheKey = "next_token_id";
  const cached = getCached<number>(cacheKey);
  if (cached) return cached;

  const result = await simulateCall("next_token_id");
  const total = Number(scValToNative(result));
  if (total > 0) setCache(cacheKey, total);
  return total;
}
