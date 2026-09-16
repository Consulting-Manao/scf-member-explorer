import type { Claim, ProviderName } from "@shared/membership";

export interface Project {
  id: string;
  name: string;
  category: string | null;
  status: string | null;
  gitOwnerUrl: string | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) });
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
