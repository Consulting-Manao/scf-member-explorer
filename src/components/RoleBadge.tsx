import { ROLES } from "@shared/membership";

import { cn } from "@/lib/utils";

const STYLES = [
  "bg-slate-500/15 text-slate-700 dark:bg-slate-300/20 dark:text-slate-200",
  "bg-sky-500/15 text-sky-800 dark:bg-sky-300/20 dark:text-sky-200",
  "bg-violet-500/15 text-violet-800 dark:bg-violet-300/20 dark:text-violet-200",
  "bg-amber-400/25 text-amber-800 dark:bg-amber-300/20 dark:text-amber-200",
];

export function RoleBadge({
  role,
  className,
}: {
  role: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        STYLES[role]!,
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {ROLES[role]!}
    </span>
  );
}
