import { Address, scValToNative, xdr } from "@stellar/stellar-sdk";
import { TANSU_CONTRACT_ADDRESS } from "@/config/networks";
import { fetchMemberMeta, type MemberProfile } from "./ipfs";
import { simulate } from "./soroban";

function call(method: string, ...args: xdr.ScVal[]): Promise<xdr.ScVal> {
  return simulate(TANSU_CONTRACT_ADDRESS, method, ...args);
}

export async function getMember(ownerAddress: string): Promise<{ meta: string } | null> {
  try {
    const result = await call("get_member", new Address(ownerAddress).toScVal());
    const raw = scValToNative(result);
    if (!raw || typeof raw !== "object") return null;

    const meta =
      raw instanceof Map
        ? String(raw.get("meta") ?? "")
        : String((raw as Record<string, unknown>).meta ?? "");

    return meta ? { meta } : null;
  } catch {
    return null;
  }
}

export async function fetchMemberProfile(ownerAddress: string): Promise<MemberProfile | null> {
  try {
    const member = await getMember(ownerAddress);
    if (!member?.meta) return null;

    const profile = await fetchMemberMeta(member.meta);
    profile.cid = member.meta;
    return profile;
  } catch {
    return null;
  }
}
