import { useState } from "react";

import { PROVIDER_ID } from "@shared/membership";

import type { MemberView } from "@/lib/contract";
import { memberName } from "@/lib/members";
import { cn } from "@/lib/utils";
import { useProfile } from "@/queries/members";

/** Stable gradient from the token id. */
function gradient(tokenId: number): string {
  const hue = (tokenId * 137.508) % 360;
  return `linear-gradient(135deg, oklch(0.62 0.15 ${hue}), oklch(0.45 0.16 ${(hue + 60) % 360}))`;
}

export function MemberAvatar({
  member,
  className,
}: {
  member: MemberView;
  className?: string;
}) {
  const { data: profile } = useProfile(member.bio || undefined);
  const [failed, setFailed] = useState<string | null>(null);

  const github = member.accounts.find((a) => a.provider === PROVIDER_ID.github);
  const source =
    profile?.image ??
    (github
      ? `https://avatars.githubusercontent.com/u/${github.id}?s=160`
      : null);
  const name = memberName(member, profile?.name);

  return (
    <div
      className={cn(
        "relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full font-display font-semibold text-white ring-2 ring-background",
        className,
      )}
      style={{ background: gradient(member.tokenId) }}
    >
      {source && failed !== source ? (
        <img
          src={source}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailed(source)}
        />
      ) : (
        <span aria-hidden>{name.slice(0, 1).toUpperCase()}</span>
      )}
    </div>
  );
}
