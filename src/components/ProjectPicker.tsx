import { CheckIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { useDeferredValue, useState } from "react";

import { MAX_PROJECTS } from "@shared/membership";

import { cn } from "@/lib/utils";
import { useProject, useProjects } from "@/queries/members";

import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Skeleton } from "./ui/skeleton";

function ProjectChip({ id, onRemove }: { id: string; onRemove?: () => void }) {
  const { data } = useProject(id);
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted py-1 pr-1.5 pl-3 text-sm">
      <span className="truncate">{data?.name ?? id.split(":").at(-1)}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="cursor-pointer rounded-full p-0.5 hover:bg-background"
          aria-label="Remove project"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </span>
  );
}

export function ProjectList({ ids }: { ids: string[] }) {
  if (ids.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No project listed yet.</p>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {ids.map((id) => (
        <a
          key={id}
          href={`https://www.pgatlas.xyz/projects/${encodeURIComponent(id)}`}
          target="_blank"
          rel="noreferrer"
          className="max-w-full"
        >
          <ProjectChip id={id} />
        </a>
      ))}
    </div>
  );
}

export function ProjectPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search);
  const { data: projects, isLoading } = useProjects(deferred);
  const full = value.length >= MAX_PROJECTS;

  const toggle = (id: string) =>
    onChange(
      value.includes(id)
        ? value.filter((selected) => selected !== id)
        : full
          ? value
          : [...value, id],
    );

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((id) => (
            <ProjectChip key={id} id={id} onRemove={() => toggle(id)} />
          ))}
        </div>
      )}
      <div className="relative">
        <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search Stellar projects"
          className="pl-9"
        />
      </div>
      <div className="max-h-64 overflow-y-auto rounded-xl border">
        {isLoading && (
          <div className="space-y-2 p-3">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        )}
        {projects?.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            No project matches.
          </p>
        )}
        <ul className="divide-y">
          {projects?.map((project) => {
            const selected = value.includes(project.id);
            return (
              <li key={project.id}>
                <button
                  type="button"
                  disabled={!selected && full}
                  onClick={() => toggle(project.id)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
                    selected && "bg-muted/60",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {project.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {project.id}
                    </span>
                  </span>
                  {project.category && (
                    <Badge variant="outline" className="hidden sm:inline-flex">
                      {project.category}
                    </Badge>
                  )}
                  {selected ? (
                    <CheckIcon className="size-4 text-success" />
                  ) : (
                    <PlusIcon className="size-4 text-muted-foreground" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="text-xs text-muted-foreground">
        {value.length}/{MAX_PROJECTS} projects, from PG Atlas.
      </p>
    </div>
  );
}
