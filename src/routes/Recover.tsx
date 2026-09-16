import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { HourglassIcon, LifeBuoyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PROVIDER_ID, RECOVERY_DELAY_SECONDS } from "@shared/membership";

import { MemberCard } from "@/components/MemberCard";
import { TxProgress } from "@/components/TxProgress";
import { VerifyAccounts } from "@/components/VerifyAccounts";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useNow } from "@/hooks/useNow";
import { getTokenByAccount, membershipClient } from "@/lib/contract";
import { execute, type Step } from "@/lib/tx";
import { errorMessage, formatDuration } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";
import {
  useClaims,
  useInvalidateMembers,
  useMember,
  useMyMembership,
  useRecovery,
} from "@/queries/members";

export function Recover() {
  const { address, connect, signTransaction } = useWallet();
  const { member: current } = useMyMembership();
  const claims = useClaims(address);
  const invalidate = useInvalidateMembers();
  const [progress, setProgress] = useState<Step | null>(null);
  const now = useNow();

  const found = useQuery({
    queryKey: ["recover", "lookup", claims.map((c) => c.claim.id)],
    enabled: claims.length > 0,
    queryFn: async () => {
      const ids = await Promise.all(
        claims.map(({ claim }) =>
          getTokenByAccount(PROVIDER_ID[claim.provider], claim.id),
        ),
      );
      return [...new Set(ids.filter((id): id is number => id !== null))];
    },
  });
  const tokenId = found.data?.length === 1 ? found.data[0]! : null;
  const { data: member } = useMember(tokenId);
  const { data: recovery } = useRecovery(tokenId);

  if (!address) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
              <LifeBuoyIcon className="size-5" />
            </div>
            <CardTitle className="text-2xl">Recover a membership</CardTitle>
            <CardDescription>
              Lost your key? Connect a new account and prove the accounts of
              your membership. It moves to the new account after{" "}
              {formatDuration(RECOVERY_DELAY_SECONDS)}, unless your old key or
              an admin cancels it.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center pt-6">
            <Button
              size="lg"
              onClick={() =>
                connect().catch((e) => toast.error(errorMessage(e)))
              }
            >
              Connect new account
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (current) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-3xl font-semibold">This account is a member</h1>
        <p className="mt-3 text-muted-foreground">
          Recovery moves a membership to an account without one. Connect a new
          account, or rotate your key from your membership page.
        </p>
        <Button asChild className="mt-8">
          <Link to="/me" search={{ tab: "key" }}>
            Rotate key
          </Link>
        </Button>
      </div>
    );
  }

  const pendingHere = recovery && recovery.newAddress === address;
  const remaining = recovery
    ? Math.floor((recovery.executableAt.getTime() - now) / 1000)
    : 0;

  const propose = async () => {
    if (tokenId === null) return;
    try {
      const tx = await membershipClient(address).propose_recovery({
        token_id: tokenId,
        new_address: address,
      });
      await execute(tx, {
        signTransaction,
        claims: claims.map((c) => c.token),
        onStep: setProgress,
      });
      toast.success("Recovery proposed");
      await invalidate();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setProgress(null);
    }
  };

  const finalize = async () => {
    if (tokenId === null) return;
    try {
      const tx = await membershipClient(address).finalize_recovery({
        token_id: tokenId,
      });
      await execute(tx, { signTransaction, onStep: setProgress });
      toast.success("Membership recovered");
      await invalidate();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold sm:text-4xl">Recover</h1>
        <p className="text-muted-foreground">
          Prove two accounts of your membership, or the only one it has.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Prove your accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <VerifyAccounts
            address={address}
            providers={["discord", "github", "x"]}
            returnTo="/recover"
            hints={{
              discord: "The Discord account of your membership.",
              github: "The GitHub account of your membership.",
              x: "The X account of your membership.",
            }}
          />
        </CardContent>
      </Card>

      {claims.length > 0 && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>2. Your membership</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {found.isLoading && (
              <p className="text-sm text-muted-foreground">Looking up…</p>
            )}
            {found.data?.length === 0 && (
              <Alert>No membership is bound to these accounts.</Alert>
            )}
            {(found.data?.length ?? 0) > 1 && (
              <Alert variant="warning">
                These accounts belong to different memberships. Only verify
                accounts of the membership to recover.
              </Alert>
            )}
            {member && (
              <div className="max-w-xs">
                <MemberCard member={member} />
              </div>
            )}
            {member?.revoked && (
              <Alert variant="destructive">
                This membership was revoked. Contact an admin.
              </Alert>
            )}
            {recovery && !pendingHere && (
              <Alert variant="warning">
                Another recovery is already pending for this membership.
              </Alert>
            )}
            {pendingHere && (
              <Alert variant={remaining > 0 ? "default" : "success"}>
                <HourglassIcon />
                {remaining > 0
                  ? `Recovery pending: finalize in ${formatDuration(remaining)}. An admin can approve it earlier.`
                  : "The delay is over, you can finalize the recovery."}
              </Alert>
            )}
            {progress && (
              <TxProgress
                steps={
                  pendingHere
                    ? ["sign", "submit"]
                    : ["attest", "sign", "submit"]
                }
                current={progress}
              />
            )}
          </CardContent>
          {member && !member.revoked && (
            <CardFooter className="justify-end">
              {pendingHere ? (
                <Button
                  variant="accent"
                  disabled={remaining > 0 || progress !== null}
                  onClick={finalize}
                >
                  Finalize recovery
                </Button>
              ) : (
                <Button
                  variant="accent"
                  disabled={Boolean(recovery) || progress !== null}
                  onClick={propose}
                >
                  Propose recovery
                </Button>
              )}
            </CardFooter>
          )}
        </Card>
      )}
    </div>
  );
}
