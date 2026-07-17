import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { Download, Folder, Home, Search, X } from "lucide-react";
import { useProjects } from "@/hooks/queries";
import { useStore } from "@/store";
import { useT } from "@/i18n";
import { cn, encodePath, formatNumber } from "@/lib/utils";
import { Skeleton } from "./ui";
import { AgentBadge, AgentFilterControl } from "./AgentBadge";

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { sidebarAgentFilter, setSidebarAgentFilter, setQuery } = useStore();
  const { data: projects, isLoading } = useProjects(sidebarAgentFilter);
  const t = useT();
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
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-[min(18rem,85vw)] shrink-0 flex-col border-r border-border bg-surface shadow-2xl transition-transform md:static md:z-auto md:w-64 md:translate-x-0 md:shadow-none",
        open ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 md:hidden">
        <span className="text-sm font-semibold text-foreground">
          Coding Agent History
        </span>
        <button
          type="button"
          onClick={onClose}
          title={t("closeNavigation")}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
        >
          <X size={16} />
        </button>
      </div>
      <div className="shrink-0 space-y-2 p-3">
        <NavLink
          to="/"
          end
          onClick={() => {
            setQuery("");
            onClose();
          }}
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
          {t("navHome")}
        </NavLink>
        <NavLink
          to="/export"
          onClick={() => {
            setQuery("");
            onClose();
          }}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent/15 text-accent"
                : "text-foreground hover:bg-surface-2"
            )
          }
        >
          <Download size={16} />
          {t("navExport")}
        </NavLink>
        <AgentFilterControl
          value={sidebarAgentFilter}
          onChange={setSidebarAgentFilter}
          compact
          className="w-full [&>button]:flex-1 [&>button]:px-2"
        />
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("filterFoldersPlaceholder")}
            className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-2 text-xs text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between px-4 pb-1 text-[11px] font-semibold uppercase text-muted">
        <span>{t("foldersSection")}</span>
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
            {t("noMatchingFolders")}
          </div>
        ) : (
          filtered.map((p) => (
            <NavLink
              key={p.path}
              to={`/project/${encodePath(p.path)}`}
              onClick={() => {
                setQuery("");
                onClose();
              }}
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
                <span>
                  {t("promptCountLabel", { count: formatNumber(p.promptCount) })}
                </span>
                {p.hasConversations && (
                  <span>
                    · {t("sessionCountLabel", { count: p.sessionCount })}
                  </span>
                )}
              </div>
              {sidebarAgentFilter === "all" && (
                <div className="mt-1 flex flex-wrap gap-1 pl-6">
                  {p.agents.map((agent) => (
                    <AgentBadge key={agent} agent={agent} />
                  ))}
                </div>
              )}
            </NavLink>
          ))
        )}
      </div>
    </aside>
  );
}
