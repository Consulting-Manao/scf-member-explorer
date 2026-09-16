import { SearchIcon, XIcon } from "lucide-react";
import { useDeferredValue, useState } from "react";

import { cn } from "@/lib/utils";
import { useProjects } from "@/queries/members";

import { ProjectChip } from "./ProjectPicker";
import { Input } from "./ui/input";

/** Pick one project from PG Atlas. */
export function ProjectFilter({
  value,
  onChange,
  className,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  className?: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const deferred = useDeferredValue(search.trim());
  const projects = useProjects(deferred, deferred.length > 0);

  if (value) {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <ProjectChip id={value} onRemove={() => onChange(null)} />
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Filter by project"
        className="pl-9"
        aria-label="Filter by project"
      />
      {open && deferred && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border bg-card p-1 shadow-lg">
          {projects.isLoading && (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              Searching…
            </li>
          )}
          {projects.data?.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              No project matches.
            </li>
          )}
          {projects.data?.map((project) => (
            <li key={project.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(project.id);
                  setSearch("");
                  setOpen(false);
                }}
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="truncate">{project.name}</span>
                {project.category && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {project.category}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {value === null && search && (
        <button
          type="button"
          onClick={() => setSearch("")}
          aria-label="Clear"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}
