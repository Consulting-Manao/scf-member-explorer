import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";

import { AccountLinks } from "@/components/AccountLinks";
import { MemberAvatar } from "@/components/MemberAvatar";
import { RecoveryBanner } from "@/components/RecoveryBanner";
import { RoleBadge } from "@/components/RoleBadge";
import { Button } from "@/components/ui/button";
import type { MemberView } from "@/lib/contract";
import { useMemberName, useRecovery } from "@/queries/members";

import { AccountsSection } from "./AccountsSection";
import { KeySection } from "./KeySection";
import { ProfileSection } from "./ProfileSection";
import { ProjectsSection } from "./ProjectsSection";

/** Management of the membership held by the connected address. */
export function MemberProfile({
  member,
  tokenId,
}: {
  member: MemberView;
  tokenId: number;
}) {
  const { name } = useMemberName(member);
  const { data: recovery } = useRecovery(tokenId);
  const address = member.owner!;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-5">
        <MemberAvatar member={member} className="size-20 text-2xl" />
        <div className="flex-1 space-y-2">
          <h1 className="text-3xl font-semibold">{name}</h1>
          <div className="flex flex-wrap items-center gap-3">
            <RoleBadge role={member.role} />
            <span className="font-mono text-sm text-muted-foreground">
              #{member.tokenId}
            </span>
            <AccountLinks accounts={member.accounts} />
          </div>
        </div>
        <Button asChild variant="outline">
          <Link
            to="/members/$tokenId"
            params={{ tokenId: String(member.tokenId) }}
          >
            <ExternalLinkIcon /> View as others see it
          </Link>
        </Button>
      </div>

      {recovery && (
        <RecoveryBanner member={member} recovery={recovery} canCancel />
      )}

      <ProfileSection member={member} address={address} />
      <ProjectsSection
        key={member.projects.join()}
        member={member}
        address={address}
      />
      <AccountsSection member={member} address={address} />
      <KeySection member={member} />
    </div>
  );
}
