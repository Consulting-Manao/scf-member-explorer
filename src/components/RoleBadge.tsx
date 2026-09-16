import { ROLES } from "@shared/membership";

import { cn } from "@/lib/utils";

const STYLES = [
  "bg-slate-500/12 text-slate-600 dark:text-slate-300",
  "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  "bg-violet-500/12 text-violet-700 dark:text-violet-300",
  "bg-amber-400/20 text-amber-700 dark:text-amber-300",
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
        STYLES[role] ?? STYLES[0],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {ROLES[role] ?? "Unknown"}
    </span>
  );
}
