import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  EraserIcon,
  KeyRoundIcon,
  ShieldCheckIcon,
  ShieldOffIcon,
  UserRoundXIcon,
  ZapIcon,
} from "lucide-react";
import { StrKey } from "@stellar/stellar-sdk";
import { useState } from "react";

import { ROLES } from "@stellar-membership/shared";

import {
  AddressFact,
  ConfirmDialog,
  Facts,
  MemberFact,
} from "@/components/ConfirmDialog";
import { Copyable } from "@/components/Copyable";
import { MemberAvatar } from "@/components/MemberAvatar";
import { ProjectPicker } from "@/components/ProjectPicker";
import { RoleBadge } from "@/components/RoleBadge";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { useRemaining } from "@/hooks/useNow";
import { useTxAction } from "@/hooks/useTxAction";
import { config } from "@/lib/config";
import {
  getMembers,
  getRecoveries,
  membershipClient,
  type MemberView,
  type Recovery,
} from "@/lib/contract";
import { notify } from "@/lib/toast";
import { formatDuration } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";
import {
  queryKeys,
  useAdmin,
  useInstance,
  useInvalidateInstance,
  useMember,
  useMemberCount,
  useMemberName,
} from "@/queries/members";

function PendingRecoveries({ admin }: { admin: string }) {
  const { data: count } = useMemberCount();
  const pending = useQuery({
    queryKey: queryKeys.recoveries(count ?? 0),
    enabled: count !== undefined,
    queryFn: async () => {
      const ids = Array.from({ length: count! }, (_, i) => i);
      const recoveries = await getRecoveries(ids);
      const pending = ids
        .map((id, i) => ({ id, recovery: recoveries[i] }))
        .filter((r): r is { id: number; recovery: Recovery } =>
          Boolean(r.recovery),
        );
      const members = await getMembers(pending.map((r) => r.id));
      return pending.map(({ recovery }, i) => ({
        member: members[i]!,
        recovery,
      }));
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending recoveries</CardTitle>
        <CardDescription>
          Talk to the member before approving early. Anyone can finalize once
          the waiting period is over.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {pending.isLoading && <Skeleton className="h-16" />}
        {pending.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No pending recovery.</p>
        )}
        <ul className="divide-y">
          {pending.data?.map(({ member, recovery }) => (
            <RecoveryRow
              key={member.tokenId}
              admin={admin}
              member={member}
              recovery={recovery}
              onDone={() => pending.refetch()}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function RecoveryRow({
  admin,
  member,
  recovery,
  onDone,
}: {
  admin: string;
  member: MemberView;
  recovery: Recovery;
  onDone: () => void;
}) {
  const { name } = useMemberName(member);
  const { perform } = useTxAction();
  const remaining = useRemaining(recovery.executableAt);
  const wait = remaining > 0 ? formatDuration(remaining) : null;

  return (
    <li className="flex flex-wrap items-center gap-4 py-3">
      <MemberAvatar member={member} className="size-10" />
      <div className="min-w-0 flex-1">
        <Link
          to="/members/$tokenId"
          params={{ tokenId: String(member.tokenId) }}
          className="font-medium hover:underline"
        >
          {name} #{member.tokenId}
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          to <Copyable value={recovery.newAddress} />
          <Badge variant="outline">{wait ? `in ${wait}` : "ready"}</Badge>
        </div>
      </div>
      <ConfirmDialog
        trigger={
          <Button size="sm" variant="outline">
            Cancel
          </Button>
        }
        tone="destructive"
        icon={<ShieldOffIcon />}
        title="Cancel this recovery?"
        description="The membership stays with its current key. Whoever asked for the recovery will have to prove the accounts again."
        actionLabel="Cancel recovery"
        cancelLabel="Keep it"
        onConfirm={async (onStep) => {
          const tx = await perform(
            await membershipClient(admin).cancel_recovery({
              caller: admin,
              token_id: member.tokenId,
            }),
            { touched: [member.tokenId], onStep },
          );
          notify.success(`Recovery of #${member.tokenId} cancelled`, { tx });
          onDone();
        }}
      >
        <Facts>
          <MemberFact member={member} />
          <AddressFact from={member.owner} to={recovery.newAddress} />
        </Facts>
      </ConfirmDialog>
      <ConfirmDialog
        trigger={<Button size="sm">Approve now</Button>}
        tone="warning"
        icon={<ZapIcon />}
        title={wait ? "Approve the recovery now?" : "Finalize the recovery?"}
        description={
          wait
            ? `The membership moves to the new key today instead of in ${wait}. Talk to the member first.`
            : "The waiting period is over. The membership moves to the new key."
        }
        actionLabel={wait ? "Approve now" : "Finalize"}
        onConfirm={async (onStep) => {
          const tx = await perform(
            await membershipClient(admin).finalize_recovery({
              token_id: member.tokenId,
            }),
            { touched: [member.tokenId], onStep },
          );
          notify.success(`Member #${member.tokenId} recovered`, { tx });
          onDone();
        }}
      >
        <Facts>
          <MemberFact
            member={member}
            badge={
              wait ? { label: `${wait} early`, variant: "warning" } : undefined
            }
          />
          <AddressFact from={member.owner} to={recovery.newAddress} />
        </Facts>
      </ConfirmDialog>
    </li>
  );
}

function ManageMember({ admin }: { admin: string }) {
  const [input, setInput] = useState("");
  const tokenId = /^\d+$/.test(input) ? Number(input) : null;
  const { data: member, isFetching } = useMember(tokenId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage a member</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="max-w-xs space-y-2">
          <Label htmlFor="token-id">Member id</Label>
          <Input
            id="token-id"
            inputMode="numeric"
            value={input}
            onChange={(e) => setInput(e.target.value.trim())}
            placeholder="0"
          />
        </div>
        {tokenId !== null && isFetching && !member && (
          <Skeleton className="h-24" />
        )}
        {tokenId !== null && !isFetching && member === null && (
          <p className="text-sm text-muted-foreground">
            No member with this id.
          </p>
        )}
        {member && (
          <MemberEditor key={member.tokenId} admin={admin} member={member} />
        )}
      </CardContent>
    </Card>
  );
}

/** Mounted per member, so the drafts start from its current values. */
function MemberEditor({
  admin,
  member,
}: {
  admin: string;
  member: MemberView;
}) {
  const { name } = useMemberName(member);
  const { busy, run, perform } = useTxAction();
  const [role, setRole] = useState<number | null>(null);
  const [projects, setProjects] = useState<string[] | null>(null);
  const [newAddress, setNewAddress] = useState("");
  const draft = projects ?? member.projects;
  const projectsChanged = draft.join() !== member.projects.join();
  const validAddress =
    StrKey.isValidEd25519PublicKey(newAddress) ||
    StrKey.isValidContract(newAddress);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <MemberAvatar member={member} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold">{name}</p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {member.revoked ? (
              <Badge variant="destructive">Revoked</Badge>
            ) : (
              <RoleBadge role={member.role} />
            )}
            {member.owner && <Copyable value={member.owner} />}
          </div>
        </div>
      </div>

      <section className="space-y-3 rounded-xl border p-4">
        <h4 className="font-medium">Role</h4>
        <div className="flex flex-wrap gap-1.5">
          {ROLES.map((label, i) => (
            <Pill
              key={label}
              selected={(role ?? member.role) === i}
              onClick={() => setRole(i)}
            >
              {label}
            </Pill>
          ))}
        </div>
        <Button
          size="sm"
          disabled={busy || role === null || role === member.role}
          onClick={() =>
            run(
              () =>
                membershipClient(admin).set_role({
                  token_id: member.tokenId,
                  role: role!,
                }),
              {
                touched: [member.tokenId],
                done: `Member #${member.tokenId} is now ${ROLES[role!]}`,
                failed: "Role not saved",
              },
            ).then(() => setRole(null))
          }
        >
          Save role
        </Button>
      </section>

      <section className="space-y-3 rounded-xl border p-4">
        <div>
          <h4 className="font-medium">Projects</h4>
          <p className="text-sm text-muted-foreground">
            The Stellar projects this member builds or maintains, from PG Atlas.
          </p>
        </div>
        <ProjectPicker value={draft} onChange={setProjects} />
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={busy || !projectsChanged}
            onClick={() =>
              run(
                () =>
                  membershipClient(admin).set_projects({
                    caller: admin,
                    token_id: member.tokenId,
                    projects: draft,
                  }),
                {
                  touched: [member.tokenId],
                  done: `Projects of #${member.tokenId} updated`,
                  failed: "Projects not saved",
                },
              ).then(() => setProjects(null))
            }
          >
            Save projects
          </Button>
          {projectsChanged && (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setProjects(null)}
            >
              Discard
            </Button>
          )}
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-3 rounded-xl border p-4">
        <div className="min-w-0 flex-1">
          <h4 className="font-medium">Profile and status</h4>
          <p className="text-sm text-muted-foreground">
            Clear an inappropriate profile, or revoke the membership.
          </p>
        </div>
        <ConfirmDialog
          trigger={
            <Button variant="outline" size="sm" disabled={!member.bio}>
              Clear profile
            </Button>
          }
          icon={<EraserIcon />}
          title="Clear this profile?"
          description="The name, picture and description go away. The member can publish a new profile at any time."
          actionLabel="Clear profile"
          onConfirm={async (onStep) => {
            const tx = await perform(
              await membershipClient(admin).set_bio({
                caller: admin,
                token_id: member.tokenId,
                bio: "",
              }),
              { touched: [member.tokenId], onStep },
            );
            notify.success(`Profile of #${member.tokenId} cleared`, { tx });
          }}
        >
          <Facts>
            <MemberFact member={member} />
          </Facts>
        </ConfirmDialog>
        <ConfirmDialog
          trigger={
            <Button variant="destructive" size="sm" disabled={member.revoked}>
              Revoke
            </Button>
          }
          tone="destructive"
          icon={<UserRoundXIcon />}
          title="Revoke this membership?"
          description="The key is released and the role is lost. The accounts stay bound, so they cannot be used for another membership. Moving the token to a new key reinstates it."
          actionLabel="Revoke"
          cancelLabel="Keep"
          onConfirm={async (onStep) => {
            const tx = await perform(
              await membershipClient(admin).revoke({
                token_id: member.tokenId,
              }),
              { touched: [member.tokenId], onStep },
            );
            notify.success(`Member #${member.tokenId} revoked`, { tx });
          }}
        >
          <Facts>
            <MemberFact
              member={member}
              badge={{ label: "Irreversible", variant: "destructive" }}
            />
            {member.owner && <AddressFact to={member.owner} />}
          </Facts>
        </ConfirmDialog>
      </section>

      <section className="space-y-3 rounded-xl border p-4">
        <div>
          <h4 className="font-medium">Move to a new key</h4>
          <p className="text-sm text-muted-foreground">
            For a lost key when the accounts cannot be proven, or to reinstate a
            revoked member. Only you sign: make sure the member controls this
            address.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="move-address">New address</Label>
          <Input
            id="move-address"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value.trim())}
            placeholder="G… or C…"
            spellCheck={false}
          />
        </div>
        <ConfirmDialog
          trigger={<Button disabled={!validAddress}>Move</Button>}
          tone="warning"
          icon={<KeyRoundIcon />}
          title="Move this membership?"
          description={
            member.revoked
              ? "The membership is reinstated on the new key, with its role and accounts."
              : "The current key loses the membership at once. Same member, same history, new key."
          }
          actionLabel="Move"
          onConfirm={async (onStep) => {
            const tx = await perform(
              await membershipClient(admin).recover({
                token_id: member.tokenId,
                new_address: newAddress,
              }),
              { touched: [member.tokenId], onStep },
            );
            notify.success(`Member #${member.tokenId} moved`, { tx });
            setNewAddress("");
          }}
        >
          <Facts>
            <MemberFact member={member} />
            <AddressFact from={member.owner} to={newAddress} />
          </Facts>
        </ConfirmDialog>
      </section>
    </div>
  );
}

function Attester({ admin }: { admin: string }) {
  const { perform } = useTxAction();
  const invalidateInstance = useInvalidateInstance();
  const [attester, setAttester] = useState("");
  const { data: instance } = useInstance();
  const current = instance?.attester;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attester</CardTitle>
        <CardDescription>
          The key that co-signs verified accounts. Replace it immediately if it
          leaks, then update the worker secret.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {current && <Copyable value={current} short={false} />}
        {current && current !== config().attester && (
          <Alert variant="warning">
            The worker is configured with another attester.
          </Alert>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={attester}
            onChange={(e) => setAttester(e.target.value.trim())}
            placeholder="New attester G…"
            className="font-mono"
          />
          <ConfirmDialog
            trigger={
              <Button disabled={!StrKey.isValidEd25519PublicKey(attester)}>
                Replace
              </Button>
            }
            tone="warning"
            icon={<ShieldCheckIcon />}
            title="Replace the attester?"
            description="Verifications stop until the worker is configured with the new secret. Every claim signed for the old key becomes useless."
            actionLabel="Replace"
            onConfirm={async (onStep) => {
              const tx = await perform(
                await membershipClient(admin).set_attester({ attester }),
                { touched: [], onStep },
              );
              await invalidateInstance();
              notify.success("Attester replaced", { tx });
              setAttester("");
            }}
          >
            <Facts>
              <AddressFact from={current} to={attester} label="Attester" />
            </Facts>
          </ConfirmDialog>
        </div>
      </CardContent>
    </Card>
  );
}

export function Admin() {
  const { address } = useWallet();
  const { data: admin, isLoading } = useAdmin();
  const { data: count } = useMemberCount();

  if (isLoading) return null;
  if (!address || address !== admin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-3xl font-semibold">Admins only</h1>
        <p className="mt-3 text-muted-foreground">
          Connect the admin account of the contract.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6">
      <div className="space-y-2 pb-2">
        <h1 className="inline-flex items-center gap-3 text-3xl font-semibold sm:text-4xl">
          <ShieldCheckIcon className="size-8" /> Admin
        </h1>
        <p className="text-muted-foreground">
          {count ?? "…"} memberships minted so far.
        </p>
      </div>
      <PendingRecoveries admin={address} />
      <ManageMember admin={address} />
      <Attester admin={address} />
    </div>
  );
}
