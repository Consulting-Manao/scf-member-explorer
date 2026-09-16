/** Projects from PG Atlas, identified by DAOIP-5 ids. */

import type { Project } from "@shared/membership";

import type { Env } from "./env";

interface PgAtlasProject {
  canonical_id: string;
  display_name: string;
  category: string | null;
  activity_status: string | null;
  git_owner_url: string | null;
}

export const CACHE_SECONDS = 3600;

function toProject(project: PgAtlasProject): Project {
  return {
    id: project.canonical_id,
    name: project.display_name,
    category: project.category,
    status: project.activity_status,
    gitOwnerUrl: project.git_owner_url,
  };
}

async function cachedJson<T>(url: string): Promise<T | null> {
  const cache = typeof caches !== "undefined" ? caches.default : undefined;
  const request = new Request(url);
  const hit = await cache?.match(request);
  const res = hit ?? (await fetch(request));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`PG Atlas HTTP ${res.status}`);
  if (!hit && cache) {
    const copy = new Response(res.clone().body, res);
    copy.headers.set("Cache-Control", `public, max-age=${CACHE_SECONDS}`);
    await cache.put(request, copy);
  }
  return (await res.json()) as T;
}

export async function searchProjects(
  env: Env,
  search: string,
): Promise<Project[]> {
  const params = new URLSearchParams({ limit: "20" });
  if (search.trim()) params.set("search", search.trim().slice(0, 128));
  const data = await cachedJson<{ items: PgAtlasProject[] }>(
    `${env.PGATLAS_URL}/projects?${params}`,
  );
  return (data?.items ?? []).map(toProject);
}

export async function getProject(
  env: Env,
  id: string,
): Promise<Project | null> {
  const data = await cachedJson<PgAtlasProject>(
    `${env.PGATLAS_URL}/projects/${encodeURIComponent(id)}`,
  );
  return data ? toProject(data) : null;
}
