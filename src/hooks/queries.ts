// 基于 TanStack Query 的数据请求 hooks。

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SortMode } from "@/lib/types";
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
