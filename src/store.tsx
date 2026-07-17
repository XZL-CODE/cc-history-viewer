// 全局轻量状态：主题、Agent 范围、搜索范围、命令过滤和当前文件夹。

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

export function StoreProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem("cchv-theme") === "dark" ? "dark" : "light"
  );
  const [query, setQueryState] = useState("");
  const queryRef = useRef("");
  const [agentFilter, setAgentFilterState] = useState<AgentFilter>("all");
  const [sidebarAgentFilter, setSidebarAgentFilterState] =
    useState<AgentFilter>("all");
  const [searchAgentFilter, setSearchAgentFilterState] =
    useState<AgentFilter>("all");
  const [projectAgentFilter, setProjectAgentFilterState] =
    useState<AgentFilter>("all");
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
  }, []);

  const setSidebarAgentFilter = useCallback((agent: AgentFilter) => {
    setSidebarAgentFilterState(agent);
  }, []);

  const setSearchAgentFilter = useCallback((agent: AgentFilter) => {
    setSearchAgentFilterState(agent);
  }, []);

  const setProjectAgentFilter = useCallback((agent: AgentFilter) => {
    setProjectAgentFilterState(agent);
  }, []);

  const setQuery = useCallback((nextQuery: string) => {
    const startsNewSearch =
      queryRef.current.trim().length === 0 && nextQuery.trim().length > 0;
    queryRef.current = nextQuery;
    if (startsNewSearch) setSearchAgentFilterState("all");
    setQueryState(nextQuery);
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
