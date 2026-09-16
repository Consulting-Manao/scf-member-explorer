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

import { ROLES } from "@shared/membership";

import {
  AddressFact,
  ConfirmDialog,
  Facts,
  MemberFact,
} from "@/components/ConfirmDialog";
import { Copyable } from "@/components/Copyable";
import { MemberAvatar } from "@/components/MemberAvatar";
import { PageHeader } from "@/components/PageHeader";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/useNow";
import { config } from "@/lib/config";
import {
  getMembers,
  getRecoveries,
  membershipClient,
  type MemberView,
  type Recovery,
} from "@/lib/contract";
import { memberName } from "@/lib/members";
import { notify } from "@/lib/toast";
import { execute, type Step } from "@/lib/tx";
import { cn, formatDuration } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";
import {
  useAdmin,
  useInstance,
  useInvalidateInstance,
  useInvalidateMembers,
  useMember,
  useMemberCount,
  useProfile,
} from "@/queries/members";

type Build = (
  client: ReturnType<typeof membershipClient>,
  admin: string,
) => Promise<Parameters<typeof execute>[0]>;

/**
 * Signs and submits an admin call. `perform` is for dialogs, which show
 * the outcome themselves; `run` notifies.
 */
function useAdminAction() {
  const { address, signTransaction } = useWallet();
  const invalidate = useInvalidateMembers();
  const [busy, setBusy] = useState(false);

  const perform = async (
    build: Build,
    touched: number[],
    onStep?: (step: Step) => void,
  ) => {
    if (!address) throw new Error("Connect the admin account");
    const tx = await execute(await build(membershipClient(address), address), {
      signTransaction,
      onStep,
    });
    await invalidate(touched);
    return tx;
  };

  const run = async (title: string, build: Build, touched: number[]) => {
    setBusy(true);
    try {
      const tx = await perform(build, touched);
      notify.success(title, { tx });
    } catch (error) {
      notify.failure(`${title.replace(/ed$/, "")} failed`, error, {
        onRetry: () => run(title, build, touched),
      });
    } finally {
      setBusy(false);
    }
  };

  return { busy, run, perform };
}

function PendingRecoveries() {
  const { data: count } = useMemberCount();
  const pending = useQuery({
    queryKey: ["members", "recoveries", count],
    enabled: count !== undefined,
    queryFn: async () => {
      const ids = Array.from({ length: count! }, (_, i) => i);
      const recoveries = await getRecoveries(ids);
      const withRecovery = ids.filter((_, i) => recoveries[i]);
      const members = await getMembers(withRecovery);
      return withRecovery.map((id, i) => ({
        member: members[i]!,
        recovery: recoveries[id]!,
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
  member,
  recovery,
  onDone,
}: {
  member: MemberView;
  recovery: Recovery;
  onDone: () => void;
}) {
  const { data: profile } = useProfile(member.bio || undefined);
  const { perform } = useAdminAction();
  const now = useNow();
  const remaining = Math.floor((recovery.executableAt.getTime() - now) / 1000);
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
          {memberName(member, profile?.name)} #{member.tokenId}
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
            (client, admin) =>
              client.cancel_recovery({
                caller: admin,
                token_id: member.tokenId,
              }),
            [member.tokenId],
            onStep,
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
            (client) => client.finalize_recovery({ token_id: member.tokenId }),
            [member.tokenId],
            onStep,
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

function ManageMember() {
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

        {member && <MemberEditor key={member.tokenId} member={member} />}
      </CardContent>
    </Card>
  );
}

/** Mounted per member, so the drafts start from its current values. */
function MemberEditor({ member }: { member: MemberView }) {
  const { data: profile } = useProfile(member.bio || undefined);
  const { busy, run, perform } = useAdminAction();
  const [role, setRole] = useState<number | null>(null);
  const [projects, setProjects] = useState<string[] | null>(null);
  const draft = projects ?? member.projects;
  const projectsChanged = draft.join() !== member.projects.join();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <MemberAvatar member={member} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold">
            {memberName(member, profile?.name)}
          </p>
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
          {ROLES.map((name, i) => (
            <button
              key={name}
              type="button"
              onClick={() => setRole(i)}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1 text-sm transition",
                (role ?? member.role) === i
                  ? "border-foreground bg-foreground text-background"
                  : "hover:bg-muted",
              )}
            >
              {name}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          disabled={busy || role === null || role === member.role}
          onClick={() =>
            run(
              `Member #${member.tokenId} is now ${ROLES[role!]}`,
              (client) =>
                client.set_role({
                  token_id: member.tokenId,
                  role: role!,
                }),
              [member.tokenId],
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
                `Projects of #${member.tokenId} updated`,
                (client, admin) =>
                  client.set_projects({
                    caller: admin,
                    token_id: member.tokenId,
                    projects: draft,
                  }),
                [member.tokenId],
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
              (client, admin) =>
                client.set_bio({
                  caller: admin,
                  token_id: member.tokenId,
                  bio: "",
                }),
              [member.tokenId],
              onStep,
            );
            notify.success(`Profile of #${member.tokenId} cleared`, {
              tx,
            });
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
              (client) => client.revoke({ token_id: member.tokenId }),
              [member.tokenId],
              onStep,
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

      <MoveToKey member={member} />
    </div>
  );
}

function MoveToKey({ member }: { member: MemberView }) {
  const { perform } = useAdminAction();
  const [newAddress, setNewAddress] = useState("");
  const valid =
    StrKey.isValidEd25519PublicKey(newAddress) ||
    StrKey.isValidContract(newAddress);

  return (
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
        trigger={<Button disabled={!valid}>Move</Button>}
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
            (client) =>
              client.recover({
                token_id: member.tokenId,
                new_address: newAddress,
              }),
            [member.tokenId],
            onStep,
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
  );
}

function Attester() {
  const { perform } = useAdminAction();
  const invalidateInstance = useInvalidateInstance();
  const [attester, setAttester] = useState("");
  const { data: instance } = useInstance();
  const current = instance?.attester;
  const valid = StrKey.isValidEd25519PublicKey(attester);

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
            trigger={<Button disabled={!valid}>Replace</Button>}
            tone="warning"
            icon={<ShieldCheckIcon />}
            title="Replace the attester?"
            description="Verifications stop until the worker is configured with the new secret. Every claim signed for the old key becomes useless."
            actionLabel="Replace"
            onConfirm={async (onStep) => {
              const tx = await perform(
                (client) => client.set_attester({ attester }),
                [],
                onStep,
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
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            <ShieldCheckIcon className="size-8" /> Admin
          </span>
        }
        description={`${count ?? "…"} memberships minted so far.`}
      />
      <PendingRecoveries />
      <ManageMember />
      <Attester />
    </div>
  );
}
