import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Buffer } from "buffer";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  PartyPopperIcon,
  WalletIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  accountsFromClaims,
  fromHex,
  PROVIDER_LABEL,
  ROLES,
  type ProviderName,
} from "@shared/membership";

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
import { config } from "@/lib/config";
import { membershipClient } from "@/lib/contract";
import {
  EMPTY_PROFILE,
  isEmptyProfile,
  packCar,
  profileFiles,
  uploadCar,
  type ProfileInput,
} from "@/lib/ipfs";
import { execute, type Step } from "@/lib/tx";
import { cn, errorMessage } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";
import { JOIN_STEPS, type JoinStep } from "@/routes/search";
import {
  useClaims,
  useInvalidateMembers,
  useMyMembership,
} from "@/queries/members";

const STEP_LABELS: Record<JoinStep, string> = {
  accounts: "Verify accounts",
  profile: "Profile",
  review: "Mint",
};

function Stepper({ current }: { current: JoinStep }) {
  const index = JOIN_STEPS.indexOf(current);
  return (
    <ol className="flex items-center gap-2 text-sm">
      {JOIN_STEPS.map((step, i) => (
        <li key={step} className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-full border text-xs font-semibold",
              i < index && "border-foreground bg-foreground text-background",
              i === index && "border-foreground",
              i > index && "text-muted-foreground",
            )}
          >
            {i < index ? <CheckIcon className="size-3.5" /> : i + 1}
          </span>
          <span
            className={cn(
              "hidden sm:inline",
              i !== index && "text-muted-foreground",
            )}
          >
            {STEP_LABELS[step]}
          </span>
          {i < JOIN_STEPS.length - 1 && (
            <span className="mx-1 h-px w-6 bg-border sm:w-10" />
          )}
        </li>
      ))}
    </ol>
  );
}

export function Join() {
  const { step } = useSearch({ from: "/join" });
  const navigate = useNavigate({ from: "/join" });
  const { address, connect, signTransaction } = useWallet();
  const { member, isLoading } = useMyMembership();
  const claims = useClaims(address);
  const invalidate = useInvalidateMembers();

  const [emailFrom, setEmailFrom] = useState<ProviderName | undefined>();
  const [profile, setProfile] = useState<ProfileInput>(EMPTY_PROFILE);
  const [projects, setProjects] = useState<string[]>([]);
  const [progress, setProgress] = useState<Step | null>(null);
  const [minted, setMinted] = useState<number | null>(null);

  const goTo = (next: JoinStep) => navigate({ search: { step: next } });

  if (minted !== null) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-accent/20">
          <PartyPopperIcon className="size-8" />
        </div>
        <h1 className="text-3xl font-semibold">Welcome to the community</h1>
        <p className="mt-3 text-muted-foreground">
          You are member #{minted}. Your membership lives on Stellar.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link to="/members/$tokenId" params={{ tokenId: String(minted) }}>
            See my profile <ArrowRightIcon />
          </Link>
        </Button>
      </div>
    );
  }

  if (!address) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
              <WalletIcon className="size-5" />
            </div>
            <CardTitle className="text-2xl">
              Join the Stellar community
            </CardTitle>
            <CardDescription>
              Connect the Stellar account which will hold your membership. You
              can rotate it later.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center pt-6">
            <Button
              size="lg"
              onClick={() =>
                connect().catch((e) => toast.error(errorMessage(e)))
              }
            >
              Connect wallet
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!isLoading && member) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-3xl font-semibold">You are already a member</h1>
        <p className="mt-3 text-muted-foreground">
          This account holds membership #{member.tokenId}.
        </p>
        <Button asChild className="mt-8">
          <Link to="/me">Manage my membership</Link>
        </Button>
      </div>
    );
  }

  const verified = claims.map((c) => c.claim);
  const discord = verified.find((c) => c.provider === "discord");
  const emailSources = verified.filter((c) => c.emailHash);
  const role = config().roleSource === "discord" ? (discord?.role ?? 0) : 0;
  const external = accountsFromClaims(verified, emailFrom);

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
      const tokenId = await execute(tx, {
        signTransaction,
        claims: claims.map((c) => c.token),
        beforeSubmit: car ? (signed) => uploadCar(bio, car, signed) : undefined,
        onStep: setProgress,
      });
      await invalidate();
      setMinted(tokenId);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold sm:text-4xl">Join</h1>
        <Stepper current={step} />
      </div>

      {step === "accounts" && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>Verify your accounts</CardTitle>
            <CardDescription>
              Accounts are checked by signing in with each platform. Only your
              public id and handle go on-chain, and the hash of a verified email
              if you choose one.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <VerifyAccounts
              address={address}
              providers={["discord", "github", "x"]}
              returnTo="/join?step=accounts"
              showRole={config().roleSource === "discord"}
            />
            {emailSources.length > 0 && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">
                  Link a verified email
                </legend>
                <p className="text-sm text-muted-foreground">
                  Its hash matches your commits in PG Atlas. A hash can be
                  compared with a known email, so skip it if you prefer.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {[undefined, ...emailSources.map((c) => c.provider)].map(
                    (provider) => (
                      <button
                        key={provider ?? "none"}
                        type="button"
                        onClick={() => setEmailFrom(provider)}
                        className={cn(
                          "cursor-pointer rounded-full border px-3 py-1 text-sm",
                          emailFrom === provider
                            ? "border-foreground bg-foreground text-background"
                            : "hover:bg-muted",
                        )}
                      >
                        {provider
                          ? `${PROVIDER_LABEL[provider]} email`
                          : "No email"}
                      </button>
                    ),
                  )}
                </div>
              </fieldset>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button disabled={!discord} onClick={() => goTo("profile")}>
              Continue <ArrowRightIcon />
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === "profile" && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>Your profile</CardTitle>
            <CardDescription>
              All optional. The profile is published on IPFS, projects are
              stored on-chain.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <ProfileForm value={profile} onChange={setProfile} />
            <div className="space-y-3">
              <h4 className="font-medium">Projects you work on</h4>
              <ProjectPicker value={projects} onChange={setProjects} />
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="ghost" onClick={() => goTo("accounts")}>
              <ArrowLeftIcon /> Back
            </Button>
            <Button disabled={!discord} onClick={() => goTo("review")}>
              Review <ArrowRightIcon />
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === "review" && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>Mint your membership</CardTitle>
            <CardDescription>
              One transaction, signed by your wallet. The attester co-signs the
              accounts it verified.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!discord && (
              <Alert variant="warning">
                Verify your Discord account first.
              </Alert>
            )}
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
                  <AccountLinks accounts={external.accounts} withHandles />
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
                    ? `${PROVIDER_LABEL[emailFrom]} email hash`
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
            {config().roleSource === "discord" && role > 0 && (
              <Alert>
                Your {ROLES[role]} role comes from the Stellar Discord server.
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
          <CardFooter className="justify-between">
            <Button
              variant="ghost"
              disabled={progress !== null}
              onClick={() => goTo("profile")}
            >
              <ArrowLeftIcon /> Back
            </Button>
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
      )}
    </div>
  );
}
