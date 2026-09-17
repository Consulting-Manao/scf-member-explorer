/** Upload and read the profiles packed by `./profile`. */

import { api } from "./api";
import { config } from "./config";
import type { Profile } from "./profile";

export {
  EMPTY_PROFILE,
  isEmptyProfile,
  packCar,
  profileFiles,
  type Profile,
  type ProfileInput,
} from "./profile";

export const MAX_IMAGE_BYTES = 1024 * 1024;

export function ipfsUrl(cid: string, path = ""): string {
  return `${config().ipfsGateway}${cid}${path}`;
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
