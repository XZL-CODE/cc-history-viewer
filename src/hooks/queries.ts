// 基于 TanStack Query 的数据请求 hooks。

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ExportGroupBy, SortMode } from "@/lib/types";
import { useDebounce } from "./useDebounce";

const FIVE_MIN = 5 * 60 * 1000;

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: api.getProjects,
    staleTime: FIVE_MIN,
  });
}

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: api.getStats,
    staleTime: FIVE_MIN,
  });
}

export function useIndexMeta() {
  return useQuery({
    queryKey: ["index-meta"],
    queryFn: api.getIndexMeta,
    staleTime: FIVE_MIN,
  });
}

/** 设置（数据源目录）。每次打开都重新读取，保证 resolved 路径状态新鲜。 */
export function useSettings(enabled = true) {
  return useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
    enabled,
    staleTime: 0,
  });
}

export function useRecentPrompts(limit: number, includeCommands: boolean) {
  return useQuery({
    queryKey: ["recent-prompts", limit, includeCommands],
    queryFn: () => api.getRecentPrompts(limit, includeCommands),
    staleTime: FIVE_MIN,
  });
}

export function useProjectPrompts(
  project: string | null,
  sort: SortMode,
  includeCommands: boolean
) {
  return useQuery({
    queryKey: ["project-prompts", project, sort, includeCommands],
    queryFn: () =>
      api.getProjectPrompts(project as string, sort, includeCommands),
    enabled: !!project,
    staleTime: FIVE_MIN,
  });
}

export function useProjectSessions(project: string | null) {
  return useQuery({
    queryKey: ["project-sessions", project],
    queryFn: () => api.getProjectSessions(project as string),
    enabled: !!project,
    staleTime: FIVE_MIN,
  });
}

export function useConversation(sessionId: string | null) {
  return useQuery({
    queryKey: ["conversation", sessionId],
    queryFn: () => api.getConversation(sessionId as string),
    enabled: !!sessionId,
    staleTime: FIVE_MIN,
  });
}

/** 导出预览：仅生成统计与截断预览，不写文件。输入变化时自动重算。 */
export function useExportPreview(params: {
  startDate: string;
  endDate: string;
  project: string | null;
  includeCommands: boolean;
  groupBy: ExportGroupBy;
  lang: string;
  enabled: boolean;
}) {
  const {
    startDate,
    endDate,
    project,
    includeCommands,
    groupBy,
    lang,
    enabled,
  } = params;
  return useQuery({
    queryKey: [
      "export-preview",
      startDate,
      endDate,
      project,
      includeCommands,
      groupBy,
      lang,
    ],
    queryFn: () =>
      api.buildExport({
        startDate,
        endDate,
        project,
        includeCommands,
        groupBy,
        lang,
        write: false,
      }),
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useSearch(
  query: string,
  projectFilter: string | null,
  includeCommands: boolean
) {
  const debounced = useDebounce(query.trim(), 300);
  const result = useQuery({
    queryKey: ["search", debounced, projectFilter, includeCommands],
    queryFn: () =>
      api.searchPrompts(debounced, projectFilter, includeCommands),
    enabled: debounced.length > 0,
    staleTime: 60 * 1000,
  });
  return { ...result, debouncedQuery: debounced };
}
