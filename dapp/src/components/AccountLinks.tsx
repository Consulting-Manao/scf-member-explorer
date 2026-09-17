import { providerName, type SocialAccount } from "@stellar-membership/shared";

import { accountUrl } from "@/lib/members";
import { cn } from "@/lib/utils";

import { ProviderIcon } from "./icons";

export function AccountLinks({
  accounts,
  withHandles = false,
}: {
  accounts: SocialAccount[];
  withHandles?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {accounts.map((account) => {
        const provider = providerName(account.provider);
        const title = `${provider}: ${account.handle || account.id}`;
        return (
          <a
            key={provider}
            href={accountUrl(account)}
            target="_blank"
            rel="noreferrer"
            title={title}
            className={cn(
              "inline-flex items-center gap-1.5 text-muted-foreground transition hover:text-foreground",
              withHandles && "rounded-full bg-muted px-3 py-1 text-sm",
            )}
          >
            <ProviderIcon provider={provider} className="size-4" />
            {withHandles && <span>{account.handle || account.id}</span>}
          </a>
        );
      })}
    </div>
  );
}
