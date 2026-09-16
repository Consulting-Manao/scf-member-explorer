import { CheckIcon, LoaderCircleIcon } from "lucide-react";

import type { Step } from "@/lib/tx";
import { cn } from "@/lib/utils";

const LABELS: Record<Step, string> = {
  attest: "Attesting verified accounts",
  authorize: "Authorizing with the other account",
  sign: "Signing with your wallet",
  upload: "Uploading profile to IPFS",
  submit: "Submitting to Stellar",
};

export function TxProgress({
  steps,
  current,
}: {
  steps: Step[];
  current: Step | null;
}) {
  const index = current ? steps.indexOf(current) : -1;
  return (
    <ol className="space-y-2.5">
      {steps.map((step, i) => (
        <li
          key={step}
          className={cn(
            "flex items-center gap-3 text-sm",
            i > index && "text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full border",
              i < index && "border-success bg-success text-white",
              i === index && "border-foreground",
            )}
          >
            {i < index ? (
              <CheckIcon className="size-3.5" />
            ) : i === index ? (
              <LoaderCircleIcon className="size-3.5 animate-spin" />
            ) : (
              <span className="text-xs">{i + 1}</span>
            )}
          </span>
          {LABELS[step]}
        </li>
      ))}
    </ol>
  );
}
