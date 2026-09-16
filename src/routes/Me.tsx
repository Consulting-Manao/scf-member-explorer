import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Buffer } from "buffer";
import { ExternalLinkIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  fromHex,
  PROVIDER_ID,
  PROVIDER_LABEL,
  providerName,
  type SocialAccount,
} from "@shared/membership";

import { AccountLinks } from "@/components/AccountLinks";
import { ProviderIcon } from "@/components/icons";
import { KeyHandover } from "@/components/KeyHandover";
import { MemberAvatar } from "@/components/MemberAvatar";
import { ProfileForm } from "@/components/ProfileForm";
import { ProjectPicker } from "@/components/ProjectPicker";
import { RecoveryBanner } from "@/components/RecoveryBanner";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { membershipClient, type MemberView } from "@/lib/contract";
import {
  EMPTY_PROFILE,
  isEmptyProfile,
  packCar,
  profileFiles,
  uploadCar,
  type Profile,
  type ProfileInput,
} from "@/lib/ipfs";
import { memberName } from "@/lib/members";
import { execute, type Step } from "@/lib/tx";
import { cn, errorMessage } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";
import { type MeTab } from "@/routes/search";
import {
  useClaims,
  useInvalidateMembers,
  useMyMembership,
  useProfile,
  useRecovery,
} from "@/queries/members";

async function imageFile(url: string): Promise<File | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const blob = await res.blob();
  return new File([blob], url.split("/").at(-1) ?? "profile-image", {
    type: blob.type,
  });
}

function ProfileTab({ member }: { member: MemberView }) {
  const { data: profile, isLoading } = useProfile(member.bio || undefined);
  if (isLoading) return <Skeleton className="h-96" />;
  return <ProfileEditor key={member.bio} member={member} profile={profile} />;
}

function ProfileEditor({
  member,
  profile,
}: {
  member: MemberView;
  profile: Profile | null | undefined;
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
        toast.info("Nothing changed");
        return;
      }
      const tx = await membershipClient(address).set_bio({
        caller: address,
        token_id: member.tokenId,
        bio,
      });
      await execute(tx, {
        signTransaction,
        beforeSubmit: car ? (signed) => uploadCar(bio, car, signed) : undefined,
        onStep: setProgress,
      });
      toast.success("Profile updated");
      await invalidate();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setProgress(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          Published on IPFS, referenced on-chain.
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

function ProjectsTab({ member }: { member: MemberView }) {
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
      await execute(tx, { signTransaction });
      toast.success("Projects updated");
      await invalidate();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const changed = projects.join() !== member.projects.join();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Projects</CardTitle>
        <CardDescription>
          Projects are identified with DAOIP-5 ids from PG Atlas.
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

function AccountsTab({ member }: { member: MemberView }) {
  const { address, signTransaction } = useWallet();
  const invalidate = useInvalidateMembers();
  const claims = useClaims(address);
  const [removed, setRemoved] = useState<number[]>([]);
  const [email, setEmail] = useState<"keep" | "none" | string>("keep");
  const [progress, setProgress] = useState<Step | null>(null);

  const merged = new Map<number, SocialAccount>(
    member.accounts.map((account) => [account.provider, account]),
  );
  for (const { claim } of claims) {
    merged.set(PROVIDER_ID[claim.provider], {
      provider: PROVIDER_ID[claim.provider],
      id: claim.id,
      handle: claim.handle,
    });
  }
  const accounts = [...merged.values()]
    .filter((account) => !removed.includes(account.provider))
    .sort((a, b) => a.provider - b.provider);

  const emailClaims = claims.filter((c) => c.claim.emailHash);
  const emailHash =
    email === "keep"
      ? member.emailHash
      : email === "none"
        ? null
        : (emailClaims.find((c) => c.claim.provider === email)?.claim
            .emailHash ?? null);

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
      await execute(tx, {
        signTransaction,
        claims: claims.map((c) => c.token),
        onStep: setProgress,
      });
      toast.success("Accounts updated");
      setRemoved([]);
      await invalidate();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setProgress(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verified accounts</CardTitle>
        <CardDescription>
          Changes are co-signed by the attester: verify at least one account in
          this session to save them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ul className="divide-y rounded-xl border">
          {accounts.map((account) => {
            const provider = providerName(account.provider);
            return (
              <li key={provider} className="flex items-center gap-3 p-3">
                <ProviderIcon provider={provider} className="size-4" />
                <span className="flex-1 text-sm">
                  {PROVIDER_LABEL[provider]} · {account.handle || account.id}
                </span>
                {provider !== "discord" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${PROVIDER_LABEL[provider]}`}
                    onClick={() => setRemoved([...removed, account.provider])}
                  >
                    <TrashIcon />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        {address && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Verify again or add</h4>
            <VerifyAccounts
              address={address}
              providers={["discord", "github", "x"]}
              returnTo="/me?tab=accounts"
            />
          </div>
        )}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Email hash</legend>
          <div className="flex flex-wrap gap-2">
            {[
              ["keep", member.emailHash ? "Keep current" : "Keep none"],
              ["none", "Remove"],
              ...emailClaims.map((c) => [
                c.claim.provider,
                `${PROVIDER_LABEL[c.claim.provider]} email`,
              ]),
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setEmail(value!)}
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1 text-sm",
                  email === value
                    ? "border-foreground bg-foreground text-background"
                    : "hover:bg-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        {progress && (
          <TxProgress steps={["attest", "sign", "submit"]} current={progress} />
        )}
      </CardContent>
      <CardFooter className="justify-end">
        <Button
          disabled={claims.length === 0 || progress !== null}
          onClick={save}
        >
          Save accounts
        </Button>
      </CardFooter>
    </Card>
  );
}

function KeyTab({ member }: { member: MemberView }) {
  const navigate = useNavigate();
  const invalidate = useInvalidateMembers();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rotate key</CardTitle>
        <CardDescription>
          Move your membership to another account. Your member id, role,
          accounts and history stay the same.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <KeyHandover
          actionLabel="Rotate"
          build={(newAddress) =>
            membershipClient(newAddress).rotate_key({
              token_id: member.tokenId,
              new_address: newAddress,
            })
          }
          onDone={async () => {
            await invalidate();
            navigate({
              to: "/members/$tokenId",
              params: { tokenId: String(member.tokenId) },
            });
          }}
        />
      </CardContent>
    </Card>
  );
}

export function Me() {
  const { tab } = useSearch({ from: "/me" });
  const navigate = useNavigate({ from: "/me" });
  const { address, connect } = useWallet();
  const { tokenId, member, isLoading } = useMyMembership();
  const { data: profile } = useProfile(member?.bio || undefined);
  const { data: recovery } = useRecovery(tokenId);

  if (!address) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-3xl font-semibold">My membership</h1>
        <p className="mt-3 text-muted-foreground">
          Connect the account holding your membership.
        </p>
        <Button
          className="mt-8"
          onClick={() => connect().catch((e) => toast.error(errorMessage(e)))}
        >
          Connect wallet
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-12 sm:px-6">
        <Skeleton className="h-24" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-3xl font-semibold">
          No membership on this account
        </h1>
        <p className="mt-3 text-muted-foreground">
          Join the community, or recover a membership if you lost your key.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild>
            <Link to="/join">Join</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/recover">Recover</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
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
            <ExternalLinkIcon /> Public profile
          </Link>
        </Button>
      </div>

      {recovery && tokenId !== null && (
        <RecoveryBanner tokenId={tokenId} recovery={recovery} canCancel />
      )}
      {member.revoked && (
        <Alert variant="destructive">This membership has been revoked.</Alert>
      )}

      <Tabs
        value={tab}
        onValueChange={(value) => navigate({ search: { tab: value as MeTab } })}
      >
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="key">Key</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <ProfileTab member={member} />
        </TabsContent>
        <TabsContent value="projects">
          <ProjectsTab key={member.projects.join()} member={member} />
        </TabsContent>
        <TabsContent value="accounts">
          <AccountsTab member={member} />
        </TabsContent>
        <TabsContent value="key">
          <KeyTab member={member} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
