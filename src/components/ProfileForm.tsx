import { ImagePlusIcon, XIcon } from "lucide-react";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";

import { MAX_IMAGE_BYTES, type ProfileInput } from "@/lib/ipfs";

import { Button } from "./ui/button";
import { Input, Label, Textarea } from "./ui/input";

export function ProfileForm({
  value,
  onChange,
  currentImage,
  onClearCurrentImage,
}: {
  value: ProfileInput;
  onChange: (value: ProfileInput) => void;
  /** Picture already published, kept unless replaced or cleared. */
  currentImage?: string;
  onClearCurrentImage?: () => void;
}) {
  const upload = useMemo(
    () => (value.image ? URL.createObjectURL(value.image) : undefined),
    [value.image],
  );
  useEffect(
    () => () => {
      if (upload) URL.revokeObjectURL(upload);
    },
    [upload],
  );
  const preview = upload ?? currentImage;

  const set = (patch: Partial<ProfileInput>) =>
    onChange({ ...value, ...patch });

  return (
    <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
      <div className="flex flex-col items-center gap-2">
        <label className="group relative flex size-28 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed bg-muted hover:bg-muted/70">
          {preview ? (
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlusIcon className="size-6 text-muted-foreground" />
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > MAX_IMAGE_BYTES) {
                toast.error("Pick a picture under 1 MB.");
                return;
              }
              set({ image: file });
            }}
          />
        </label>
        {(value.image || (currentImage && onClearCurrentImage)) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              value.image ? set({ image: null }) : onClearCurrentImage?.()
            }
          >
            <XIcon /> Remove
          </Button>
        )}
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="profile-name">Name</Label>
          <Input
            id="profile-name"
            value={value.name}
            maxLength={80}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="The name people know you by"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-description">Bio</Label>
          <Textarea
            id="profile-description"
            value={value.description}
            maxLength={500}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="What you build, maintain or care about on Stellar"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-social">Website</Label>
          <Input
            id="profile-social"
            type="url"
            value={value.social}
            onChange={(e) => set({ social: e.target.value })}
            placeholder="https://"
          />
        </div>
      </div>
    </div>
  );
}
