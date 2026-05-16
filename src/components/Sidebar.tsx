import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { Folder, Home, Search } from "lucide-react";
import { useProjects } from "@/hooks/queries";
import { useStore } from "@/store";
import { cn, encodePath, formatNumber } from "@/lib/utils";
import { Skeleton } from "./ui";

export function Sidebar() {
  const { data: projects, isLoading } = useProjects();
  const { setQuery } = useStore();
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!projects) return [];
    const f = filter.trim().toLowerCase();
    if (!f) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(f) ||
        p.path.toLowerCase().includes(f)
    );
  }, [projects, filter]);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface">
      <div className="shrink-0 space-y-2 p-3">
        <NavLink
          to="/"
          end
          onClick={() => setQuery("")}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent/15 text-accent"
                : "text-foreground hover:bg-surface-2"
            )
          }
        >
          <Home size={16} />
          首页 · 概览
        </NavLink>
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="筛选文件夹…"
            className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-2 text-xs text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between px-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
        <span>文件夹</span>
        <span>{formatNumber(filtered.length)}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {isLoading ? (
          <div className="space-y-1.5 p-1">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-muted">
            没有匹配的文件夹
          </div>
        ) : (
          filtered.map((p) => (
            <NavLink
              key={p.path}
              to={`/project/${encodePath(p.path)}`}
              onClick={() => setQuery("")}
              className={({ isActive }) =>
                cn(
                  "block rounded-lg px-3 py-2 transition-colors",
                  isActive ? "bg-accent/15" : "hover:bg-surface-2"
                )
              }
            >
              <div className="flex items-center gap-2">
                <Folder size={14} className="shrink-0 text-muted" />
                <span className="truncate text-sm font-medium text-foreground">
                  {p.name}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 pl-6 text-[11px] text-muted">
                <span>{formatNumber(p.promptCount)} prompt</span>
                {p.hasConversations && <span>· {p.sessionCount} 会话</span>}
              </div>
            </NavLink>
          ))
        )}
      </div>
    </aside>
  );
}
