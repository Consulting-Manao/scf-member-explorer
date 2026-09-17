import { useNavigate } from "@tanstack/react-router";
import { Buffer } from "buffer";
import { LifeBuoyIcon } from "lucide-react";
import { useState } from "react";

import {
  accountsFromClaims,
  fromHex,
  PROVIDER_LABEL,
  ROLES,
  type ProviderName,
} from "@stellar-membership/shared";

import { AccountLinks } from "@/components/AccountLinks";
import { ProfileForm } from "@/components/ProfileForm";
import { ProjectList, ProjectPicker } from "@/components/ProjectPicker";
import { RoleBadge } from "@/components/RoleBadge";
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
import { Pill } from "@/components/ui/pill";
import { useTxAction } from "@/hooks/useTxAction";
import { config } from "@/lib/config";
import { membershipClient } from "@/lib/contract";
import { rememberEmail } from "@/lib/email";
import {
  EMPTY_PROFILE,
  isEmptyProfile,
  packCar,
  profileFiles,
  uploadCar,
  type ProfileInput,
} from "@/lib/ipfs";
import { useClaims } from "@/queries/members";

/** The connected address holds no membership: verify, describe, mint. */
export function Onboarding({ address }: { address: string }) {
  const navigate = useNavigate({ from: "/profile" });
  const claims = useClaims(address);
  const { step, busy, run } = useTxAction();
  const [emailFrom, setEmailFrom] = useState<ProviderName | null>(null);
  const [profile, setProfile] = useState<ProfileInput>(EMPTY_PROFILE);
  const [projects, setProjects] = useState<string[]>([]);

  const verified = claims.map((c) => c.claim);
  const discord = verified.find((c) => c.provider === "discord");
  const emailSources = verified.filter((c) => c.emailHash);
  const email = emailSources.find((c) => c.provider === emailFrom);
  const role = config().roleSource === "discord" ? (discord?.role ?? 0) : 0;
  const external = accountsFromClaims(verified, emailFrom ?? undefined);

  const mint = async () => {
    let bio = "";
    let car: Uint8Array | undefined;
    if (!isEmptyProfile(profile)) {
      ({ cid: bio, car } = await packCar(profileFiles(profile)));
    }
    const sent = await run(
      () =>
        membershipClient(address).mint({
          to: address,
          role,
          external_accounts: {
            accounts: external.accounts,
            email_hash: external.emailHash
              ? Buffer.from(fromHex(external.emailHash))
              : undefined,
          },
          bio,
          projects,
        }),
      {
        claims: claims.map((c) => c.token),
        beforeSubmit: car ? (signed) => uploadCar(bio, car, signed) : undefined,
        touched: [],
        done: "Welcome aboard",
        failed: "Membership not minted",
      },
    );
    if (!sent) return;
    if (email?.email && email.emailHash) {
      rememberEmail(email.emailHash, email.email);
    }
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold sm:text-4xl">
          Claim your membership
        </h1>
        <p className="text-muted-foreground">
          Prove your accounts, say who you are, mint. Your Discord account on
          the Stellar Developers server is what gets you in.
        </p>
      </div>

      <Alert className="items-center">
        <LifeBuoyIcon />
        <span className="flex-1">
          Already a member and lost your key? Recover your membership with this
          account instead.
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate({ search: { mode: "recover" } })}
        >
          Recover
        </Button>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Prove your accounts</CardTitle>
          <CardDescription>
            Sign in with each platform. Only your public id and handle go
            on-chain, plus the hash of a verified email if you choose to link
            one.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <VerifyAccounts
            address={address}
            returnTo="/profile"
            showRole={config().roleSource === "discord"}
          />
          {emailSources.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                Link a verified email
              </legend>
              <p className="text-sm text-muted-foreground">
                Only its hash goes on-chain. It connects you to your commits in
                PG Atlas, and a hash can be matched against a known email, so
                skip it if you would rather not.
              </p>
              <div className="flex flex-wrap gap-2">
                <Pill
                  selected={emailFrom === null}
                  onClick={() => setEmailFrom(null)}
                >
                  No email
                </Pill>
                {emailSources.map((c) => (
                  <Pill
                    key={c.provider}
                    selected={emailFrom === c.provider}
                    onClick={() => setEmailFrom(c.provider)}
                  >
                    {c.email ?? `${PROVIDER_LABEL[c.provider]} email`}
                  </Pill>
                ))}
              </div>
            </fieldset>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Introduce yourself</CardTitle>
          <CardDescription>
            Optional. Stored on IPFS and linked to your membership.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm value={profile} onChange={setProfile} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your projects</CardTitle>
          <CardDescription>
            The Stellar projects you build or maintain, from PG Atlas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectPicker value={projects} onChange={setProjects} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mint your membership</CardTitle>
          <CardDescription>
            One transaction, signed by your wallet. The attester co-signs the
            accounts it verified and nothing else.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <dl className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <dt className="text-sm text-muted-foreground">Role</dt>
              <dd>
                <RoleBadge role={role} />
              </dd>
            </div>
            <div className="space-y-1.5">
              <dt className="text-sm text-muted-foreground">Accounts</dt>
              <dd>
                {external.accounts.length > 0 ? (
                  <AccountLinks accounts={external.accounts} withHandles />
                ) : (
                  <span className="text-sm text-muted-foreground">
                    None verified
                  </span>
                )}
              </dd>
            </div>
            <div className="space-y-1.5">
              <dt className="text-sm text-muted-foreground">Profile</dt>
              <dd className="text-sm">
                {isEmptyProfile(profile)
                  ? "No profile"
                  : profile.name || "Unnamed profile"}
              </dd>
            </div>
            <div className="space-y-1.5">
              <dt className="text-sm text-muted-foreground">Email</dt>
              <dd className="text-sm">
                {email
                  ? (email.email ?? `${PROVIDER_LABEL[email.provider]} email`)
                  : "Not linked"}
              </dd>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <dt className="text-sm text-muted-foreground">Projects</dt>
              <dd>
                <ProjectList ids={projects} />
              </dd>
            </div>
          </dl>
          {config().roleSource === "discord" && discord && role > 0 && (
            <Alert>
              You hold the {ROLES[role]} role on the Stellar Developers server.
              It comes with your membership.
            </Alert>
          )}
          {step && (
            <TxProgress
              steps={[
                "attest",
                "sign",
                ...(isEmptyProfile(profile) ? [] : (["upload"] as const)),
                "submit",
              ]}
              current={step}
            />
          )}
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            variant="accent"
            size="lg"
            disabled={!discord || busy}
            onClick={mint}
          >
            Mint membership
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
