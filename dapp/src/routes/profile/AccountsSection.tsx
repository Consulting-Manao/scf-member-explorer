import { Buffer } from "buffer";
import { MailIcon, XIcon } from "lucide-react";
import { useState } from "react";

import {
  accountOf,
  fromHex,
  PROVIDER_HINT,
  PROVIDER_ID,
  PROVIDER_LABEL,
  providerName,
  type Claim,
  type ProviderName,
  type SocialAccount,
} from "@stellar-membership/shared";

import { ProviderIcon } from "@/components/icons";
import { TxProgress } from "@/components/TxProgress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTxAction } from "@/hooks/useTxAction";
import { membershipClient, type MemberView } from "@/lib/contract";
import { knownEmail, rememberEmail } from "@/lib/email";
import { enabledProviders, startOAuth } from "@/lib/oauth";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useClaims } from "@/queries/members";

type EmailChoice = "keep" | "none" | ProviderName;

/**
 * The accounts bound to the membership, with the ones verified in this
 * session on top. Changes are saved in one attested transaction.
 */
export function AccountsSection({
  member,
  address,
}: {
  member: MemberView;
  address: string;
}) {
  const claims = useClaims(address);
  const { step, busy, run } = useTxAction();
  const [removed, setRemoved] = useState<number[]>([]);
  const [email, setEmail] = useState<EmailChoice>("keep");

  const bound = new Map(member.accounts.map((a) => [a.provider, a]));
  const fresh = new Map(
    claims.map((c) => [PROVIDER_ID[c.claim.provider], c.claim]),
  );
  // the platforms offered for verification, plus any other one bound on-chain
  const providers = [
    ...new Set([
      ...enabledProviders(),
      ...member.accounts.map((a) => providerName(a.provider)),
    ]),
  ].sort((a, b) => PROVIDER_ID[a] - PROVIDER_ID[b]);
  const accounts = providers
    .map((provider) => {
      const id = PROVIDER_ID[provider];
      const claim = fresh.get(id);
      const account = claim ? accountOf(claim) : bound.get(id);
      return account && !removed.includes(id) ? account : null;
    })
    .filter((a): a is SocialAccount => a !== null);

  const chosen =
    email === "keep" || email === "none"
      ? undefined
      : fresh.get(PROVIDER_ID[email]);
  const emailHash =
    email === "keep"
      ? member.emailHash
      : email === "none"
        ? null
        : (chosen?.emailHash ?? null);
  const shownEmail =
    email === "keep" ? knownEmail(member.emailHash) : (chosen?.email ?? null);
  const otherEmails = claims
    .map((c) => c.claim)
    .filter((c) => c.emailHash && c.emailHash !== emailHash);

  const changed =
    removed.length > 0 ||
    emailHash !== member.emailHash ||
    accounts.some((a) => bound.get(a.provider)?.id !== a.id);

  const discard = () => {
    setRemoved([]);
    setEmail("keep");
  };

  const save = async () => {
    const sent = await run(
      () =>
        membershipClient(address).set_external_accounts({
          token_id: member.tokenId,
          external_accounts: {
            accounts,
            email_hash: emailHash ? Buffer.from(fromHex(emailHash)) : undefined,
          },
        }),
      {
        claims: claims.map((c) => c.token),
        touched: [member.tokenId],
        done: "Accounts updated",
        failed: "Accounts not updated",
      },
    );
    if (!sent) return;
    if (emailHash && shownEmail) rememberEmail(emailHash, shownEmail);
    discard();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verified accounts</CardTitle>
        <CardDescription>
          They belong to your membership and follow it through key rotations and
          recoveries. Only your public id and handle go on-chain.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y rounded-xl border">
          {providers.map((provider) => (
            <AccountRow
              key={provider}
              provider={provider}
              address={address}
              bound={bound.get(PROVIDER_ID[provider])}
              claim={fresh.get(PROVIDER_ID[provider])}
              removed={removed.includes(PROVIDER_ID[provider])}
              onRemove={(yes) =>
                setRemoved(
                  yes
                    ? [...removed, PROVIDER_ID[provider]]
                    : removed.filter((p) => p !== PROVIDER_ID[provider]),
                )
              }
            />
          ))}
          <li className="flex items-center gap-4 p-4">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted">
              <MailIcon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">Email</p>
              <p className="text-sm text-muted-foreground">
                {emailHash === null
                  ? member.emailHash
                    ? "Unlinked, save to apply."
                    : "Not linked. Only its hash goes on-chain, matching your commits in PG Atlas."
                  : (shownEmail ??
                    "Linked. Verify an account to see the address again.")}
              </p>
              {otherEmails.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {otherEmails.map((c) => (
                    <Button
                      key={c.provider}
                      variant="outline"
                      size="sm"
                      onClick={() => setEmail(c.provider)}
                    >
                      Use {c.email ?? `${PROVIDER_LABEL[c.provider]} email`}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            {emailHash === null && member.emailHash ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEmail("keep")}
              >
                Undo
              </Button>
            ) : (
              emailHash && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Unlink email"
                  onClick={() => setEmail("none")}
                >
                  <XIcon />
                </Button>
              )
            )}
          </li>
        </ul>
        {step && (
          <TxProgress steps={["attest", "sign", "submit"]} current={step} />
        )}
      </CardContent>
      {changed && (
        <CardFooter className="flex-wrap justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {claims.length === 0
              ? "Verify one of your accounts to sign the change."
              : "The attester co-signs your verified accounts."}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={busy} onClick={discard}>
              Discard
            </Button>
            <Button disabled={claims.length === 0 || busy} onClick={save}>
              Save changes
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}

function AccountRow({
  provider,
  address,
  bound,
  claim,
  removed,
  onRemove,
}: {
  provider: ProviderName;
  address: string;
  bound: SocialAccount | undefined;
  claim: Claim | undefined;
  removed: boolean;
  onRemove: (removed: boolean) => void;
}) {
  const isNew = Boolean(claim) && bound?.id !== claim?.id;
  const handle = claim?.handle ?? bound?.handle ?? bound?.id;
  return (
    <li className={cn("flex items-center gap-4 p-4", removed && "opacity-60")}>
      <span className="flex size-10 items-center justify-center rounded-full bg-muted">
        <ProviderIcon provider={provider} className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {PROVIDER_LABEL[provider]}
          {isNew && !removed && <Badge variant="success">New</Badge>}
        </p>
        <p className="text-sm text-muted-foreground">
          {removed
            ? "Removed, save to apply."
            : (handle ?? PROVIDER_HINT[provider])}
        </p>
      </div>
      {removed ? (
        <Button variant="ghost" size="sm" onClick={() => onRemove(false)}>
          Undo
        </Button>
      ) : handle ? (
        provider !== "discord" && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove ${PROVIDER_LABEL[provider]}`}
            onClick={() => onRemove(true)}
          >
            <XIcon />
          </Button>
        )
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            startOAuth(provider, address, "/profile").catch((error) =>
              notify.failure("Verification not started", error),
            )
          }
        >
          Verify
        </Button>
      )}
    </li>
  );
}
