import { Contract, TransactionBuilder, Account, nativeToScVal, scValToNative, xdr, Keypair } from "@stellar/stellar-sdk";
import { Server, Api } from "@stellar/stellar-sdk/rpc";
import { CONTRACT_ADDRESS, RPC_URL, NETWORK_PASSPHRASE } from "@/config/networks";
import { getCached, setCache } from "./cache";
import { fetchJson } from "./ipfs";

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
  const result = await simulateCall("name");
  return scValToNative(result) as string;
}

export async function getCollectionSymbol(): Promise<string> {
  const result = await simulateCall("symbol");
  return scValToNative(result) as string;
}

export async function getTokenUri(tokenId: number): Promise<string> {
  const result = await simulateCall(
    "token_uri",
    nativeToScVal(tokenId, { type: "u32" })
  );
  return scValToNative(result) as string;
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
}

export async function getGovernance(tokenId: number): Promise<GovernanceData | null> {
  try {
    const result = await simulateCall(
      "governance",
      nativeToScVal(tokenId, { type: "u32" })
    );
    const raw = scValToNative(result);
    const data = deepConvertMaps(raw);
    if (!data || typeof data !== "object") return null;

    const normalized = data as Record<string, unknown>;

    return {
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
  try {
    const result = await simulateCall("trait_metadata_uri");
    const raw = scValToNative(result);

    let uri = "";
    if (typeof raw === "string") {
      uri = raw;
    } else if (raw instanceof Map) {
      uri = String(raw.get("uri") ?? raw.get("url") ?? "");
    } else if (raw && typeof raw === "object") {
      uri = String((raw as Record<string, unknown>).uri ?? (raw as Record<string, unknown>).url ?? "");
    }

    if (!uri) return null;

    // Cache by IPFS URI — immutable content
    const cached = getCached<Record<string, TraitMetadata>>(uri);
    if (cached && typeof cached === "object" && !Array.isArray(cached)) {
      const keys = Object.keys(cached);
      if (keys.length > 0 && keys[0] !== "0") return cached;
    }

    const metadataRaw = await fetchJson<unknown>(uri);
    if (!metadataRaw || typeof metadataRaw !== "object") return null;

    const metadata = deepConvertMaps(metadataRaw) as Record<string, unknown>;

    const traits =
      metadata.traits && typeof metadata.traits === "object"
        ? (metadata.traits as Record<string, unknown>)
        : metadata;

    if (typeof traits !== "object" || Array.isArray(traits)) return null;

    const normalized = Object.fromEntries(
      Object.entries(traits).map(([key, value]) => [key, normalizeTraitMetadata(value)])
    ) as Record<string, TraitMetadata>;

    if (Object.keys(normalized).length > 0) setCache(uri, normalized);
    return normalized;
  } catch (err) {
    console.error("trait_metadata_uri error:", err);
    return null;
  }
}

export async function getNextTokenId(): Promise<number> {
  const result = await simulateCall("next_token_id");
  return Number(scValToNative(result));
}
