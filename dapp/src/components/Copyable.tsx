import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";

import { notify } from "@/lib/toast";
import { cn, shortAddress } from "@/lib/utils";

export function Copyable({
  value,
  short = true,
  className,
}: {
  value: string;
  short?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          .writeText(value)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch((error: unknown) => notify.failure("Nothing copied", error));
      }}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 font-mono text-sm text-muted-foreground transition hover:text-foreground",
        className,
      )}
      title={value}
    >
      {short ? shortAddress(value, 6) : value}
      {copied ? (
        <CheckIcon className="size-3.5 text-success" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
    </button>
  );
}
