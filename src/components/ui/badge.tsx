import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-muted text-foreground border-transparent",
        outline: "text-muted-foreground",
        success:
          "border-transparent bg-success/20 text-success-foreground dark:bg-success/25 dark:text-success",
        warning:
          "border-transparent bg-warning/25 text-warning-foreground dark:bg-warning/25 dark:text-warning",
        destructive:
          "border-transparent bg-destructive/15 text-destructive dark:bg-destructive/25",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
