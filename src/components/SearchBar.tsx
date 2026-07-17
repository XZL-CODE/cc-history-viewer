import { Folder, Globe, Search, X } from "lucide-react";
import { useStore } from "@/store";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

export function SearchBar() {
  const {
    query,
    setQuery,
    scope,
    setScope,
    currentProject,
    currentProjectName,
  } = useStore();
  const t = useT();
  const folderAvailable = !!currentProject;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            scope === "folder" && currentProjectName
              ? t("searchInFolderPlaceholder", { name: currentProjectName })
              : t("searchAllPlaceholder")
          }
          className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-9 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-ring/25"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted transition-colors hover:text-foreground"
            title={t("clearSearch")}
          >
            <X size={15} />
          </button>
        )}
      </div>

      <div className="flex shrink-0 items-center rounded-lg border border-border bg-surface p-0.5">
        <button
          onClick={() => setScope("global")}
          title={t("scopeGlobal")}
          className={cn(
            "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            scope === "global"
              ? "bg-accent text-accent-fg"
              : "text-muted hover:text-foreground"
          )}
        >
          <Globe size={13} />
          <span className="hidden lg:inline">{t("scopeGlobal")}</span>
        </button>
        <button
          disabled={!folderAvailable}
          onClick={() => folderAvailable && setScope("folder")}
          title={folderAvailable ? t("scopeFolder") : t("scopeFolderDisabledTitle")}
          className={cn(
            "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            scope === "folder"
              ? "bg-accent text-accent-fg"
              : "text-muted hover:text-foreground",
            !folderAvailable && "cursor-not-allowed opacity-40"
          )}
        >
          <Folder size={13} />
          <span className="hidden lg:inline">{t("scopeFolder")}</span>
        </button>
      </div>
    </div>
  );
}
