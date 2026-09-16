import { SearchIcon, XIcon } from "lucide-react";
import { useDeferredValue, useState } from "react";

import { cn } from "@/lib/utils";
import { useProjects } from "@/queries/members";

import { ProjectChip } from "./ProjectPicker";
import { Input } from "./ui/input";

/**
 * One box: the text filters the members, and the projects of PG Atlas
 * matching it are offered as a filter.
 */
export function MemberSearch({
  text,
  onText,
  project,
  onProject,
  className,
}: {
  text: string;
  onText: (text: string) => void;
  project: string | null;
  onProject: (id: string | null) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const deferred = useDeferredValue(text.trim());
  const projects = useProjects(deferred, deferred.length > 0);
  const suggestions = deferred ? (projects.data ?? []) : [];
  const listed = open && deferred.length > 0 && !project;

  const pick = (id: string) => {
    onProject(id);
    onText("");
    setOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={text}
        onChange={(e) => {
          onText(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!listed || suggestions.length === 0) {
            if (e.key === "Escape") onText("");
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(suggestions[active]!.id);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={
          project ? "Search within the project" : "Search members or projects"
        }
        aria-label="Search members or projects"
        aria-expanded={listed}
        className="pr-9 pl-9"
      />
      {text && (
        <button
          type="button"
          onClick={() => onText("")}
          aria-label="Clear"
          className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded-full p-1 text-muted-foreground hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
      {listed && (projects.isLoading || suggestions.length > 0) && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-max max-w-md min-w-full overflow-auto rounded-xl border bg-card p-1 shadow-lg"
        >
          {projects.isLoading && suggestions.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              Looking for projects…
            </li>
          )}
          {suggestions.map((item, i) => (
            <li key={item.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(item.id)}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm",
                  i === active && "bg-muted",
                )}
              >
                <span className="min-w-0">
                  <span className="text-muted-foreground">
                    Filter by project ·{" "}
                  </span>
                  <span className="font-medium">{item.name}</span>
                </span>
                {item.category && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {item.category}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ProjectFilterChip({
  id,
  onRemove,
}: {
  id: string;
  onRemove: () => void;
}) {
  return <ProjectChip id={id} onRemove={onRemove} />;
}
