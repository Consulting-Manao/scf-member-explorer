import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";

import { api } from "@/lib/api";
import {
  getAdmin,
  getMember,
  getMembers,
  getNextTokenId,
  getNqg,
  getRecoveries,
  getTokenOf,
} from "@/lib/contract";
import { fetchProfile } from "@/lib/ipfs";
import { claimsFor } from "@/lib/oauth";
import { useWallet } from "@/lib/wallet";

export const PAGE_SIZE = 24;

export const queryKeys = {
  count: ["members", "count"] as const,
  members: ["members", "list"] as const,
  member: (tokenId: number) => ["members", "detail", tokenId] as const,
  recovery: (tokenId: number) => ["members", "recovery", tokenId] as const,
  tokenOf: (address: string | null) => ["members", "tokenOf", address] as const,
  nqg: (tokenId: number) => ["members", "nqg", tokenId] as const,
  profile: (cid: string) => ["profile", cid] as const,
  admin: ["admin"] as const,
  projects: (search: string) => ["projects", search] as const,
  project: (id: string) => ["project", id] as const,
};

export function useMemberCount() {
  return useQuery({ queryKey: queryKeys.count, queryFn: getNextTokenId });
}

/** Newest members first, in pages. */
export function useMembers(count: number | undefined) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.members, count],
    enabled: count !== undefined,
    initialPageParam: (count ?? 0) - 1,
    queryFn: async ({ pageParam }) => {
      const ids = Array.from(
        { length: Math.min(PAGE_SIZE, pageParam + 1) },
        (_, i) => pageParam - i,
      );
      return getMembers(ids);
    },
    getNextPageParam: (_last, _pages, lastParam) =>
      lastParam - PAGE_SIZE >= 0 ? lastParam - PAGE_SIZE : undefined,
  });
}

export function useMember(tokenId: number | null | undefined) {
  return useQuery({
    queryKey: queryKeys.member(tokenId ?? -1),
    enabled: tokenId !== null && tokenId !== undefined && tokenId >= 0,
    queryFn: () => getMember(tokenId!),
  });
}

export function useRecovery(tokenId: number | null | undefined) {
  return useQuery({
    queryKey: queryKeys.recovery(tokenId ?? -1),
    enabled: tokenId !== null && tokenId !== undefined,
    queryFn: async () => (await getRecoveries([tokenId!]))[0] ?? null,
  });
}

export function useNqg(tokenId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.nqg(tokenId ?? -1),
    enabled: enabled && tokenId !== null && tokenId !== undefined,
    queryFn: () => getNqg(tokenId!),
    staleTime: 10 * 60_000,
  });
}

export function useProfile(cid: string | undefined) {
  return useQuery({
    queryKey: queryKeys.profile(cid ?? ""),
    enabled: Boolean(cid),
    queryFn: () => fetchProfile(cid!),
    // content addressed
    staleTime: Infinity,
    retry: 1,
  });
}

export function useAdmin() {
  return useQuery({
    queryKey: queryKeys.admin,
    queryFn: getAdmin,
    staleTime: Infinity,
  });
}

/** The token held by the connected wallet. */
export function useMyMembership() {
  const { address } = useWallet();
  const tokenOf = useQuery({
    queryKey: queryKeys.tokenOf(address),
    enabled: Boolean(address),
    queryFn: () => getTokenOf(address!),
  });
  const member = useMember(tokenOf.data);
  return {
    address,
    tokenId: tokenOf.data ?? null,
    member: member.data ?? null,
    isLoading: tokenOf.isLoading || member.isLoading,
  };
}

export function useProjects(search: string) {
  return useQuery({
    queryKey: queryKeys.projects(search),
    queryFn: () => api.projects(search),
    placeholderData: keepPreviousData,
    staleTime: 60 * 60_000,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: queryKeys.project(id),
    queryFn: () => api.project(id),
    staleTime: 60 * 60_000,
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

/** Refresh everything related to members after a transaction. */
export function useInvalidateMembers() {
  const client = useQueryClient();
  return useCallback(
    () => client.invalidateQueries({ queryKey: ["members"] }),
    [client],
  );
}
