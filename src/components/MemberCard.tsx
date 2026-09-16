import { Link } from "@tanstack/react-router";

import type { MemberView } from "@/lib/contract";
import { memberName } from "@/lib/members";
import { useProfile } from "@/queries/members";

import { AccountLinks } from "./AccountLinks";
import { MemberAvatar } from "./MemberAvatar";
import { RoleBadge } from "./RoleBadge";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";

export function MemberCard({ member }: { member: MemberView }) {
  const { data: profile } = useProfile(member.bio || undefined);

  return (
    <Link
      to="/members/$tokenId"
      params={{ tokenId: String(member.tokenId) }}
      className="group flex animate-fade-in flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <MemberAvatar member={member} />
        <span className="font-mono text-xs text-muted-foreground">
          #{member.tokenId}
        </span>
      </div>
      <div className="min-w-0 space-y-1">
        <p className="truncate font-display text-lg font-semibold">
          {memberName(member, profile?.name)}
        </p>
        <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
          {profile?.description || " "}
        </p>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2">
        {member.revoked ? (
          <Badge variant="destructive">Revoked</Badge>
        ) : (
          <RoleBadge role={member.role} />
        )}
        <AccountLinks accounts={member.accounts} asLinks={false} />
      </div>
    </Link>
  );
}

export function MemberCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <Skeleton className="size-12 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-full" />
      </div>
      <Skeleton className="h-5 w-20" />
    </div>
  );
}
