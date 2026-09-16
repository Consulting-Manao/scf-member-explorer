import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, SearchIcon, UsersRoundIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { ROLES } from "@shared/membership";

import { MemberCard, MemberCardSkeleton } from "@/components/MemberCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MemberView } from "@/lib/contract";
import { cn } from "@/lib/utils";
import {
  PAGE_SIZE,
  useMemberCount,
  useMembers,
  useMyMembership,
} from "@/queries/members";

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

  const loaded = useMemo(
    () =>
      (members.data?.pages.flat() ?? []).filter(
        (m): m is MemberView => m !== null,
      ),
    [members.data],
  );
  const visible = loaded.filter(
    (m) => matches(m, search.trim()) && (role === null || m.role === role),
  );
  const countByRole = ROLES.map(
    (_, i) => loaded.filter((m) => !m.revoked && m.role === i).length,
  );

  return (
    <>
      <section className="starfield border-b">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1.4fr_1fr] md:items-end md:py-24">
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm text-muted-foreground">
              <UsersRoundIcon className="size-4" />
              {count === undefined ? "…" : count}{" "}
              {count === 1 ? "member" : "members"} and counting
            </p>
            <h1 className="text-4xl leading-[1.05] font-semibold sm:text-6xl">
              Your seat in the
              <br />
              <span className="bg-gradient-to-r from-amber-500 to-yellow-300 bg-clip-text text-transparent">
                Stellar community.
              </span>
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              A membership that lives on Stellar and moves with you. Prove your
              accounts once, mint it, rotate keys whenever you like, and recover
              it if you ever lose them.
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
          <dl className="grid grid-cols-2 gap-3">
            {ROLES.map((name, i) => (
              <div
                key={name}
                className="rounded-xl border bg-card/70 p-4 backdrop-blur"
              >
                <dt className="text-sm text-muted-foreground">{name}</dt>
                <dd className="mt-1 font-display text-3xl font-semibold">
                  {members.isLoading ? "…" : countByRole[i]}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section
        id="members"
        className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12 sm:px-6"
      >
        <div className="flex flex-col gap-4 pb-6 md:flex-row md:items-center md:justify-between">
          <h2 className="text-2xl font-semibold">Members</h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-1.5">
              {[null, 0, 1, 2, 3].map((value) => (
                <button
                  key={String(value)}
                  type="button"
                  onClick={() => setRole(value)}
                  className={cn(
                    "cursor-pointer rounded-full border px-3 py-1 text-sm transition",
                    role === value
                      ? "border-foreground bg-foreground text-background"
                      : "hover:bg-muted",
                  )}
                >
                  {value === null ? "All" : ROLES[value]}
                </button>
              ))}
            </div>
            <div className="relative sm:w-64">
              <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, address or #id"
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
          {visible.map((member) => (
            <MemberCard key={member.tokenId} member={member} />
          ))}
          {(members.isLoading || members.isFetchingNextPage) &&
            Array.from({ length: 8 }, (_, i) => <MemberCardSkeleton key={i} />)}
        </div>

        {count === 0 && (
          <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
            No one here yet. Be the first to claim a membership.
          </div>
        )}
        {!members.isLoading && loaded.length > 0 && visible.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">
            No member matches your search.
          </p>
        )}

        {members.hasNextPage && (
          <div className="flex justify-center pt-8">
            <Button
              variant="outline"
              onClick={() => members.fetchNextPage()}
              disabled={members.isFetchingNextPage}
            >
              Load {PAGE_SIZE} more
            </Button>
          </div>
        )}
      </section>
    </>
  );
}
