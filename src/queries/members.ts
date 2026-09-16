import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";

import { api } from "@/lib/api";
import {
  getInstance,
  getMember,
  getMembers,
  getNqg,
  getRecoveries,
  getTokenOf,
  type MemberView,
} from "@/lib/contract";
import { fetchProfile } from "@/lib/ipfs";
import { claimsFor } from "@/lib/oauth";
import { useWallet } from "@/lib/wallet";

/** Members per RPC call: two ledger keys each, 200 keys per request. */
export const PAGE_SIZE = 100;
const MINUTE = 60_000;

export const queryKeys = {
  instance: ["instance"] as const,
  members: ["members", "list"] as const,
  member: (tokenId: number) => ["members", "detail", tokenId] as const,
  recovery: (tokenId: number) => ["members", "recovery", tokenId] as const,
  tokenOf: (address: string | null) => ["members", "tokenOf", address] as const,
  nqg: (tokenId: number) => ["members", "nqg", tokenId] as const,
  profile: (cid: string) => ["profile", cid] as const,
  projects: (search: string) => ["projects", search] as const,
  project: (id: string) => ["project", id] as const,
};

type Pages = InfiniteData<(MemberView | null)[], number>;

/** Page `n` holds the token ids `[n * PAGE_SIZE, (n + 1) * PAGE_SIZE)`. */
const pageOf = (tokenId: number) => Math.floor(tokenId / PAGE_SIZE);

function pageIds(page: number, count: number): number[] {
  const top = Math.min(count, (page + 1) * PAGE_SIZE) - 1;
  return Array.from({ length: top - page * PAGE_SIZE + 1 }, (_, i) => top - i);
}

/** Next token id, admin and attester. */
export function useInstance() {
  return useQuery({
    queryKey: queryKeys.instance,
    queryFn: getInstance,
    staleTime: 2 * MINUTE,
  });
}

export function useMemberCount() {
  const instance = useInstance();
  return { ...instance, data: instance.data?.nextTokenId };
}

export function useAdmin() {
  const instance = useInstance();
  return { ...instance, data: instance.data?.admin };
}

/** Newest members first, one RPC call per page. */
export function useMembers(count: number | undefined) {
  return useInfiniteQuery({
    queryKey: queryKeys.members,
    enabled: count !== undefined && count > 0,
    initialPageParam: pageOf(Math.max((count ?? 1) - 1, 0)),
    queryFn: ({ pageParam }) => getMembers(pageIds(pageParam, count ?? 0)),
    getNextPageParam: (_last, _pages, lastParam) =>
      lastParam > 0 ? lastParam - 1 : undefined,
    staleTime: 10 * MINUTE,
  });
}

function findInPages(pages: Pages | undefined, tokenId: number) {
  for (const page of pages?.pages ?? []) {
    const member = page.find((m) => m?.tokenId === tokenId);
    if (member) return member;
  }
  return undefined;
}

export function useMember(tokenId: number | null | undefined) {
  const client = useQueryClient();
  const enabled = tokenId !== null && tokenId !== undefined && tokenId >= 0;
  return useQuery({
    queryKey: queryKeys.member(tokenId ?? -1),
    enabled,
    queryFn: () => getMember(tokenId!),
    staleTime: 10 * MINUTE,
    // already read as part of a page
    initialData: () =>
      enabled
        ? findInPages(client.getQueryData<Pages>(queryKeys.members), tokenId)
        : undefined,
    initialDataUpdatedAt: () =>
      client.getQueryState(queryKeys.members)?.dataUpdatedAt,
  });
}

export function useRecovery(tokenId: number | null | undefined) {
  return useQuery({
    queryKey: queryKeys.recovery(tokenId ?? -1),
    enabled: tokenId !== null && tokenId !== undefined,
    queryFn: async () => (await getRecoveries([tokenId!]))[0] ?? null,
  });
}

/** NQG score through the contract, one simulation per member. */
export function useNqg(tokenId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.nqg(tokenId ?? -1),
    enabled: enabled && tokenId !== null && tokenId !== undefined,
    queryFn: () => getNqg(tokenId!),
    staleTime: 60 * MINUTE,
  });
}

export function useProfile(cid: string | undefined) {
  return useQuery({
    queryKey: queryKeys.profile(cid ?? ""),
    enabled: Boolean(cid),
    queryFn: () => fetchProfile(cid!),
    // content addressed, and cached by the service worker
    staleTime: Infinity,
    retry: 1,
  });
}

/** The token held by the connected wallet. */
export function useMyMembership() {
  const { address } = useWallet();
  const tokenOf = useQuery({
    queryKey: queryKeys.tokenOf(address),
    enabled: Boolean(address),
    queryFn: () => getTokenOf(address!),
    staleTime: 10 * MINUTE,
  });
  const member = useMember(tokenOf.data);
  return {
    address,
    tokenId: tokenOf.data ?? null,
    member: member.data ?? null,
    isLoading: tokenOf.isLoading || member.isLoading,
  };
}

export function useProjects(search: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.projects(search),
    enabled,
    queryFn: () => api.projects(search),
    placeholderData: keepPreviousData,
    staleTime: 60 * MINUTE,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: queryKeys.project(id),
    queryFn: () => api.project(id),
    staleTime: 60 * MINUTE,
    retry: false,
  });
}

function subscribeClaims(callback: () => void) {
  window.addEventListener("claims", callback);
  return () => window.removeEventListener("claims", callback);
}

/** Verified accounts of an address in this browser session. */
export function useClaims(address: string | null) {
  const snapshot = useSyncExternalStore(subscribeClaims, () =>
    JSON.stringify(claimsFor(address)),
  );
  return JSON.parse(snapshot) as ReturnType<typeof claimsFor>;
}

/** Insert or replace members in the loaded pages, newest first. */
function mergeIntoPages(pages: Pages, members: MemberView[]): Pages {
  let next = pages;
  for (const member of members) {
    const page = pageOf(member.tokenId);
    const index = next.pageParams.indexOf(page);
    if (index === -1) {
      if (page > (next.pageParams[0] ?? -1)) {
        next = {
          pages: [[member], ...next.pages],
          pageParams: [page, ...next.pageParams],
        };
      }
      continue;
    }
    const current = next.pages[index]!;
    const at = current.findIndex((m) => m?.tokenId === member.tokenId);
    const updated =
      at === -1
        ? [member, ...current].sort((a, b) => b!.tokenId - a!.tokenId)
        : current.map((m, i) => (i === at ? member : m));
    next = {
      ...next,
      pages: next.pages.map((p, i) => (i === index ? updated : p)),
    };
  }
  return next;
}

/**
 * Refresh the members touched by a transaction: their records are read
 * again and patched in place, nothing else is refetched.
 */
export function useInvalidateMembers() {
  const client = useQueryClient();
  return useCallback(
    async (tokenIds: number[]) => {
      const members = (await getMembers(tokenIds)).filter(
        (m): m is MemberView => m !== null,
      );
      for (const member of members) {
        client.setQueryData(queryKeys.member(member.tokenId), member);
      }
      client.setQueryData<Pages>(queryKeys.members, (pages) =>
        pages ? mergeIntoPages(pages, members) : pages,
      );
      const count = client.getQueryData<
        Awaited<ReturnType<typeof getInstance>>
      >(queryKeys.instance);
      const top = Math.max(...tokenIds) + 1;
      if (count && top > count.nextTokenId) {
        client.setQueryData(queryKeys.instance, {
          ...count,
          nextTokenId: top,
        });
      }
      await Promise.all([
        ...tokenIds.map((id) =>
          client.invalidateQueries({ queryKey: queryKeys.recovery(id) }),
        ),
        client.invalidateQueries({ queryKey: ["members", "tokenOf"] }),
      ]);
    },
    [client],
  );
}

/** Refresh the instance after an admin change (attester, count). */
export function useInvalidateInstance() {
  const client = useQueryClient();
  return useCallback(
    () => client.invalidateQueries({ queryKey: queryKeys.instance }),
    [client],
  );
}
