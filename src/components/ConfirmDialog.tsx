import { ArrowRightIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { ROLES } from "@shared/membership";

import type { MemberView } from "@/lib/contract";
import type { Step } from "@/lib/tx";
import { cn, errorMessage, isCancelled, shortAddress } from "@/lib/utils";
import { useMemberName } from "@/queries/members";

import { MemberAvatar } from "./MemberAvatar";
import { TxProgress } from "./TxProgress";
import { Alert } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

export type ConfirmTone = "destructive" | "warning" | "default";

const DISC: Record<ConfirmTone, string> = {
  destructive: "bg-destructive/15 text-destructive dark:bg-destructive/25",
  warning: "bg-warning/25 text-warning-foreground dark:text-warning",
  default:
    "bg-accent/40 text-accent-foreground dark:bg-accent/25 dark:text-accent",
};

/** Every confirmed action is a plain signed call. */
const STEPS: Step[] = ["sign", "submit"];

const ACTION: Record<ConfirmTone, "destructive" | "accent" | "default"> = {
  destructive: "destructive",
  warning: "accent",
  default: "default",
};

/**
 * Confirmation of an irreversible action. Stays open while the transaction
 * runs, shows its steps, closes on success, keeps the error inline.
 */
export function ConfirmDialog({
  trigger,
  tone = "default",
  icon,
  title,
  description,
  children,
  actionLabel,
  cancelLabel = "Cancel",
  onConfirm,
}: {
  trigger: ReactNode;
  tone?: ConfirmTone;
  icon: ReactNode;
  title: string;
  description: string;
  /** The facts block. */
  children?: ReactNode;
  actionLabel: string;
  cancelLabel?: string;
  /** Runs the action; a thrown error is shown in the dialog. */
  onConfirm: (onStep: (step: Step) => void) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = step !== null;

  const confirm = async () => {
    setError(null);
    setStep("sign");
    try {
      await onConfirm(setStep);
      setOpen(false);
    } catch (e) {
      setError(isCancelled(e) ? null : errorMessage(e));
    } finally {
      setStep(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent hideClose={busy}>
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-full [&_svg]:size-5",
            DISC[tone],
          )}
        >
          {icon}
        </div>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        {busy && <TxProgress steps={STEPS} current={step} />}
        {error && <Alert variant="destructive">{error}</Alert>}
        <DialogFooter>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            {cancelLabel}
          </Button>
          <Button variant={ACTION[tone]} disabled={busy} onClick={confirm}>
            {busy ? `${actionLabel}…` : actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Who and what is affected. */
export function Facts({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-2 rounded-xl border bg-muted/60 px-3 py-2.5 text-sm">
      {children}
    </div>
  );
}

export function MemberFact({
  member,
  badge,
}: {
  member: MemberView;
  badge?: { label: string; variant?: "destructive" | "warning" | "default" };
}) {
  const { name } = useMemberName(member);
  return (
    <div className="flex items-center gap-2.5">
      <MemberAvatar member={member} className="size-8 text-xs ring-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">
          Member #{member.tokenId} ·{" "}
          {member.revoked ? "Revoked" : ROLES[member.role]}
        </p>
      </div>
      {badge && (
        <Badge variant={badge.variant ?? "default"}>{badge.label}</Badge>
      )}
    </div>
  );
}

export function AddressFact({
  from,
  to,
  label,
}: {
  from?: string | null;
  to: string;
  label?: string;
}) {
  return (
    <p className="flex flex-wrap items-center gap-1.5 font-mono text-xs text-muted-foreground">
      {label && <span className="font-sans">{label}</span>}
      {from && (
        <>
          <span title={from}>{shortAddress(from, 5)}</span>
          <ArrowRightIcon className="size-3" />
        </>
      )}
      <span className="text-foreground" title={to}>
        {shortAddress(to, 5)}
      </span>
    </p>
  );
}
