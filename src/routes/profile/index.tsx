import { useSearch } from "@tanstack/react-router";
import { WalletIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { notify } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";
import { useMyMembership } from "@/queries/members";

import { MemberProfile } from "./MemberProfile";
import { Onboarding } from "./Onboarding";
import { Recovery } from "./Recovery";

/** Onboarding, recovery or management, depending on the connected wallet. */
export function Profile() {
  const { address, connect } = useWallet();
  const { mode } = useSearch({ from: "/profile" });
  const { tokenId, member, isLoading } = useMyMembership();

  if (!address) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
              <WalletIcon className="size-5" />
            </div>
            <CardTitle className="text-2xl">Your membership</CardTitle>
            <CardDescription>
              Connect your Stellar wallet to claim your membership or manage it.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center pt-6">
            <Button
              size="lg"
              onClick={() =>
                connect().catch((e) => notify.failure("Not connected", e))
              }
            >
              Connect wallet
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-12 sm:px-6">
        <Skeleton className="h-24" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (member && tokenId !== null) {
    return <MemberProfile member={member} tokenId={tokenId} />;
  }
  if (mode === "recover") return <Recovery address={address} />;
  return <Onboarding address={address} />;
}
