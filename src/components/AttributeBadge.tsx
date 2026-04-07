import { Badge } from "@/components/ui/badge";

interface AttributeBadgeProps {
  traitType: string;
  value: string | number;
}

export function AttributeBadge({ traitType, value }: AttributeBadgeProps) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-muted/50 p-3">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {traitType}
      </span>
      <span className="text-sm font-medium text-foreground">
        {String(value)}
      </span>
    </div>
  );
}
