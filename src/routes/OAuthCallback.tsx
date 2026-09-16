import { useNavigate, useParams } from "@tanstack/react-router";
import { LoaderCircleIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  PROVIDER_LABEL,
  PROVIDERS,
  type ProviderName,
} from "@shared/membership";

import { Button } from "@/components/ui/button";
import { completeOAuth } from "@/lib/oauth";
import { errorMessage } from "@/lib/utils";

export function OAuthCallback() {
  const { provider } = useParams({ from: "/oauth/callback/$provider" });
  const navigate = useNavigate();
  const known = PROVIDERS.includes(provider as ProviderName);
  const [failure, setFailure] = useState<string | null>(null);
  const error = known ? failure : "Unknown provider";
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !known) return;
    started.current = true;
    const name = provider as ProviderName;
    completeOAuth(name, new URLSearchParams(window.location.search))
      .then(({ claim, returnTo }) => {
        toast.success(`${PROVIDER_LABEL[name]} verified as ${claim.handle}`);
        navigate({ href: returnTo, replace: true });
      })
      .catch((e) => setFailure(errorMessage(e)));
  }, [known, provider, navigate]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      {error ? (
        <>
          <h1 className="text-2xl font-semibold">Verification failed</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => window.history.go(-2)}>Go back</Button>
        </>
      ) : (
        <>
          <LoaderCircleIcon className="size-8 animate-spin" />
          <p className="text-muted-foreground">Verifying your account…</p>
        </>
      )}
    </div>
  );
}
