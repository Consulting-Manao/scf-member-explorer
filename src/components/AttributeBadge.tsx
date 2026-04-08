interface AttributeBadgeProps {
  traitType: string;
  value: string | number;
}

export function AttributeBadge({ traitType, value }: AttributeBadgeProps) {
  return (
    <div className="flex flex-col gap-1 overflow-hidden rounded-lg border bg-muted/50 p-3">
      <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {traitType}
      </span>
      <span className="truncate text-sm font-medium text-foreground">
        {String(value)}
      </span>
    </div>
  );
}
