import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, SearchIcon, UsersRoundIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ROLES } from "@shared/membership";

import { MemberCard, MemberCardSkeleton } from "@/components/MemberCard";
import { ProjectFilter } from "@/components/ProjectFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSentinel } from "@/hooks/useSentinel";
import type { MemberView } from "@/lib/contract";
import { cn } from "@/lib/utils";
import { useMemberCount, useMembers, useMyMembership } from "@/queries/members";

/** Cards revealed per scroll step; pages are read 100 at a time. */
const STEP = 24;

function matches(member: MemberView, search: string): boolean {
  if (!search) return true;
  const needle = search.toLowerCase();
  return (
    String(member.tokenId) === needle.replace("#", "") ||
    member.owner?.toLowerCase().includes(needle) ||
    member.accounts.some((a) => a.handle.toLowerCase().includes(needle)) ||
    member.projects.some((p) => p.toLowerCase().includes(needle))
  );
}

export function Home() {
  const { data: count } = useMemberCount();
  const members = useMembers(count);
  const { member: me } = useMyMembership();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<number | null>(null);
  const [project, setProject] = useState<string | null>(null);
  // cards revealed for the current filters
  const filterKey = `${search.trim()}|${role}|${project}`;
  const [reveal, setReveal] = useState({ key: filterKey, n: STEP });
  const shown = reveal.key === filterKey ? reveal.n : STEP;

  const loaded = useMemo(
    () =>
      (members.data?.pages.flat() ?? []).filter(
        (m): m is MemberView => m !== null,
      ),
    [members.data],
  );
  const filtering = Boolean(search.trim() || role !== null || project);
  const visible = loaded.filter(
    (m) =>
      matches(m, search.trim()) &&
      (role === null || m.role === role) &&
      (project === null || m.projects.includes(project)),
  );
  const complete = !members.hasNextPage && !members.isLoading;
  const countByRole = ROLES.map(
    (_, i) => loaded.filter((m) => !m.revoked && m.role === i).length,
  );

  // reveal more cards as the sentinel comes into view, read the next page
  // once the loaded ones are all shown
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = members;
  const sentinel = useSentinel<HTMLDivElement>(() => {
    if (shown < visible.length) {
      setReveal({ key: filterKey, n: shown + STEP });
    } else if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [shown, visible.length, filterKey, hasNextPage, isFetchingNextPage]);

  // a filter needs every page to give a complete answer
  useEffect(() => {
    if (filtering && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [filtering, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const cards = visible.slice(0, shown);

  return (
    <>
      <section className="starfield border-b">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <div className="max-w-2xl space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm text-muted-foreground">
              <UsersRoundIcon className="size-4" />
              {count === undefined ? "…" : count}{" "}
              {count === 1 ? "member" : "members"} and counting
            </p>
            <h1 className="text-4xl leading-[1.05] font-semibold sm:text-6xl">
              Your seat in the
              <br />
              <span className="bg-gradient-to-r from-amber-500 to-yellow-400 bg-clip-text text-transparent dark:from-amber-300 dark:to-yellow-200">
                Stellar community.
              </span>
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Your membership, owned by you, recorded on the Stellar blockchain.
              It carries your role and your work.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" variant="accent">
                <Link to="/profile">
                  {me ? "My membership" : "Claim your membership"}{" "}
                  <ArrowRightIcon />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#members">Meet the members</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section
        id="members"
        className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12 sm:px-6"
      >
        <div className="flex flex-col gap-4 pb-6 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-2xl font-semibold">Members</h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex flex-wrap gap-1.5">
              {[null, 0, 1, 2, 3].map((value) => (
                <button
                  key={String(value)}
                  type="button"
                  onClick={() => setRole(value)}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition",
                    role === value
                      ? "border-foreground bg-foreground text-background"
                      : "hover:bg-muted",
                  )}
                >
                  {value === null ? "All" : ROLES[value]}
                  {complete && value !== null && (
                    <span className="text-xs opacity-70">
                      {countByRole[value]}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <ProjectFilter
              value={project}
              onChange={setProject}
              className="sm:w-56"
            />
            <div className="relative sm:w-56">
              <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, address or #id"
                className="pl-9"
              />
            </div>
          </div>
        </div>

        {members.isError && (
          <p className="text-destructive">
            The members could not be loaded. Check your connection and retry.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((member) => (
            <MemberCard key={member.tokenId} member={member} />
          ))}
          {(members.isLoading || (members.isFetchingNextPage && !filtering)) &&
            Array.from({ length: 8 }, (_, i) => <MemberCardSkeleton key={i} />)}
        </div>

        {count === 0 && (
          <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
            No one here yet. Be the first to claim a membership.
          </div>
        )}
        {complete && loaded.length > 0 && visible.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">
            No member matches.
          </p>
        )}
        {filtering && !complete && count !== undefined && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Loaded {loaded.length} of {count} members…
          </p>
        )}

        <div ref={sentinel} className="h-px" />
      </section>
    </>
  );
}
