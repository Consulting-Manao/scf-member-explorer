import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ShieldCheckIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ROLES } from "@shared/membership";

import { Copyable } from "@/components/Copyable";
import { KeyHandover } from "@/components/KeyHandover";
import { MemberAvatar } from "@/components/MemberAvatar";
import { PageHeader } from "@/components/PageHeader";
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { execute } from "@/lib/tx";
import { cn, errorMessage, formatDuration } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";
import {
  useAdmin,
  useInvalidateMembers,
  useMember,
  useMemberCount,
  useProfile,
} from "@/queries/members";

function useAdminAction() {
  const { address, signTransaction } = useWallet();
  const invalidate = useInvalidateMembers();
  const [busy, setBusy] = useState(false);
  const run = async (
    label: string,
    build: (
      client: ReturnType<typeof membershipClient>,
      admin: string,
    ) => Promise<Parameters<typeof execute>[0]>,
  ) => {
    if (!address) return;
    setBusy(true);
    try {
      await execute(await build(membershipClient(address), address), {
        signTransaction,
      });
      toast.success(label);
      await invalidate();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

function PendingRecoveries() {
  const { data: count } = useMemberCount();
  const { busy, run } = useAdminAction();
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
          Check the accounts with the member before approving early.
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
              busy={busy}
              onApprove={() =>
                run("Recovery approved", (client) =>
                  client.finalize_recovery({ token_id: member.tokenId }),
                )
              }
              onCancel={() =>
                run("Recovery cancelled", (client, admin) =>
                  client.cancel_recovery({
                    caller: admin,
                    token_id: member.tokenId,
                  }),
                )
              }
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
  busy,
  onApprove,
  onCancel,
}: {
  member: MemberView;
  recovery: Recovery;
  busy: boolean;
  onApprove: () => void;
  onCancel: () => void;
}) {
  const { data: profile } = useProfile(member.bio || undefined);
  const now = useNow();
  const remaining = Math.floor((recovery.executableAt.getTime() - now) / 1000);
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
          <Badge variant="outline">
            {remaining > 0 ? `in ${formatDuration(remaining)}` : "ready"}
          </Badge>
        </div>
      </div>
      <Button size="sm" variant="outline" disabled={busy} onClick={onCancel}>
        Cancel
      </Button>
      <Button size="sm" disabled={busy} onClick={onApprove}>
        Approve now
      </Button>
    </li>
  );
}

function ManageMember() {
  const [input, setInput] = useState("");
  const tokenId = /^\d+$/.test(input) ? Number(input) : null;
  const { data: member, isFetching } = useMember(tokenId);
  const { data: profile } = useProfile(member?.bio || undefined);
  const { busy, run } = useAdminAction();
  const invalidate = useInvalidateMembers();
  const [role, setRole] = useState<number | null>(null);

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
            onChange={(e) => {
              setInput(e.target.value.trim());
              setRole(null);
            }}
            placeholder="0"
          />
        </div>

        {tokenId !== null && !member && !isFetching && (
          <p className="text-sm text-muted-foreground">No member #{tokenId}.</p>
        )}

        {member && (
          <div className="animate-fade-in space-y-6">
            <div className="flex items-center gap-4">
              <MemberAvatar member={member} />
              <div className="space-y-1">
                <p className="font-medium">
                  {memberName(member, profile?.name)}
                </p>
                <div className="flex items-center gap-2">
                  {member.revoked ? (
                    <Badge variant="destructive">Revoked</Badge>
                  ) : (
                    <RoleBadge role={member.role} />
                  )}
                  {member.owner && <Copyable value={member.owner} />}
                </div>
              </div>
            </div>

            <section className="space-y-2">
              <h4 className="text-sm font-medium">Role</h4>
              <div className="flex flex-wrap items-center gap-2">
                {ROLES.map((name, i) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setRole(i)}
                    className={cn(
                      "cursor-pointer rounded-full border px-3 py-1 text-sm",
                      (role ?? member.role) === i
                        ? "border-foreground bg-foreground text-background"
                        : "hover:bg-muted",
                    )}
                  >
                    {name}
                  </button>
                ))}
                <Button
                  size="sm"
                  disabled={busy || role === null || role === member.role}
                  onClick={() =>
                    run("Role updated", (client) =>
                      client.set_role({
                        token_id: member.tokenId,
                        role: role!,
                      }),
                    )
                  }
                >
                  Save role
                </Button>
              </div>
            </section>

            <section className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={busy || member.revoked || !member.bio}
                onClick={() =>
                  run("Profile cleared", (client, admin) =>
                    client.set_bio({
                      caller: admin,
                      token_id: member.tokenId,
                      bio: "",
                    }),
                  )
                }
              >
                Clear profile
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busy || member.revoked}
                  >
                    Revoke
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Revoke member #{member.tokenId}?</DialogTitle>
                    <DialogDescription>
                      The address is released and the member loses its role. The
                      record and accounts are kept, so the accounts cannot be
                      used for a new membership. Moving the token to a new key
                      reinstates it.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex justify-end gap-2">
                    <DialogClose asChild>
                      <Button variant="ghost">Keep</Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button
                        variant="destructive"
                        onClick={() =>
                          run("Member revoked", (client) =>
                            client.revoke({ token_id: member.tokenId }),
                          )
                        }
                      >
                        Revoke
                      </Button>
                    </DialogClose>
                  </div>
                </DialogContent>
              </Dialog>
            </section>

            <section className="space-y-3 rounded-xl border p-4">
              <div>
                <h4 className="font-medium">Move to a new key</h4>
                <p className="text-sm text-muted-foreground">
                  For a lost key without verified accounts, or to reinstate a
                  revoked member. The new key signs too, so do it with the
                  member.
                </p>
              </div>
              <KeyHandover
                actionLabel="Move"
                build={(newAddress) =>
                  membershipClient(newAddress).recover({
                    token_id: member.tokenId,
                    new_address: newAddress,
                  })
                }
                onDone={() => invalidate()}
              />
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Attester() {
  const { busy, run } = useAdminAction();
  const [attester, setAttester] = useState("");
  const current = useQuery({
    queryKey: ["attester"],
    queryFn: async () => (await membershipClient().attester()).result,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attester</CardTitle>
        <CardDescription>
          The key co-signing verified accounts. Replace it immediately if it
          leaks, and update the worker secret.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {current.data && <Copyable value={current.data} short={false} />}
        {current.data && current.data !== config().attester && (
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
          <Button
            disabled={busy || !attester}
            onClick={() =>
              run("Attester replaced", (client) =>
                client.set_attester({ attester }),
              )
            }
          >
            Replace
          </Button>
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
        description={`${count ?? "…"} members minted.`}
      />
      <PendingRecoveries />
      <ManageMember />
      <Attester />
    </div>
  );
}
