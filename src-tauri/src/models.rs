//! 前后端共享的数据模型。
//! 所有结构体使用 camelCase 序列化，与前端 TypeScript 类型一一对应。

use serde::{Deserialize, Serialize};

/// 统一的 Prompt 条目（history.jsonl 与对话文件 user 消息 合并去重后的结果）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptEntry {
    /// 稳定 id（由 项目+时间+文本 哈希生成）
    pub id: String,
    /// prompt 文本
    pub text: String,
    /// 所属文件夹的真实绝对路径
    pub project: String,
    /// 时间戳（毫秒）
    pub timestamp: i64,
    /// 来源："history" | "conversation" | "both"
    pub source: String,
    /// 所属会话 id（可用于跳转对话详情）
    pub session_id: Option<String>,
    /// git 分支
    pub git_branch: Option<String>,
    /// 是否为斜杠命令（以 / 开头）
    pub is_command: bool,
    /// 粘贴内容数量
    pub pasted_count: usize,
    /// 字符数
    pub char_count: usize,
}

/// 文件夹（项目）信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub path: String,
    /// 末级目录名（展示用）
    pub name: String,
    pub prompt_count: usize,
    pub command_count: usize,
    pub session_count: usize,
    pub first_active: i64,
    pub last_active: i64,
    /// 是否在 ~/.claude/projects 下有对应的对话文件
    pub has_conversations: bool,
}

/// 搜索结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub entry: PromptEntry,
    /// 命中区间（text 的字符索引，[start, end)），用于前端高亮
    pub match_ranges: Vec<[usize; 2]>,
}

/// 会话摘要
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub session_id: String,
    pub project: String,
    /// 首条 user prompt（作为标题）
    pub title: String,
    pub started_at: i64,
    pub ended_at: i64,
    pub message_count: usize,
    pub git_branch: Option<String>,
}

/// 对话详情
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationDetail {
    pub session_id: String,
    pub project: String,
    pub git_branch: Option<String>,
    pub started_at: i64,
    pub ended_at: i64,
    pub version: Option<String>,
    pub messages: Vec<ChatMessage>,
}

/// 单条对话消息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub uuid: String,
    /// "user" | "assistant"
    pub role: String,
    pub timestamp: i64,
    pub is_sidechain: bool,
    pub blocks: Vec<ContentBlock>,
}

/// 消息内容块
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentBlock {
    /// "text" | "thinking" | "tool_use" | "tool_result" | "image"
    pub kind: String,
    pub text: Option<String>,
    pub tool_name: Option<String>,
    pub tool_input: Option<serde_json::Value>,
}

/// 统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStats {
    pub total_prompts: usize,
    pub total_projects: usize,
    pub total_sessions: usize,
    pub total_messages: usize,
    pub history_prompts: usize,
    pub conversation_prompts: usize,
    pub command_count: usize,
    pub first_use: i64,
    pub last_use: i64,
    pub by_day: Vec<DayCount>,
    pub by_hour: Vec<HourCount>,
    pub by_weekday: Vec<WeekdayCount>,
    pub top_projects: Vec<ProjectCount>,
    pub cc_versions: Vec<String>,
    /// Token 用量与成本统计（assistant 消息按 dedup_key 全局去重后聚合）
    pub usage: UsageStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DayCount {
    pub day: String,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HourCount {
    pub hour: u8,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WeekdayCount {
    /// 0 = 周一 ... 6 = 周日
    pub weekday: u8,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectCount {
    pub path: String,
    pub name: String,
    pub count: usize,
}

/// 索引元信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexMeta {
    pub built_at: i64,
    pub from_cache: bool,
    pub source_files: usize,
    /// 本次构建中重新解析的对话文件数（全部命中缓存 = 0）
    pub reparsed_files: usize,
}

/// Prompt 导出结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    /// Markdown 预览（可能被截断，仅用于页面展示）
    pub preview: String,
    /// 实际写入的文件绝对路径；仅 write=true 时有值
    pub path: Option<String>,
    pub prompt_count: usize,
    pub folder_count: usize,
    pub day_count: usize,
}

/// 整段对话导出结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationExportResult {
    /// Markdown 预览（前 12000 字符，超出截断）
    pub preview: String,
    /// 实际写入的文件绝对路径；仅 write=true 时有值
    pub path: Option<String>,
    pub message_count: usize,
}

// ----------------------------- 设置 -----------------------------

/// 前端提交的设置内容（与配置文件 settings.json 的字段一致）
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SettingsInput {
    /// Claude 数据目录（含 history.jsonl / projects / sessions）
    pub claude_data_dir: String,
    /// 可选：单独指定 history.jsonl 路径
    pub history_file: String,
    /// 可选：单独指定 projects 目录
    pub projects_dir: String,
    /// 可选：单独指定 sessions 目录
    pub sessions_dir: String,
}

/// 设置视图：原始配置串 + 实际使用的配置文件路径 + 解析后的数据源路径
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsView {
    pub claude_data_dir: String,
    pub history_file: String,
    pub projects_dir: String,
    pub sessions_dir: String,
    /// 实际使用（或将写入）的配置文件路径
    pub config_path: String,
    pub resolved: ResolvedPaths,
}

/// 解析后的数据源绝对路径及存在性
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedPaths {
    pub history: String,
    pub projects: String,
    pub sessions: String,
    pub history_exists: bool,
    pub projects_exists: bool,
    pub sessions_exists: bool,
}

// ----------------------------- Token 用量统计 -----------------------------

/// Token 用量与成本统计（全局去重后）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageStats {
    pub total_input: u64,
    pub total_output: u64,
    pub total_cache_read: u64,
    pub total_cache_creation: u64,
    /// 估算总成本（USD，仅含已知定价的模型）
    pub est_cost_usd: f64,
    /// 未知定价模型贡献的 token 总量（四类合计）
    pub unknown_model_tokens: u64,
    /// 去重后的 assistant 消息条数
    pub assistant_messages: usize,
    pub by_model: Vec<ModelUsage>,
    pub by_day: Vec<DayUsage>,
    pub by_project: Vec<ProjectUsage>,
}

/// 按模型聚合的用量
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelUsage {
    pub model: String,
    pub input: u64,
    pub output: u64,
    pub cache_read: u64,
    pub cache_creation: u64,
    pub messages: usize,
    /// 估算成本；未知定价的模型为 None
    pub est_cost_usd: Option<f64>,
}

/// 按天聚合的用量（Local 时区）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DayUsage {
    /// YYYY-MM-DD
    pub day: String,
    pub input: u64,
    pub output: u64,
    pub cache_read: u64,
    pub cache_creation: u64,
    pub est_cost_usd: f64,
}

/// 按项目聚合的用量（取成本前 8）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectUsage {
    pub path: String,
    pub name: String,
    pub input: u64,
    pub output: u64,
    pub cache_read: u64,
    pub cache_creation: u64,
    pub est_cost_usd: f64,
}
