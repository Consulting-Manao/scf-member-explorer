import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { HourglassIcon } from "lucide-react";

import {
  PROVIDER_ID,
  PROVIDER_LABEL,
  providerName,
  RECOVERY_DELAY_SECONDS,
} from "@shared/membership";

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
import { useRemaining } from "@/hooks/useNow";
import { useTxAction } from "@/hooks/useTxAction";
import { getTokenByAccount, membershipClient } from "@/lib/contract";
import { formatDuration } from "@/lib/utils";
import {
  queryKeys,
  useClaims,
  useMember,
  useRecovery,
} from "@/queries/members";

/** Recovery of an existing membership from a new address. */
export function Recovery({ address }: { address: string }) {
  const navigate = useNavigate({ from: "/profile" });
  const claims = useClaims(address);
  const { step, busy, run } = useTxAction();

  const found = useQuery({
    queryKey: queryKeys.tokenByAccounts(claims.map((c) => c.claim.id)),
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
  const pendingHere = recovery && recovery.newAddress === address;
  const remaining = useRemaining(recovery?.executableAt ?? new Date(0));

  // the attester's rule: two of the membership's accounts, or its only one
  const accounts = member?.accounts ?? [];
  const required = Math.min(2, accounts.length);
  const missing = accounts.filter(
    (account) =>
      !claims.some(
        ({ claim }) =>
          PROVIDER_ID[claim.provider] === account.provider &&
          claim.id === account.id,
      ),
  );
  const proven = accounts.length - missing.length;
  const canPropose = required > 0 && proven >= required;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold sm:text-4xl">
          Recover your membership
        </h1>
        <p className="text-muted-foreground">
          Lost the key that holds it? Prove two of its accounts, or the only one
          it has, and it moves to this account after{" "}
          {formatDuration(RECOVERY_DELAY_SECONDS)}, unless the old key or an
          admin cancels. An admin can approve sooner.
        </p>
        <Button
          variant="link"
          className="px-0"
          onClick={() => navigate({ search: {} })}
        >
          New here? Claim a membership instead
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prove the accounts of your membership</CardTitle>
          <CardDescription>
            Sign in with the accounts bound to the membership you are
            recovering.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VerifyAccounts address={address} returnTo="/profile?mode=recover" />
        </CardContent>
      </Card>

      {claims.length > 0 && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>Your membership</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {found.isLoading && (
              <p className="text-sm text-muted-foreground">Looking it up…</p>
            )}
            {found.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No membership is bound to these accounts.
              </p>
            )}
            {(found.data?.length ?? 0) > 1 && (
              <Alert variant="warning">
                These accounts belong to different memberships. Only verify the
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
            {member && !member.revoked && !recovery && !canPropose && (
              <Alert>
                {required === 0
                  ? "This membership has no verified account, so it cannot be recovered this way. Contact an admin."
                  : `Prove ${required - proven} more of its accounts to continue: ${missing
                      .map((a) => PROVIDER_LABEL[providerName(a.provider)])
                      .join(", ")}.`}
              </Alert>
            )}
            {pendingHere && (
              <Alert variant={remaining > 0 ? "default" : "success"}>
                <HourglassIcon />
                {remaining > 0
                  ? `Recovery in progress. You can finalize in ${formatDuration(remaining)}.`
                  : "The waiting period is over. Finalize to take your membership back."}
              </Alert>
            )}
            {step && (
              <TxProgress
                steps={
                  pendingHere
                    ? ["sign", "submit"]
                    : ["attest", "sign", "submit"]
                }
                current={step}
              />
            )}
          </CardContent>
          {member && !member.revoked && (
            <CardFooter className="justify-end">
              {pendingHere ? (
                <Button
                  variant="accent"
                  disabled={remaining > 0 || busy}
                  onClick={() =>
                    run(
                      () =>
                        membershipClient(address).finalize_recovery({
                          token_id: member.tokenId,
                        }),
                      {
                        touched: [member.tokenId],
                        done: "Membership recovered",
                        failed: "Recovery not finalized",
                      },
                    )
                  }
                >
                  Finalize recovery
                </Button>
              ) : (
                <Button
                  variant="accent"
                  disabled={Boolean(recovery) || !canPropose || busy}
                  onClick={() =>
                    run(
                      () =>
                        membershipClient(address).propose_recovery({
                          token_id: member.tokenId,
                          new_address: address,
                        }),
                      {
                        claims: claims.map((c) => c.token),
                        touched: [member.tokenId],
                        done: "Recovery started",
                        failed: "Recovery not started",
                      },
                    )
                  }
                >
                  Start recovery
                </Button>
              )}
            </CardFooter>
          )}
        </Card>
      )}
    </div>
  );
}
