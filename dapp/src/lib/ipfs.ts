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

/** CIDv0 and the base32 CIDv1 that `packCar` produces. */
const CID = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{58,})$/;

/**
 * Gateway address of a profile, `null` for anything that is not a CID: the
 * bio is a free string on-chain and ends up in this URL.
 */
export function ipfsUrl(cid: string, path = ""): string | null {
  if (!CID.test(cid)) return null;
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
  const url = ipfsUrl(cid, "/profile.json");
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as Partial<Profile>;
  const image = data.image ? `${data.image}` : "";
  return {
    name: String(data.name ?? ""),
    description: String(data.description ?? ""),
    social: String(data.social ?? ""),
    // the profile is a directory, so its picture is a plain file name
    image: /^[\w.-]+$/.test(image)
      ? (ipfsUrl(cid, `/${image}`) ?? undefined)
      : undefined,
  };
}
