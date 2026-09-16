import { ShieldAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { useNow } from "@/hooks/useNow";
import type { Recovery } from "@/lib/contract";
import { membershipClient } from "@/lib/contract";
import { execute } from "@/lib/tx";
import { errorMessage, formatDuration, shortAddress } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";
import { useInvalidateMembers } from "@/queries/members";

import { Alert } from "./ui/alert";
import { Button } from "./ui/button";

/** Pending recovery, with a cancel action for the owner or the admin. */
export function RecoveryBanner({
  tokenId,
  recovery,
  canCancel,
}: {
  tokenId: number;
  recovery: Recovery;
  canCancel: boolean;
}) {
  const { address, signTransaction } = useWallet();
  const invalidate = useInvalidateMembers();
  const now = useNow();
  const remaining = Math.floor((recovery.executableAt.getTime() - now) / 1000);

  const cancel = async () => {
    if (!address) return;
    try {
      const tx = await membershipClient(address).cancel_recovery({
        caller: address,
        token_id: tokenId,
      });
      await execute(tx, { signTransaction });
      toast.success("Recovery cancelled");
      await invalidate();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <Alert variant="warning" className="items-start">
      <ShieldAlertIcon />
      <div className="flex-1 space-y-1">
        <p className="font-medium">Someone is recovering this membership</p>
        <p className="text-muted-foreground">
          This membership moves to{" "}
          <span className="font-mono">
            {shortAddress(recovery.newAddress, 6)}
          </span>{" "}
          {remaining > 0 ? `in ${formatDuration(remaining)}` : "any moment now"}
          . If that is not you, cancel it now.
        </p>
      </div>
      {canCancel && (
        <Button variant="destructive" size="sm" onClick={cancel}>
          Cancel recovery
        </Button>
      )}
    </Alert>
  );
}
