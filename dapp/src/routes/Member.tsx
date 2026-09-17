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
import { ipfsUrl } from "@/lib/ipfs";
import { httpUrl } from "@/lib/utils";
import type { MemberView } from "@/lib/contract";
import { useWallet } from "@/lib/wallet";
import {
  useAdmin,
  useMember,
  useMemberName,
  useNqg,
  useRecovery,
} from "@/queries/members";

export function MemberPage() {
  const { tokenId: param } = useParams({ from: "/members/$tokenId" });
  const tokenId = Number(param);
  const { data: member, isLoading } = useMember(
    Number.isInteger(tokenId) ? tokenId : null,
  );

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
  return <MemberDetails member={member} />;
}

function MemberDetails({ member }: { member: MemberView }) {
  const { address } = useWallet();
  const { name, profile } = useMemberName(member);
  const { data: recovery } = useRecovery(member.tokenId);
  const { data: nqg } = useNqg(member.tokenId, !member.revoked);
  const { data: admin } = useAdmin();
  const isOwner = Boolean(address && address === member.owner);
  const social = httpUrl(profile?.social);
  const bioUrl = member.bio ? ipfsUrl(member.bio) : null;

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
            {name}
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
            {social && (
              <a
                href={social}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <GlobeIcon className="size-4" /> {social}
              </a>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Governance</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <dt className="text-sm text-muted-foreground">NQG score</dt>
              <dd className="font-display text-xl font-semibold">
                {nqg === undefined || nqg === null ? "—" : nqg.toFixed(2)}
              </dd>
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
        {bioUrl && (
          <a
            href={bioUrl}
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
