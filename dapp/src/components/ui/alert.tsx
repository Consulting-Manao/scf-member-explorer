import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "flex gap-3 rounded-xl border p-4 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-muted/70",
        warning:
          "border-warning/50 bg-warning/15 dark:bg-warning/20 [&>svg]:text-warning",
        destructive:
          "border-destructive/50 bg-destructive/10 dark:bg-destructive/20 [&>svg]:text-destructive",
        success:
          "border-success/50 bg-success/15 dark:bg-success/20 [&>svg]:text-success",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Alert({
  className,
  variant,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}
