import { Contract, TransactionBuilder, Account, nativeToScVal, scValToNative, xdr, Keypair } from "@stellar/stellar-sdk";
import { Server, Api } from "@stellar/stellar-sdk/rpc";
import { CONTRACT_ADDRESS, RPC_URL, NETWORK_PASSPHRASE } from "@/config/networks";
import { getCached, setCache } from "./cache";
import { ipfsToHttp } from "./ipfs";

const server = new Server(RPC_URL);
const contract = new Contract(CONTRACT_ADDRESS);

function deepConvertMaps(value: unknown): unknown {
  if (value instanceof Map) {
    return Object.fromEntries(
      Array.from(value.entries()).map(([key, nestedValue]) => [String(key), deepConvertMaps(nestedValue)])
    );
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepConvertMaps(item));
  }

  return value;
}

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
  role?: string | number | bigint;
  nqg_score?: unknown;
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

    const data = deepConvertMaps(raw);
    if (!data || typeof data !== "object") return null;

    const normalized = data as Record<string, unknown>;

    return {
      ...normalized,
      role: normalized.role ?? normalized.scf_role,
      nqg_score: normalized.nqg_score ?? normalized.nqg ?? normalized.nqgScore,
    } as GovernanceData;
  } catch {
    return null;
  }
}

export interface TraitMetadata {
  displayName?: string;
  decimals?: number;
  mapping?: Record<string, string>;
  valueMappings?: Record<string, string>;
  dataType?: {
    type?: string;
    decimals?: number;
    signed?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function normalizeTraitMetadata(value: unknown): TraitMetadata {
  const normalized = deepConvertMaps(value);
  if (!normalized || typeof normalized !== "object") return {};

  const record = normalized as Record<string, unknown>;
  const dataType =
    record.dataType && typeof record.dataType === "object"
      ? (record.dataType as Record<string, unknown>)
      : undefined;

  const rawDecimals = dataType?.decimals ?? record.decimals;
  const decimals =
    typeof rawDecimals === "number"
      ? rawDecimals
      : typeof rawDecimals === "bigint"
        ? Number(rawDecimals)
        : typeof rawDecimals === "string" && rawDecimals.length > 0
          ? Number(rawDecimals)
          : undefined;

  const mappingSource =
    record.valueMappings && typeof record.valueMappings === "object"
      ? (record.valueMappings as Record<string, unknown>)
      : record.mapping && typeof record.mapping === "object"
        ? (record.mapping as Record<string, unknown>)
        : undefined;

  const mapping = mappingSource
    ? Object.fromEntries(
        Object.entries(mappingSource).map(([key, mappedValue]) => [key, String(mappedValue)])
      )
    : undefined;

  return {
    ...record,
    dataType: dataType as TraitMetadata["dataType"],
    decimals: Number.isFinite(decimals) ? decimals : undefined,
    mapping,
    valueMappings: mapping,
  };
}

export async function getTraitMetadataUri(): Promise<Record<string, TraitMetadata> | null> {
  const cacheKey = "trait_metadata_uri";
  const cached = getCached<Record<string, TraitMetadata>>(cacheKey);
  if (cached) return cached;

  try {
    const result = await simulateCall("trait_metadata_uri");
    const raw = scValToNative(result);
    console.log("trait_metadata_uri raw:", raw);

    const uri =
      typeof raw === "string"
        ? raw
        : raw instanceof Map
          ? String(raw.get("uri") ?? raw.get("url") ?? "")
          : raw && typeof raw === "object"
            ? String((raw as Record<string, unknown>).uri ?? (raw as Record<string, unknown>).url ?? "")
            : "";

    if (!uri) return null;

    const response = await fetch(ipfsToHttp(uri));
    if (!response.ok) {
      throw new Error(`Failed to fetch trait metadata: ${response.status}`);
    }

    const metadataRaw = await response.json();
    const metadata = deepConvertMaps(metadataRaw) as Record<string, unknown>;
    console.log("trait_metadata_uri resolved:", metadata);

    const traits =
      metadata.traits && typeof metadata.traits === "object"
        ? (metadata.traits as Record<string, unknown>)
        : metadata;

    const normalized = Object.fromEntries(
      Object.entries(traits).map(([key, value]) => [key, normalizeTraitMetadata(value)])
    ) as Record<string, TraitMetadata>;

    console.log("trait_metadata_uri normalized:", normalized);
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
