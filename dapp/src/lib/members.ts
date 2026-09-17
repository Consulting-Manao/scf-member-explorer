import {
  PROVIDER_ID,
  providerName,
  type SocialAccount,
} from "@stellar-membership/shared";

import type { MemberView } from "./contract";

/** Display name: profile name, then GitHub or Discord handle. */
export function memberName(member: MemberView, profileName?: string): string {
  if (profileName) return profileName;
  const handle = (provider: number) =>
    member.accounts.find((a) => a.provider === provider)?.handle;
  return (
    handle(PROVIDER_ID.github) ||
    handle(PROVIDER_ID.discord) ||
    `Member #${member.tokenId}`
  );
}

export function accountUrl(account: SocialAccount): string {
  switch (providerName(account.provider)) {
    case "github":
      return `https://github.com/${account.handle}`;
    case "x":
      return `https://x.com/${account.handle}`;
    case "discord":
      return `https://discord.com/users/${account.id}`;
  }
}
