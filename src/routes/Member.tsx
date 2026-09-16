import { Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  GlobeIcon,
  PencilIcon,
} from "lucide-react";

import { AccountLinks } from "@/components/AccountLinks";
import { Copyable } from "@/components/Copyable";
import { MemberAvatar } from "@/components/MemberAvatar";
import { ProjectList } from "@/components/ProjectPicker";
import { RecoveryBanner } from "@/components/RecoveryBanner";
import { RoleBadge } from "@/components/RoleBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { explorerUrl } from "@/lib/config";
import { memberName } from "@/lib/members";
import { ipfsUrl } from "@/lib/ipfs";
import {
  useAdmin,
  useMember,
  useNqg,
  useProfile,
  useRecovery,
} from "@/queries/members";
import { useWallet } from "@/lib/wallet";

export function MemberPage() {
  const { tokenId: param } = useParams({ from: "/members/$tokenId" });
  const tokenId = Number(param);
  const { address } = useWallet();
  const { data: member, isLoading } = useMember(
    Number.isInteger(tokenId) ? tokenId : null,
  );
  const { data: profile } = useProfile(member?.bio || undefined);
  const { data: recovery } = useRecovery(member ? tokenId : null);
  const { data: nqg } = useNqg(tokenId, Boolean(member && !member.revoked));
  const { data: admin } = useAdmin();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-12 sm:px-6">
        <Skeleton className="size-24 rounded-full" />
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6">
        <h1 className="text-3xl font-semibold">No such member</h1>
        <Button asChild variant="link">
          <Link to="/">Back to members</Link>
        </Button>
      </div>
    );
  }

  const isOwner = Boolean(address && address === member.owner);

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" /> Members
      </Link>

      {recovery && (
        <RecoveryBanner
          member={member}
          recovery={recovery}
          canCancel={Boolean(address && (isOwner || address === admin))}
        />
      )}

      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <MemberAvatar member={member} className="size-24 text-3xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {member.revoked ? (
              <Badge variant="destructive">Revoked</Badge>
            ) : (
              <RoleBadge role={member.role} />
            )}
            <span className="font-mono text-sm text-muted-foreground">
              #{member.tokenId}
            </span>
          </div>
          <h1 className="truncate text-3xl font-semibold sm:text-4xl">
            {memberName(member, profile?.name)}
          </h1>
          {member.owner && <Copyable value={member.owner} />}
        </div>
        {isOwner && (
          <Button asChild variant="outline">
            <Link to="/profile">
              <PencilIcon /> Edit
            </Link>
          </Button>
        )}
      </div>

      {profile?.description && (
        <p className="text-lg leading-relaxed whitespace-pre-line">
          {profile.description}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Verified accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <AccountLinks accounts={member.accounts} withHandles />
            {member.emailHash && (
              <p className="text-sm text-muted-foreground">
                A verified email links this member to their contributions.
              </p>
            )}
            {profile?.social && (
              <a
                href={profile.social}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <GlobeIcon className="size-4" /> {profile.social}
              </a>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Governance</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-muted-foreground">Role</dt>
                <dd className="font-display text-xl font-semibold">
                  <RoleBadge role={member.role} />
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">NQG score</dt>
                <dd className="font-display text-xl font-semibold">
                  {nqg === undefined || nqg === null ? "—" : nqg.toFixed(2)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectList ids={member.projects} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        {member.owner && (
          <a
            href={explorerUrl("account", member.owner)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-foreground"
          >
            <ExternalLinkIcon className="size-4" /> Account
          </a>
        )}
        {member.bio && (
          <a
            href={ipfsUrl(member.bio)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-foreground"
          >
            <ExternalLinkIcon className="size-4" /> Profile on IPFS
          </a>
        )}
      </div>
    </div>
  );
}
