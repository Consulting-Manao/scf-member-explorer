import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const field =
  "bg-card placeholder:text-muted-foreground w-full rounded-lg border px-3.5 text-sm shadow-xs transition outline-none focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-3 disabled:opacity-50 aria-invalid:border-destructive dark:bg-muted/40";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(field, "h-10 py-2", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(field, "min-h-24 resize-y py-2.5", className)}
      {...props}
    />
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn("text-sm leading-none font-medium", className)}
      {...props}
    />
  );
}
