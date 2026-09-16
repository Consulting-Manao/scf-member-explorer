import { Link } from "@tanstack/react-router";

import { useInView } from "@/hooks/useInView";
import type { MemberView } from "@/lib/contract";
import { cn } from "@/lib/utils";
import { useMemberName, useNqg } from "@/queries/members";

import { MemberAvatar } from "./MemberAvatar";
import { RoleBadge } from "./RoleBadge";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";

export function MemberCard({ member }: { member: MemberView }) {
  const { name, profile } = useMemberName(member);
  // the score is one simulation per member, read once the card is on screen
  const { ref, inView } = useInView<HTMLAnchorElement>();
  const { data: nqg } = useNqg(member.tokenId, inView && !member.revoked);

  return (
    <Link
      ref={ref}
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
        <p className="truncate font-display text-lg font-semibold">{name}</p>
        <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
          {profile?.description || " "}
        </p>
      </div>
      <div className="mt-auto flex items-center gap-2">
        {member.revoked ? (
          <Badge variant="destructive">Revoked</Badge>
        ) : (
          <RoleBadge role={member.role} />
        )}
        {nqg ? <NqgScore value={nqg} /> : null}
      </div>
    </Link>
  );
}

function NqgScore({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-xs text-muted-foreground",
        className,
      )}
      title="Neural quorum governance score"
    >
      NQG {value.toFixed(2)}
    </span>
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
