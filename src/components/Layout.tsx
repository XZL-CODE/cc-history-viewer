import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Languages,
  Layers3,
  RefreshCw,
  Settings,
  Terminal,
} from "lucide-react";
import { useStore } from "@/store";
import { useLang, useT } from "@/i18n";
import { api } from "@/lib/api";
import { cn, decodePath } from "@/lib/utils";
import { SearchResults } from "@/pages/SearchResults";
import { SearchBar } from "./SearchBar";
import { SettingsDialog } from "./SettingsDialog";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./ui";

export function Layout() {
  const {
    query,
    includeCommands,
    setIncludeCommands,
    setQuery,
    setCurrentProject,
    setProjectAgentFilter,
    setScope,
  } = useStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT();
  const { lang, setLang } = useLang();
  const [refreshing, setRefreshing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 路由进入新文件夹时登记搜索范围，并按约定重置详情筛选。
  useEffect(() => {
    const match = location.pathname.match(/^\/project\/(.+)$/);
    if (match) {
      const path = decodePath(match[1]);
      const name = path.split("/").filter(Boolean).pop() || path;
      setCurrentProject(path, name);
      setProjectAgentFilter("all");
      setScope("folder");
    } else {
      setCurrentProject(null);
    }
  }, [
    location.pathname,
    setCurrentProject,
    setProjectAgentFilter,
    setScope,
  ]);

  const searching = query.trim().length > 0;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.refreshIndex();
      await queryClient.invalidateQueries();
    } catch {
      // 刷新失败时静默，下次命令会自动重试。
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="grid h-screen min-w-0 grid-rows-[56px_minmax(0,1fr)]">
      <header className="grid min-w-0 grid-cols-[264px_minmax(0,1fr)] border-b border-border bg-surface max-[1220px]:grid-cols-[248px_minmax(0,1fr)]">
        <button
          type="button"
          onClick={() => {
            setQuery("");
            navigate("/");
          }}
          className="flex min-w-0 items-center gap-2.5 px-3.5 text-left transition-colors hover:bg-surface-2/60"
          title={t("backHome")}
          aria-label={t("backHome")}
        >
          <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg">
            <Layers3 size={17} />
          </span>
          <span className="truncate text-sm font-semibold text-foreground max-[1080px]:hidden">
            Coding Agent History Viewer
          </span>
        </button>

        <div className="flex min-w-0 items-center gap-1.5 px-3 py-2">
          <div className="min-w-0 flex-1">
            <SearchBar />
          </div>

          <button
            type="button"
            onClick={() => setIncludeCommands(!includeCommands)}
            title={
              includeCommands
                ? t("commandsShownTitle")
                : t("commandsHiddenTitle")
            }
            className={cn(
              "flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
              includeCommands
                ? "border-accent/40 bg-accent/15 text-accent"
                : "border-border text-muted hover:bg-surface-2 hover:text-foreground"
            )}
          >
            <Terminal size={14} />
            <span className="max-[1220px]:hidden">{t("commandsToggle")}</span>
          </button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            title={t("refreshTitle")}
          >
            <RefreshCw size={16} className={cn(refreshing && "animate-spin")} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            title={t("settingsButtonTitle")}
          >
            <Settings size={16} />
          </Button>

          <button
            type="button"
            onClick={() => setLang(lang === "zh" ? "en" : "zh")}
            title={t("switchLanguage")}
            className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-border px-2 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <Languages size={14} />
            <span className="max-[1220px]:hidden">{t("langBadge")}</span>
          </button>

          <ThemeToggle />
        </div>
      </header>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <div className="grid min-h-0 min-w-0 grid-cols-[264px_minmax(0,1fr)] max-[1220px]:grid-cols-[248px_minmax(0,1fr)]">
        <Sidebar />
        <main className="min-h-0 min-w-0 overflow-y-auto bg-background">
          {searching ? <SearchResults /> : <Outlet />}
        </main>
      </div>
    </div>
  );
}
