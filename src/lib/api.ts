// Tauri Commands 的前端封装。
// 注意：invoke 的参数键用 camelCase，Tauri 会自动映射到 Rust 的 snake_case 参数。

import { invoke } from "@tauri-apps/api/core";
import type {
  AppStats,
  ConversationDetail,
  ExportParams,
  ExportResult,
  IndexMeta,
  ProjectInfo,
  PromptEntry,
  SearchResult,
  SessionSummary,
  SortMode,
} from "./types";

export const api = {
  getProjects: () => invoke<ProjectInfo[]>("get_projects"),

  getProjectPrompts: (
    project: string,
    sort: SortMode,
    includeCommands: boolean
  ) =>
    invoke<PromptEntry[]>("get_project_prompts", {
      project,
      sort,
      includeCommands,
    }),

  getRecentPrompts: (limit: number, includeCommands: boolean) =>
    invoke<PromptEntry[]>("get_recent_prompts", { limit, includeCommands }),

  searchPrompts: (
    query: string,
    projectFilter: string | null,
    includeCommands: boolean
  ) =>
    invoke<SearchResult[]>("search_prompts", {
      query,
      projectFilter,
      includeCommands,
    }),

  getStats: () => invoke<AppStats>("get_stats"),

  getProjectSessions: (project: string) =>
    invoke<SessionSummary[]>("get_project_sessions", { project }),

  getConversation: (sessionId: string) =>
    invoke<ConversationDetail>("get_conversation", { sessionId }),

  getIndexMeta: () => invoke<IndexMeta>("get_index_meta"),

  refreshIndex: () => invoke<IndexMeta>("refresh_index"),

  buildExport: (p: ExportParams) =>
    invoke<ExportResult>("build_prompt_export", {
      startDate: p.startDate,
      endDate: p.endDate,
      project: p.project,
      includeCommands: p.includeCommands,
      groupBy: p.groupBy,
      write: p.write,
    }),

  revealPath: (path: string) => invoke<void>("reveal_path", { path }),
};

/** 把后端返回的错误统一转成可读字符串 */
export function errMessage(e: unknown): string {
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  return "发生未知错误";
}
