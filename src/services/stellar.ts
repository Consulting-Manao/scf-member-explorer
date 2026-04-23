import { Address, nativeToScVal, scValToNative, xdr } from "@stellar/stellar-sdk";
import { CONTRACT_ADDRESS } from "@/config/networks";
import { fetchJson } from "./ipfs";
import { simulate } from "./soroban";

function call(method: string, ...args: xdr.ScVal[]): Promise<xdr.ScVal> {
  return simulate(CONTRACT_ADDRESS, method, ...args);
}

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

export async function getTokenUri(tokenId: number): Promise<string> {
  const result = await call("token_uri", nativeToScVal(tokenId, { type: "u32" }));
  return scValToNative(result) as string;
}

export async function getOwnerOf(tokenId: number): Promise<string | null> {
  try {
    const result = await call("owner_of", nativeToScVal(tokenId, { type: "u32" }));
    const native = scValToNative(result);
    if (typeof native === "string") return native;
    // owner_of may return an Address-typed ScVal
    try {
      return Address.fromScVal(result).toString();
    } catch {
      return null;
    }
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
    const result = await call("governance", nativeToScVal(tokenId, { type: "u32" }));
    const raw = scValToNative(result);
    const data = deepConvertMaps(raw);
    if (!data || typeof data !== "object") return null;

    const normalized = data as Record<string, unknown>;

    return {
      role: normalized.role as GovernanceData["role"] ?? normalized.scf_role as GovernanceData["role"],
      nqg_score: normalized.nqg_score ?? normalized.nqg ?? normalized.nqgScore,
    };
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
    const result = await call("trait_metadata_uri");
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

    const metadataRaw = await fetchJson<unknown>(uri);
    if (!metadataRaw || typeof metadataRaw !== "object") return null;

    const metadata = deepConvertMaps(metadataRaw) as Record<string, unknown>;

    const traits =
      metadata.traits && typeof metadata.traits === "object"
        ? (metadata.traits as Record<string, unknown>)
        : metadata;

    if (typeof traits !== "object" || Array.isArray(traits)) return null;

    return Object.fromEntries(
      Object.entries(traits).map(([key, value]) => [key, normalizeTraitMetadata(value)])
    ) as Record<string, TraitMetadata>;
  } catch {
    return null;
  }
}

export async function getNextTokenId(): Promise<number> {
  const result = await call("next_token_id");
  return Number(scValToNative(result));
}
