import type { Claim, Project, ProviderName } from "@shared/membership";

/** The worker's origin; empty when served from the same one (dev proxy). */
const API_URL: string = import.meta.env.VITE_API_URL ?? "";

/**
 * The network this build is for. One worker serves several, so every call
 * names the one it wants; the worker answers with that network's contract,
 * RPC and attester, or refuses when it does not serve it.
 */
const NETWORK: string = import.meta.env.VITE_NETWORK ?? "testnet";

export const apiUrl = (path: string) =>
  `${API_URL}/api${path}${path.includes("?") ? "&" : "?"}network=${NETWORK}`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), init);
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const api = {
  exchange: (
    provider: ProviderName,
    body: {
      code: string;
      codeVerifier: string;
      redirectUri: string;
      address: string;
    },
  ) =>
    post<{ claim: Claim; token: string }>(`/oauth/${provider}/exchange`, body),

  attest: (body: {
    entry: string;
    validUntilLedger: number;
    claims: string[];
  }) => post<{ entry: string }>("/attest", body),

  upload: (body: { cid: string; signedTxXdr: string; car: string }) =>
    post<{ cid: string }>("/ipfs", body),

  projects: (search: string) =>
    request<Project[]>(`/projects?search=${encodeURIComponent(search)}`),

  project: (id: string) =>
    request<Project>(`/projects/${encodeURIComponent(id)}`),
};
