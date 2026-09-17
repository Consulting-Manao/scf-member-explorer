import { BadgeCheckIcon, XIcon } from "lucide-react";

import {
  PROVIDER_HINT,
  PROVIDER_LABEL,
  ROLES,
} from "@stellar-membership/shared";

import { enabledProviders, forgetClaim, startOAuth } from "@/lib/oauth";
import { notify } from "@/lib/toast";
import { useClaims } from "@/queries/members";

import { ProviderIcon } from "./icons";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

export function VerifyAccounts({
  address,
  returnTo,
  showRole = false,
}: {
  address: string;
  returnTo: string;
  showRole?: boolean;
}) {
  const claims = useClaims(address);
  const providers = enabledProviders();

  return (
    <ul className="divide-y rounded-xl border">
      {providers.map((provider) => {
        const stored = claims.find((c) => c.claim.provider === provider);
        return (
          <li key={provider} className="flex items-center gap-4 p-4">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted">
              <ProviderIcon provider={provider} className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{PROVIDER_LABEL[provider]}</p>
              {stored ? (
                <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <BadgeCheckIcon className="size-4 text-success" />
                  {stored.claim.handle || stored.claim.id}
                  {showRole && stored.claim.role !== undefined && (
                    <Badge>{ROLES[stored.claim.role]}</Badge>
                  )}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {PROVIDER_HINT[provider]}
                </p>
              )}
            </div>
            {stored ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${PROVIDER_LABEL[provider]}`}
                onClick={() => forgetClaim(address, provider)}
              >
                <XIcon />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  startOAuth(provider, address, returnTo).catch((error) =>
                    notify.failure("Verification not started", error),
                  )
                }
              >
                Verify
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
