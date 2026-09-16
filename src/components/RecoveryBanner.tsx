import { ShieldAlertIcon, ShieldOffIcon } from "lucide-react";

import { useRemaining } from "@/hooks/useNow";
import { useTxAction } from "@/hooks/useTxAction";
import type { MemberView, Recovery } from "@/lib/contract";
import { membershipClient } from "@/lib/contract";
import { notify } from "@/lib/toast";
import { formatDuration, shortAddress } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";

import { AddressFact, ConfirmDialog, Facts, MemberFact } from "./ConfirmDialog";
import { Alert } from "./ui/alert";
import { Button } from "./ui/button";

/** Pending recovery, with a cancel action for the owner or the admin. */
export function RecoveryBanner({
  member,
  recovery,
  canCancel,
}: {
  member: MemberView;
  recovery: Recovery;
  canCancel: boolean;
}) {
  const { address } = useWallet();
  const { perform } = useTxAction();
  const remaining = useRemaining(recovery.executableAt);

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
      {canCancel && address && (
        <ConfirmDialog
          trigger={
            <Button variant="destructive" size="sm">
              Cancel recovery
            </Button>
          }
          tone="destructive"
          icon={<ShieldOffIcon />}
          title="Cancel this recovery?"
          description="Your membership stays with this key. Whoever asked for the recovery will have to prove your accounts again."
          actionLabel="Cancel recovery"
          cancelLabel="Keep it"
          onConfirm={async (onStep) => {
            const tx = await perform(
              await membershipClient(address).cancel_recovery({
                caller: address,
                token_id: member.tokenId,
              }),
              { touched: [member.tokenId], onStep },
            );
            notify.success("Recovery cancelled", { tx });
          }}
        >
          <Facts>
            <MemberFact member={member} />
            <AddressFact from={member.owner} to={recovery.newAddress} />
          </Facts>
        </ConfirmDialog>
      )}
    </Alert>
  );
}
