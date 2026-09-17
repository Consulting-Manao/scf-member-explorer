import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/** A toggle in a row of choices. */
export function Pill({
  selected,
  className,
  ...props
}: ComponentProps<"button"> & { selected: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition",
        selected
          ? "border-foreground bg-foreground text-background"
          : "hover:bg-muted",
        className,
      )}
      {...props}
    />
  );
}
