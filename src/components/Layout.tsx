import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Languages,
  Layers,
  Menu,
  RefreshCw,
  Settings,
  Terminal,
} from "lucide-react";
import { useStore } from "@/store";
import { useLang, useT } from "@/i18n";
import { api } from "@/lib/api";
import { cn, decodePath } from "@/lib/utils";
import { SearchBar } from "./SearchBar";
import { SettingsDialog } from "./SettingsDialog";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./ui";
import { SearchResults } from "@/pages/SearchResults";

export function Layout() {
  const {
    query,
    includeCommands,
    setIncludeCommands,
    setQuery,
    setCurrentProject,
    setScope,
  } = useStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT();
  const { lang, setLang } = useLang();
  const [refreshing, setRefreshing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 根据路由派生「当前文件夹」，使其不受搜索时页面卸载的影响
  useEffect(() => {
    setSidebarOpen(false);
    const m = location.pathname.match(/^\/project\/(.+)$/);
    if (m) {
      const path = decodePath(m[1]);
      const name = path.split("/").filter(Boolean).pop() || path;
      setCurrentProject(path, name);
      setScope("folder");
    } else {
      setCurrentProject(null);
    }
  }, [location.pathname, setCurrentProject, setScope]);

  const searching = query.trim().length > 0;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.refreshIndex();
      await queryClient.invalidateQueries();
    } catch {
      // 刷新失败时静默，下次命令会自动重试
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex h-screen min-w-0 flex-col">
      <header className="shrink-0 border-b border-border bg-surface">
        <div className="flex h-14 min-w-0 items-center gap-1.5 px-3 sm:gap-2 sm:px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            title={t("openNavigation")}
            className="md:hidden"
          >
            <Menu size={17} />
          </Button>

          <button
            onClick={() => {
              setQuery("");
              navigate("/");
            }}
            className="flex shrink-0 items-center gap-2"
            title={t("backHome")}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-fg">
              <Layers size={16} />
            </span>
            <span className="hidden text-sm font-semibold text-foreground xl:inline">
              Coding Agent History Viewer
            </span>
          </button>

          <div className="hidden min-w-0 flex-1 md:block">
            <SearchBar />
          </div>

          <button
            onClick={() => setIncludeCommands(!includeCommands)}
            title={includeCommands ? t("commandsShownTitle") : t("commandsHiddenTitle")}
            className={cn(
              "flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
              includeCommands
                ? "border-accent/40 bg-accent/15 text-accent"
                : "border-border text-muted hover:text-foreground"
            )}
          >
            <Terminal size={14} />
            <span className="hidden xl:inline">{t("commandsToggle")}</span>
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
            onClick={() => setLang(lang === "zh" ? "en" : "zh")}
            title={t("switchLanguage")}
            className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-border px-2 text-xs font-medium text-muted transition-colors hover:text-foreground"
          >
            <Languages size={14} />
            <span className="hidden xl:inline">{t("langBadge")}</span>
          </button>

          <ThemeToggle />
        </div>
        <div className="px-3 pb-2 md:hidden">
          <SearchBar />
        </div>
      </header>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {sidebarOpen && (
        <button
          type="button"
          aria-label={t("closeNavigation")}
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
        />
      )}

      <div className="flex min-w-0 flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          {searching ? <SearchResults /> : <Outlet />}
        </main>
      </div>
    </div>
  );
}
