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
}

export interface IndexMeta {
  builtAt: number;
  fromCache: boolean;
  sourceFiles: number;
}

export type SortMode = "newest" | "oldest" | "longest";
