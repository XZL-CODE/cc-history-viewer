// 全局轻量状态：主题、Agent 范围、搜索范围、命令过滤和当前文件夹。

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AgentFilter } from "@/lib/types";

type Theme = "dark" | "light";
export type SearchScope = "global" | "folder";

interface Store {
  theme: Theme;
  toggleTheme: () => void;

  /** 当前 Coding Agent 数据范围，默认合并查看。 */
  agentFilter: AgentFilter;
  setAgentFilter: (agent: AgentFilter) => void;

  /** 侧边栏文件夹、搜索结果、文件夹详情各自维护独立的数据范围。 */
  sidebarAgentFilter: AgentFilter;
  setSidebarAgentFilter: (agent: AgentFilter) => void;
  searchAgentFilter: AgentFilter;
  setSearchAgentFilter: (agent: AgentFilter) => void;
  projectAgentFilter: AgentFilter;
  setProjectAgentFilter: (agent: AgentFilter) => void;

  /** 搜索框即时输入值 */
  query: string;
  setQuery: (q: string) => void;

  /** 搜索范围：全局 / 当前文件夹 */
  scope: SearchScope;
  setScope: (s: SearchScope) => void;

  /** 是否在结果中包含斜杠命令（/clear 等） */
  includeCommands: boolean;
  setIncludeCommands: (b: boolean) => void;

  /** 当前进入的文件夹（真实路径），用于「当前文件夹」搜索 */
  currentProject: string | null;
  currentProjectName: string | null;
  setCurrentProject: (path: string | null, name?: string | null) => void;
}

const StoreContext = createContext<Store | null>(null);

function storedAgentFilter(key: string): AgentFilter {
  const saved = localStorage.getItem(key);
  return saved === "claude" || saved === "codex" ? saved : "all";
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem("cchv-theme") === "light" ? "light" : "dark"
  );
  const [query, setQuery] = useState("");
  const [agentFilter, setAgentFilterState] = useState<AgentFilter>(() =>
    storedAgentFilter("cahv-agent-filter")
  );
  const [sidebarAgentFilter, setSidebarAgentFilterState] =
    useState<AgentFilter>(() => storedAgentFilter("cahv-sidebar-agent-filter"));
  const [searchAgentFilter, setSearchAgentFilterState] =
    useState<AgentFilter>(() => storedAgentFilter("cahv-search-agent-filter"));
  const [projectAgentFilter, setProjectAgentFilterState] =
    useState<AgentFilter>(() => storedAgentFilter("cahv-project-agent-filter"));
  const [scope, setScope] = useState<SearchScope>("global");
  const [includeCommands, setIncludeCommandsState] = useState<boolean>(
    () => localStorage.getItem("cchv-include-commands") !== "false"
  );
  const [currentProject, setCurrentProjectState] = useState<string | null>(
    null
  );
  const [currentProjectName, setCurrentProjectName] = useState<string | null>(
    null
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("cchv-theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    []
  );

  const setIncludeCommands = useCallback((b: boolean) => {
    setIncludeCommandsState(b);
    localStorage.setItem("cchv-include-commands", String(b));
  }, []);

  const setAgentFilter = useCallback((agent: AgentFilter) => {
    setAgentFilterState(agent);
    localStorage.setItem("cahv-agent-filter", agent);
  }, []);

  const setSidebarAgentFilter = useCallback((agent: AgentFilter) => {
    setSidebarAgentFilterState(agent);
    localStorage.setItem("cahv-sidebar-agent-filter", agent);
  }, []);

  const setSearchAgentFilter = useCallback((agent: AgentFilter) => {
    setSearchAgentFilterState(agent);
    localStorage.setItem("cahv-search-agent-filter", agent);
  }, []);

  const setProjectAgentFilter = useCallback((agent: AgentFilter) => {
    setProjectAgentFilterState(agent);
    localStorage.setItem("cahv-project-agent-filter", agent);
  }, []);

  const setCurrentProject = useCallback(
    (path: string | null, name: string | null = null) => {
      setCurrentProjectState(path);
      setCurrentProjectName(name);
      if (!path) setScope("global");
    },
    []
  );

  const value = useMemo<Store>(
    () => ({
      theme,
      toggleTheme,
      agentFilter,
      setAgentFilter,
      sidebarAgentFilter,
      setSidebarAgentFilter,
      searchAgentFilter,
      setSearchAgentFilter,
      projectAgentFilter,
      setProjectAgentFilter,
      query,
      setQuery,
      scope,
      setScope,
      includeCommands,
      setIncludeCommands,
      currentProject,
      currentProjectName,
      setCurrentProject,
    }),
    [
      theme,
      toggleTheme,
      agentFilter,
      setAgentFilter,
      sidebarAgentFilter,
      setSidebarAgentFilter,
      searchAgentFilter,
      setSearchAgentFilter,
      projectAgentFilter,
      setProjectAgentFilter,
      query,
      scope,
      includeCommands,
      setIncludeCommands,
      currentProject,
      currentProjectName,
      setCurrentProject,
    ]
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore(): Store {
  const v = useContext(StoreContext);
  if (!v) throw new Error("useStore 必须在 StoreProvider 内使用");
  return v;
}
