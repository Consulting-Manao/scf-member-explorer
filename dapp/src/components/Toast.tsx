import {
  AlertCircleIcon,
  CheckIcon,
  ExternalLinkIcon,
  InfoIcon,
  LoaderCircleIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { Button } from "./ui/button";

export type ToastTone = "success" | "failure" | "info" | "progress";

export interface ToastProps {
  tone: ToastTone;
  title: string;
  detail?: string;
  /** Link shown after the detail. */
  link?: { href: string; label: string };
  /** Raw error, shown on demand. */
  raw?: string;
  action?: { label: string; onClick: () => void };
  onDismiss?: () => void;
}

const DISC: Record<ToastTone, string> = {
  success: "bg-success/20 text-success-foreground dark:text-success",
  failure: "bg-destructive/15 text-destructive dark:bg-destructive/25",
  info: "bg-muted text-foreground",
  progress: "bg-muted text-foreground",
};

export function Toast({
  tone,
  title,
  detail,
  link,
  raw,
  action,
  onDismiss,
}: ToastProps) {
  const [showRaw, setShowRaw] = useState(false);
  return (
    <div
      className={cn(
        "flex w-90 max-w-[calc(100vw-2rem)] items-start gap-3 rounded-2xl border bg-card p-3.5 text-card-foreground shadow-lg",
        tone === "failure" && "border-destructive/50",
      )}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          DISC[tone],
        )}
      >
        {tone === "success" && <CheckIcon className="size-4" />}
        {tone === "failure" && <AlertCircleIcon className="size-4" />}
        {tone === "info" && <InfoIcon className="size-4" />}
        {tone === "progress" && (
          <LoaderCircleIcon className="size-4 animate-spin" />
        )}
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        {(detail || link) && (
          <p className="text-xs text-muted-foreground">
            {detail}
            {detail && link && " · "}
            {link && (
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
              >
                {link.label}
                <ExternalLinkIcon className="size-3" />
              </a>
            )}
          </p>
        )}
        {(action || raw) && (
          <div className="flex gap-1.5 pt-2">
            {action && (
              <Button size="sm" onClick={action.onClick}>
                {action.label}
              </Button>
            )}
            {raw && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowRaw((v) => !v)}
              >
                Details
              </Button>
            )}
          </div>
        )}
        {showRaw && (
          <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-muted p-2 font-mono text-[11px] leading-snug wrap-break-word whitespace-pre-wrap">
            {raw}
          </pre>
        )}
      </div>
      {onDismiss && tone !== "progress" && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="cursor-pointer rounded-full p-1 text-muted-foreground hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}
