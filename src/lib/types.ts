// 与 Rust src-tauri/src/models.rs 一一对应的类型定义。

export type PromptSource = "history" | "conversation" | "both";

export interface PromptEntry {
  id: string;
  text: string;
  project: string;
  timestamp: number;
  source: PromptSource;
  sessionId: string | null;
  gitBranch: string | null;
  isCommand: boolean;
  pastedCount: number;
  charCount: number;
}

export interface ProjectInfo {
  path: string;
  name: string;
  promptCount: number;
  commandCount: number;
  sessionCount: number;
  firstActive: number;
  lastActive: number;
  hasConversations: boolean;
}

export interface SearchResult {
  entry: PromptEntry;
  matchRanges: [number, number][];
}

export interface SessionSummary {
  sessionId: string;
  project: string;
  title: string;
  startedAt: number;
  endedAt: number;
  messageCount: number;
  gitBranch: string | null;
}

export type BlockKind =
  | "text"
  | "thinking"
  | "tool_use"
  | "tool_result"
  | "image";

export interface ContentBlock {
  kind: BlockKind;
  text: string | null;
  toolName: string | null;
  toolInput: unknown | null;
}

export interface ChatMessage {
  uuid: string;
  role: "user" | "assistant";
  timestamp: number;
  isSidechain: boolean;
  blocks: ContentBlock[];
}

export interface ConversationDetail {
  sessionId: string;
  project: string;
  gitBranch: string | null;
  startedAt: number;
  endedAt: number;
  version: string | null;
  messages: ChatMessage[];
}

export interface DayCount {
  day: string;
  count: number;
}
export interface HourCount {
  hour: number;
  count: number;
}
export interface WeekdayCount {
  weekday: number;
  count: number;
}
export interface ProjectCount {
  path: string;
  name: string;
  count: number;
}

/* ----------------------------- Token 用量统计 ----------------------------- */

export interface ModelUsage {
  model: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
  messages: number;
  estCostUsd: number | null;
}

export interface DayUsage {
  day: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
  estCostUsd: number;
}

export interface ProjectUsage {
  path: string;
  name: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
  estCostUsd: number;
}

export interface UsageStats {
  totalInput: number;
  totalOutput: number;
  totalCacheRead: number;
  totalCacheCreation: number;
  estCostUsd: number;
  unknownModelTokens: number;
  assistantMessages: number;
  byModel: ModelUsage[];
  byDay: DayUsage[];
  byProject: ProjectUsage[];
}

export interface AppStats {
  totalPrompts: number;
  totalProjects: number;
  totalSessions: number;
  totalMessages: number;
  historyPrompts: number;
  conversationPrompts: number;
  commandCount: number;
  firstUse: number;
  lastUse: number;
  byDay: DayCount[];
  byHour: HourCount[];
  byWeekday: WeekdayCount[];
  topProjects: ProjectCount[];
  ccVersions: string[];
  usage: UsageStats;
}

export interface IndexMeta {
  builtAt: number;
  fromCache: boolean;
  sourceFiles: number;
  reparsedFiles: number;
}

export type SortMode = "newest" | "oldest" | "longest";

export type ExportGroupBy = "project" | "day" | "none";

export interface ExportParams {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  project: string | null; // null = 全部文件夹
  includeCommands: boolean;
  groupBy: ExportGroupBy;
  write: boolean;
  lang?: string; // 导出文案语言："zh" | "en"，跟随界面语言
}

export interface ExportResult {
  preview: string;
  path: string | null;
  promptCount: number;
  folderCount: number;
  dayCount: number;
}

/* ----------------------------- 对话导出 ----------------------------- */

export interface ConversationExportResult {
  preview: string;
  path: string | null;
  messageCount: number;
}

/* ----------------------------- 设置 ----------------------------- */

export interface SettingsInput {
  claudeDataDir: string;
  historyFile: string;
  projectsDir: string;
  sessionsDir: string;
}

export interface ResolvedPaths {
  history: string;
  projects: string;
  sessions: string;
  historyExists: boolean;
  projectsExists: boolean;
  sessionsExists: boolean;
}

export interface SettingsView extends SettingsInput {
  configPath: string;
  resolved: ResolvedPaths;
}
