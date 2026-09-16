/**
 * Member profile stored on IPFS as a directory, compatible with Tansu:
 * `profile.json` and an optional `profile-image.<ext>`.
 */

import { api } from "./api";
import { config } from "./config";

export interface Profile {
  name: string;
  description: string;
  social: string;
  image?: string;
}

export interface ProfileInput {
  name: string;
  description: string;
  social: string;
  image?: File | null;
}

export const MAX_IMAGE_BYTES = 1024 * 1024;

export const EMPTY_PROFILE: ProfileInput = {
  name: "",
  description: "",
  social: "",
  image: null,
};

export function ipfsUrl(cid: string, path = ""): string {
  return `${config().ipfsGateway}${cid}${path}`;
}

export function isEmptyProfile(input: ProfileInput): boolean {
  return (
    !input.name.trim() &&
    !input.description.trim() &&
    !input.social.trim() &&
    !input.image
  );
}

export function profileFiles(input: ProfileInput): File[] {
  const profile: Profile = {
    name: input.name.trim(),
    description: input.description.trim(),
    social: input.social.trim(),
  };
  const files: File[] = [];
  if (input.image) {
    const ext = input.image.type.split("/")[1] ?? "png";
    profile.image = `profile-image.${ext}`;
    files.push(
      new File([input.image], profile.image, { type: input.image.type }),
    );
  }
  files.unshift(
    new File([JSON.stringify(profile)], "profile.json", {
      type: "application/json",
    }),
  );
  return files;
}

/** Pack files in a CAR, the root CID is known before uploading. */
export async function packCar(
  files: File[],
): Promise<{ cid: string; car: Uint8Array }> {
  const { createDirectoryEncoderStream, CAREncoderStream } =
    await import("ipfs-car");

  const blocks: { cid: { toString(): string } }[] = [];
  await createDirectoryEncoderStream(files).pipeTo(
    new WritableStream({
      write(block) {
        blocks.push(block);
      },
    }),
  );
  const root = blocks.at(-1);
  if (!root) throw new Error("Empty profile");

  const chunks: Uint8Array[] = [];
  await new ReadableStream({
    pull(controller) {
      const block = blocks.shift();
      if (block) controller.enqueue(block);
      else controller.close();
    },
  })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .pipeThrough(new CAREncoderStream([root.cid as any]))
    .pipeTo(
      new WritableStream({
        write(chunk) {
          chunks.push(chunk);
        },
      }),
    );

  const car = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    car.set(chunk, offset);
    offset += chunk.length;
  }
  return { cid: root.cid.toString(), car };
}

export async function uploadCar(
  cid: string,
  car: Uint8Array,
  signedTxXdr: string,
): Promise<void> {
  let binary = "";
  for (let i = 0; i < car.length; i += 8192) {
    binary += String.fromCharCode(...car.subarray(i, i + 8192));
  }
  const { cid: stored } = await api.upload({
    cid,
    signedTxXdr,
    car: btoa(binary),
  });
  if (stored !== cid) throw new Error("IPFS upload returned another CID");
}

export async function fetchProfile(cid: string): Promise<Profile | null> {
  const res = await fetch(ipfsUrl(cid, "/profile.json"));
  if (!res.ok) return null;
  const data = (await res.json()) as Partial<Profile>;
  return {
    name: String(data.name ?? ""),
    description: String(data.description ?? ""),
    social: String(data.social ?? ""),
    image: data.image ? ipfsUrl(cid, `/${data.image}`) : undefined,
  };
}
