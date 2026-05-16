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
}
