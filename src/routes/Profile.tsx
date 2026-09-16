import type { AssembledTransaction } from "@stellar/stellar-sdk/contract";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Buffer } from "buffer";
import {
  ExternalLinkIcon,
  HourglassIcon,
  LifeBuoyIcon,
  MailIcon,
  WalletIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";

import {
  accountsFromClaims,
  fromHex,
  PROVIDER_HINT,
  PROVIDER_ID,
  PROVIDER_LABEL,
  providerName,
  RECOVERY_DELAY_SECONDS,
  ROLES,
  type ProviderName,
  type SocialAccount,
} from "@shared/membership";

import { AccountLinks } from "@/components/AccountLinks";
import { ProviderIcon } from "@/components/icons";
import { KeyHandover } from "@/components/KeyHandover";
import { MemberAvatar } from "@/components/MemberAvatar";
import { MemberCard } from "@/components/MemberCard";
import { ProfileForm } from "@/components/ProfileForm";
import { ProjectList, ProjectPicker } from "@/components/ProjectPicker";
import { RecoveryBanner } from "@/components/RecoveryBanner";
import { RoleBadge } from "@/components/RoleBadge";
import { TxProgress } from "@/components/TxProgress";
import { VerifyAccounts } from "@/components/VerifyAccounts";
import { Alert } from "@/components/ui/alert";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/useNow";
import { config } from "@/lib/config";
import { knownEmail, rememberEmail } from "@/lib/email";
import { enabledProviders, startOAuth } from "@/lib/oauth";
import {
  getTokenByAccount,
  membershipClient,
  type MemberView,
} from "@/lib/contract";
import {
  EMPTY_PROFILE,
  isEmptyProfile,
  packCar,
  profileFiles,
  uploadCar,
  type Profile as IpfsProfile,
  type ProfileInput,
} from "@/lib/ipfs";
import { memberName } from "@/lib/members";
import { execute, type Step } from "@/lib/tx";
import { notify } from "@/lib/toast";
import { cn, formatDuration } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";
import {
  useClaims,
  useInvalidateMembers,
  useMember,
  useMyMembership,
  useProfile,
  useRecovery,
} from "@/queries/members";

const RETURN_TO = "/profile";

function Choice({
  options,
  value,
  onChange,
}: {
  options: [string, string][];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            "cursor-pointer rounded-full border px-3 py-1 text-sm",
            value === key
              ? "border-foreground bg-foreground text-background"
              : "hover:bg-muted",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Onboarding: the connected address holds no membership                    */
/* ----------------------------------------------------------------------- */

function Onboarding({ address }: { address: string }) {
  const { mode } = useSearch({ from: "/profile" });
  const navigate = useNavigate({ from: "/profile" });
  const { signTransaction } = useWallet();
  const claims = useClaims(address);
  const invalidate = useInvalidateMembers();
  const [emailFrom, setEmailFrom] = useState<ProviderName | "">("");
  const [profile, setProfile] = useState<ProfileInput>(EMPTY_PROFILE);
  const [projects, setProjects] = useState<string[]>([]);
  const [progress, setProgress] = useState<Step | null>(null);

  const verified = claims.map((c) => c.claim);
  const discord = verified.find((c) => c.provider === "discord");
  const emailSources = verified.filter((c) => c.emailHash);
  const role = config().roleSource === "discord" ? (discord?.role ?? 0) : 0;
  const external = accountsFromClaims(verified, emailFrom || undefined);

  const mint = async () => {
    try {
      let bio = "";
      let car: Uint8Array | undefined;
      if (!isEmptyProfile(profile)) {
        ({ cid: bio, car } = await packCar(await profileFiles(profile)));
      }
      const tx = await membershipClient(address).mint({
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
      });
      const sent = await execute(tx, {
        signTransaction,
        claims: claims.map((c) => c.token),
        beforeSubmit: car ? (signed) => uploadCar(bio, car, signed) : undefined,
        onStep: setProgress,
      });
      const chosen = emailSources.find((c) => c.provider === emailFrom);
      if (chosen?.email && chosen.emailHash) {
        rememberEmail(chosen.emailHash, chosen.email);
      }
      await invalidate([sent.result]);
      notify.success(`Welcome aboard, you are member #${sent.result}`, {
        tx: sent,
      });
      window.scrollTo({ top: 0 });
    } catch (error) {
      notify.failure("Membership not minted", error, { onRetry: mint });
    } finally {
      setProgress(null);
    }
  };

  if (mode === "recover") {
    return <Recovery address={address} />;
  }

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
            returnTo={RETURN_TO}
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
              <Choice
                value={emailFrom}
                onChange={(value) => setEmailFrom(value as ProviderName | "")}
                options={[
                  ["", "No email"],
                  ...emailSources.map((c): [string, string] => [
                    c.provider,
                    c.email ?? `${PROVIDER_LABEL[c.provider]} email`,
                  ]),
                ]}
              />
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
                {emailFrom
                  ? (emailSources.find((c) => c.provider === emailFrom)
                      ?.email ?? `${PROVIDER_LABEL[emailFrom]} email`)
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
          {progress && (
            <TxProgress
              steps={[
                "attest",
                "sign",
                ...(isEmptyProfile(profile) ? [] : (["upload"] as const)),
                "submit",
              ]}
              current={progress}
            />
          )}
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            variant="accent"
            size="lg"
            disabled={!discord || progress !== null}
            onClick={mint}
          >
            Mint membership
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Recovery of an existing membership from a new address                    */
/* ----------------------------------------------------------------------- */

function Recovery({ address }: { address: string }) {
  const navigate = useNavigate({ from: "/profile" });
  const { signTransaction } = useWallet();
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

  const pendingHere = recovery && recovery.newAddress === address;
  const remaining = recovery
    ? Math.floor((recovery.executableAt.getTime() - now) / 1000)
    : 0;

  // Same rule as the attester: two of the membership's accounts, or its only one.
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

  const run = async (
    build: () => Promise<AssembledTransaction<unknown>>,
    attested: boolean,
    done: string,
    failed: string,
  ) => {
    try {
      const tx = await build();
      const sent = await execute(tx, {
        signTransaction,
        claims: attested ? claims.map((c) => c.token) : undefined,
        onStep: setProgress,
      });
      if (tokenId !== null) await invalidate([tokenId]);
      notify.success(done, { tx: sent });
    } catch (error) {
      notify.failure(failed, error, {
        onRetry: () => run(build, attested, done, failed),
      });
    } finally {
      setProgress(null);
    }
  };

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
        </CardHeader>
        <CardContent>
          <VerifyAccounts
            address={address}
            returnTo="/profile?mode=recover"
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
                  onClick={() =>
                    run(
                      () =>
                        membershipClient(address).finalize_recovery({
                          token_id: member.tokenId,
                        }),
                      false,
                      "Membership recovered",
                      "Recovery not finalized",
                    )
                  }
                >
                  Finalize recovery
                </Button>
              ) : (
                <Button
                  variant="accent"
                  disabled={
                    Boolean(recovery) || !canPropose || progress !== null
                  }
                  onClick={() =>
                    run(
                      () =>
                        membershipClient(address).propose_recovery({
                          token_id: member.tokenId,
                          new_address: address,
                        }),
                      true,
                      "Recovery started",
                      "Recovery not started",
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

/* ----------------------------------------------------------------------- */
/* Management of an existing membership                                     */
/* ----------------------------------------------------------------------- */

async function imageFile(url: string): Promise<File | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const blob = await res.blob();
  return new File([blob], url.split("/").at(-1) ?? "profile-image", {
    type: blob.type,
  });
}

function ProfileSection({ member }: { member: MemberView }) {
  const { data: profile, isLoading } = useProfile(member.bio || undefined);
  if (isLoading) return <Skeleton className="h-96" />;
  return <ProfileEditor key={member.bio} member={member} profile={profile} />;
}

function ProfileEditor({
  member,
  profile,
}: {
  member: MemberView;
  profile: IpfsProfile | null | undefined;
}) {
  const { address, signTransaction } = useWallet();
  const invalidate = useInvalidateMembers();
  const [input, setInput] = useState<ProfileInput>(() =>
    profile
      ? {
          name: profile.name,
          description: profile.description,
          social: profile.social,
          image: null,
        }
      : EMPTY_PROFILE,
  );
  const [keepImage, setKeepImage] = useState(true);
  const [progress, setProgress] = useState<Step | null>(null);
  const currentImage = keepImage ? profile?.image : undefined;

  const save = async () => {
    if (!address) return;
    try {
      let files = input;
      if (!input.image && currentImage) {
        files = { ...input, image: await imageFile(currentImage) };
      }
      let bio = "";
      let car: Uint8Array | undefined;
      if (!isEmptyProfile(files)) {
        ({ cid: bio, car } = await packCar(await profileFiles(files)));
      }
      if (bio === member.bio) {
        notify.info("Nothing changed");
        return;
      }
      const tx = await membershipClient(address).set_bio({
        caller: address,
        token_id: member.tokenId,
        bio,
      });
      const sent = await execute(tx, {
        signTransaction,
        beforeSubmit: car ? (signed) => uploadCar(bio, car, signed) : undefined,
        onStep: setProgress,
      });
      await invalidate([member.tokenId]);
      notify.success("Profile updated", { tx: sent });
    } catch (error) {
      notify.failure("Profile not updated", error, { onRetry: save });
    } finally {
      setProgress(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your profile</CardTitle>
        <CardDescription>
          Stored on IPFS and linked to your membership.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ProfileForm
          value={input}
          onChange={setInput}
          currentImage={currentImage}
          onClearCurrentImage={() => setKeepImage(false)}
        />
        {progress && (
          <TxProgress steps={["sign", "upload", "submit"]} current={progress} />
        )}
      </CardContent>
      <CardFooter className="justify-end">
        <Button disabled={progress !== null} onClick={save}>
          Save profile
        </Button>
      </CardFooter>
    </Card>
  );
}

function ProjectsSection({ member }: { member: MemberView }) {
  const { address, signTransaction } = useWallet();
  const invalidate = useInvalidateMembers();
  const [projects, setProjects] = useState(member.projects);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!address) return;
    setBusy(true);
    try {
      const tx = await membershipClient(address).set_projects({
        caller: address,
        token_id: member.tokenId,
        projects,
      });
      const sent = await execute(tx, { signTransaction });
      await invalidate([member.tokenId]);
      notify.success("Projects updated", { tx: sent });
    } catch (error) {
      notify.failure("Projects not updated", error, { onRetry: save });
    } finally {
      setBusy(false);
    }
  };

  const changed = projects.join() !== member.projects.join();
  return (
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
      <CardFooter className="justify-end">
        <Button disabled={!changed || busy} onClick={save}>
          Save projects
        </Button>
      </CardFooter>
    </Card>
  );
}

function AccountsSection({ member }: { member: MemberView }) {
  const { address, signTransaction } = useWallet();
  const invalidate = useInvalidateMembers();
  const claims = useClaims(address);
  const [removed, setRemoved] = useState<number[]>([]);
  const [email, setEmail] = useState<"keep" | "none" | ProviderName>("keep");
  const [progress, setProgress] = useState<Step | null>(null);

  const bound = new Map(member.accounts.map((a) => [a.provider, a]));
  const fresh = new Map(claims.map((c) => [PROVIDER_ID[c.claim.provider], c]));
  const accounts: SocialAccount[] = enabledProviders()
    .map((provider) => {
      const id = PROVIDER_ID[provider];
      const claim = fresh.get(id)?.claim;
      const account = claim
        ? { provider: id, id: claim.id, handle: claim.handle }
        : bound.get(id);
      return account && !removed.includes(id) ? account : null;
    })
    .filter((a): a is SocialAccount => a !== null);

  const emailClaims = claims.filter((c) => c.claim.emailHash);
  const currentEmail = knownEmail(member.emailHash);
  const emailHash =
    email === "keep"
      ? member.emailHash
      : email === "none"
        ? null
        : (fresh.get(PROVIDER_ID[email])?.claim.emailHash ?? null);
  const shownEmail =
    email === "none"
      ? null
      : email === "keep"
        ? currentEmail
        : (fresh.get(PROVIDER_ID[email])?.claim.email ?? null);

  const changed =
    removed.length > 0 ||
    emailHash !== member.emailHash ||
    accounts.some((a) => {
      const current = bound.get(a.provider);
      return !current || current.id !== a.id;
    });

  const save = async () => {
    if (!address) return;
    try {
      const tx = await membershipClient(address).set_external_accounts({
        token_id: member.tokenId,
        external_accounts: {
          accounts,
          email_hash: emailHash ? Buffer.from(fromHex(emailHash)) : undefined,
        },
      });
      const sent = await execute(tx, {
        signTransaction,
        claims: claims.map((c) => c.token),
        onStep: setProgress,
      });
      if (emailHash && shownEmail) rememberEmail(emailHash, shownEmail);
      setRemoved([]);
      setEmail("keep");
      await invalidate([member.tokenId]);
      notify.success("Accounts updated", { tx: sent });
    } catch (error) {
      notify.failure("Accounts not updated", error, { onRetry: save });
    } finally {
      setProgress(null);
    }
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
          {enabledProviders().map((provider) => {
            const id = PROVIDER_ID[provider];
            const current = bound.get(id);
            const claim = fresh.get(id)?.claim;
            const isRemoved = removed.includes(id);
            const isNew =
              Boolean(claim) && (!current || current.id !== claim!.id);
            const handle = claim?.handle ?? current?.handle ?? current?.id;
            return (
              <li
                key={provider}
                className={cn(
                  "flex items-center gap-4 p-4",
                  isRemoved && "opacity-60",
                )}
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <ProviderIcon provider={provider} className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {PROVIDER_LABEL[provider]}
                    {isNew && !isRemoved && (
                      <Badge variant="success">New</Badge>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isRemoved
                      ? "Removed, save to apply."
                      : handle
                        ? handle
                        : PROVIDER_HINT[provider]}
                  </p>
                </div>
                {isRemoved ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRemoved(removed.filter((p) => p !== id))}
                  >
                    Undo
                  </Button>
                ) : handle ? (
                  provider !== "discord" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${PROVIDER_LABEL[provider]}`}
                      onClick={() => setRemoved([...removed, id])}
                    >
                      <XIcon />
                    </Button>
                  )
                ) : (
                  address && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        startOAuth(provider, address, RETURN_TO).catch(
                          (error) =>
                            notify.failure("Verification not started", error),
                        )
                      }
                    >
                      Verify
                    </Button>
                  )
                )}
              </li>
            );
          })}
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
              {emailClaims.some((c) => c.claim.emailHash !== emailHash) && (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {emailClaims
                    .filter((c) => c.claim.emailHash !== emailHash)
                    .map((c) => (
                      <Button
                        key={c.claim.provider}
                        variant="outline"
                        size="sm"
                        onClick={() => setEmail(c.claim.provider)}
                      >
                        Use{" "}
                        {c.claim.email ??
                          `${PROVIDER_LABEL[c.claim.provider]} email`}
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
        {progress && (
          <TxProgress steps={["attest", "sign", "submit"]} current={progress} />
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
            <Button
              variant="ghost"
              disabled={progress !== null}
              onClick={() => {
                setRemoved([]);
                setEmail("keep");
              }}
            >
              Discard
            </Button>
            <Button
              disabled={claims.length === 0 || progress !== null}
              onClick={save}
            >
              Save changes
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}

function KeySection({ member }: { member: MemberView }) {
  const invalidate = useInvalidateMembers();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your key</CardTitle>
        <CardDescription>
          Move your membership to another Stellar account. Same member, same
          history, new key.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <KeyHandover
          actionLabel="Rotate"
          adoptNewKey
          build={(newAddress) =>
            membershipClient(newAddress).rotate_key({
              token_id: member.tokenId,
              new_address: newAddress,
            })
          }
          onDone={async () => {
            await invalidate([member.tokenId]);
            window.scrollTo({ top: 0 });
          }}
        />
      </CardContent>
    </Card>
  );
}

function MemberProfile({
  member,
  tokenId,
}: {
  member: MemberView;
  tokenId: number;
}) {
  const { data: profile } = useProfile(member.bio || undefined);
  const { data: recovery } = useRecovery(tokenId);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-5">
        <MemberAvatar member={member} className="size-20 text-2xl" />
        <div className="flex-1 space-y-2">
          <h1 className="text-3xl font-semibold">
            {memberName(member, profile?.name)}
          </h1>
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
      {member.revoked && (
        <Alert variant="destructive">
          This membership has been revoked. Contact an admin if you think this
          is a mistake.
        </Alert>
      )}

      <ProfileSection member={member} />
      <ProjectsSection key={member.projects.join()} member={member} />
      <AccountsSection member={member} />
      <KeySection member={member} />
    </div>
  );
}

/* ----------------------------------------------------------------------- */

export function Profile() {
  const { address, connect } = useWallet();
  const { tokenId, member, isLoading } = useMyMembership();

  if (!address) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
              <WalletIcon className="size-5" />
            </div>
            <CardTitle className="text-2xl">Your membership</CardTitle>
            <CardDescription>
              Connect your Stellar wallet to claim your membership or manage it.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center pt-6">
            <Button
              size="lg"
              onClick={() =>
                connect().catch((e) => notify.failure("Not connected", e))
              }
            >
              Connect wallet
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-12 sm:px-6">
        <Skeleton className="h-24" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (member && tokenId !== null) {
    return <MemberProfile member={member} tokenId={tokenId} />;
  }
  return <Onboarding address={address} />;
}
