import { useState } from "react";

import { ProfileForm } from "@/components/ProfileForm";
import { TxProgress } from "@/components/TxProgress";
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
import { useTxAction } from "@/hooks/useTxAction";
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
import { notify } from "@/lib/toast";
import { useProfile } from "@/queries/members";

interface Props {
  member: MemberView;
  address: string;
}

export function ProfileSection({ member, address }: Props) {
  const { data: profile, isLoading } = useProfile(member.bio || undefined);
  if (isLoading) return <Skeleton className="h-96" />;
  return (
    <ProfileEditor
      key={member.bio}
      member={member}
      address={address}
      profile={profile}
    />
  );
}

async function imageFile(url: string): Promise<File | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const blob = await res.blob();
  return new File([blob], url.split("/").at(-1) ?? "profile-image", {
    type: blob.type,
  });
}

function ProfileEditor({
  member,
  address,
  profile,
}: Props & { profile: Profile | null | undefined }) {
  const { step, busy, run } = useTxAction();
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
  const currentImage = keepImage ? profile?.image : undefined;

  const save = async () => {
    // the directory CID covers the picture too, so a kept one is repacked
    let files = input;
    if (!input.image && currentImage) {
      files = { ...input, image: await imageFile(currentImage) };
    }
    let bio = "";
    let car: Uint8Array | undefined;
    if (!isEmptyProfile(files)) {
      ({ cid: bio, car } = await packCar(profileFiles(files)));
    }
    if (bio === member.bio) {
      notify.info("Nothing changed");
      return;
    }
    await run(
      () =>
        membershipClient(address).set_bio({
          caller: address,
          token_id: member.tokenId,
          bio,
        }),
      {
        beforeSubmit: car ? (signed) => uploadCar(bio, car, signed) : undefined,
        touched: [member.tokenId],
        done: "Profile updated",
        failed: "Profile not updated",
      },
    );
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
        {step && (
          <TxProgress steps={["sign", "upload", "submit"]} current={step} />
        )}
      </CardContent>
      <CardFooter className="justify-end">
        <Button disabled={busy} onClick={save}>
          Save profile
        </Button>
      </CardFooter>
    </Card>
  );
}
