import { BadgeCheckIcon, XIcon as RemoveIcon } from "lucide-react";
import { toast } from "sonner";

import { PROVIDER_LABEL, ROLES, type ProviderName } from "@shared/membership";

import { forgetClaim, isProviderEnabled, startOAuth } from "@/lib/oauth";
import { errorMessage } from "@/lib/utils";
import { useClaims } from "@/queries/members";

import { ProviderIcon } from "./icons";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

const HINTS: Record<ProviderName, string> = {
  discord: "Required. You must be on the Stellar Discord server.",
  github: "Links your contributions.",
  x: "Optional.",
};

export function VerifyAccounts({
  address,
  providers,
  returnTo,
  showRole = false,
  hints = HINTS,
}: {
  address: string;
  providers: ProviderName[];
  returnTo: string;
  showRole?: boolean;
  hints?: Partial<Record<ProviderName, string>>;
}) {
  const claims = useClaims(address);

  return (
    <ul className="divide-y rounded-xl border">
      {providers.map((provider) => {
        const stored = claims.find((c) => c.claim.provider === provider);
        const enabled = isProviderEnabled(provider);
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
                  {enabled ? hints[provider] : "Not available yet."}
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
                <RemoveIcon />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={!enabled}
                onClick={() =>
                  startOAuth(provider, address, returnTo).catch((error) =>
                    toast.error(errorMessage(error)),
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
