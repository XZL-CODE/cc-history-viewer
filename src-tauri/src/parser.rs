//! JSONL 数据解析：history.jsonl 与 projects/**/*.jsonl。

use crate::models::{ChatMessage, ContentBlock, ConversationDetail};
use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};

/// 超过此长度的行不参与 prompt 提取（多为 base64 图片 / 工具结果）
const MAX_LINE_FOR_PROMPT: usize = 2_000_000;
/// 对话详情中单个内容块的最大字符数，超出则截断
const MAX_BLOCK_CHARS: usize = 24_000;

/// 解析过程中的中间 prompt 表示
#[derive(Debug, Clone)]
pub struct RawPrompt {
    pub text: String,
    pub project: String,
    pub timestamp: i64,
    pub session_id: Option<String>,
    pub git_branch: Option<String>,
    pub pasted_count: usize,
    pub from_history: bool,
}

/// 单个对话文件的解析结果
#[derive(Debug)]
pub struct ConvFileResult {
    pub path: PathBuf,
    pub session_id: String,
    pub project: Option<String>,
    pub git_branch: Option<String>,
    pub version: Option<String>,
    pub started_at: i64,
    pub ended_at: i64,
    pub message_count: usize,
    pub first_prompt: String,
    pub user_prompts: Vec<RawPrompt>,
}

// ----------------------------- history.jsonl -----------------------------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct HistoryLine {
    display: Option<String>,
    pasted_contents: Option<serde_json::Value>,
    timestamp: Option<i64>,
    project: Option<String>,
    session_id: Option<String>,
}

/// 解析 ~/.claude/history.jsonl
pub fn parse_history(path: &Path) -> Vec<RawPrompt> {
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    let mut out = Vec::new();
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let parsed: HistoryLine = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let display = match parsed.display {
            Some(d) => d,
            None => continue,
        };
        let timestamp = match parsed.timestamp {
            Some(t) => t,
            None => continue,
        };
        let project = match parsed.project {
            Some(p) => p,
            None => continue,
        };
        let text = display.trim().to_string();
        if text.is_empty() {
            continue;
        }
        let pasted_count = match parsed.pasted_contents {
            Some(serde_json::Value::Object(m)) => m.len(),
            _ => 0,
        };
        out.push(RawPrompt {
            text,
            project,
            timestamp,
            session_id: parsed.session_id,
            git_branch: None,
            pasted_count,
            from_history: true,
        });
    }
    out
}

// --------------------------- 对话 JSONL ---------------------------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConvLine {
    #[serde(rename = "type")]
    line_type: Option<String>,
    uuid: Option<String>,
    timestamp: Option<String>,
    cwd: Option<String>,
    git_branch: Option<String>,
    version: Option<String>,
    is_sidechain: Option<bool>,
    message: Option<ConvMessage>,
}

#[derive(Deserialize)]
struct ConvMessage {
    role: Option<String>,
    content: Option<serde_json::Value>,
}

/// ISO8601 字符串转毫秒时间戳
fn iso_to_ms(s: &str) -> Option<i64> {
    chrono::DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|dt| dt.timestamp_millis())
}

/// 解析单个对话文件，提取 user prompt 与会话摘要信息。
pub fn parse_conversation_file(path: &Path) -> Option<ConvFileResult> {
    let content = fs::read_to_string(path).ok()?;
    let session_id = path.file_stem()?.to_string_lossy().to_string();

    let mut project: Option<String> = None;
    let mut git_branch: Option<String> = None;
    let mut version: Option<String> = None;
    let mut started_at = i64::MAX;
    let mut ended_at = i64::MIN;
    let mut message_count = 0usize;
    let mut first_prompt = String::new();
    let mut user_prompts: Vec<RawPrompt> = Vec::new();

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let too_big = line.len() > MAX_LINE_FOR_PROMPT;
        let parsed: ConvLine = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let ltype = parsed.line_type.as_deref().unwrap_or("");
        let ts = parsed.timestamp.as_deref().and_then(iso_to_ms);
        if let Some(t) = ts {
            if t < started_at {
                started_at = t;
            }
            if t > ended_at {
                ended_at = t;
            }
        }
        if project.is_none() {
            if let Some(c) = parsed.cwd.clone() {
                if !c.is_empty() {
                    project = Some(c);
                }
            }
        }
        if git_branch.is_none() {
            if let Some(b) = parsed.git_branch.clone() {
                if !b.is_empty() {
                    git_branch = Some(b);
                }
            }
        }
        if version.is_none() {
            version = parsed.version.clone();
        }

        if ltype == "user" || ltype == "assistant" {
            message_count += 1;
        }
        if ltype != "user" || too_big {
            continue;
        }
        if parsed.is_sidechain.unwrap_or(false) {
            continue;
        }
        let msg = match &parsed.message {
            Some(m) => m,
            None => continue,
        };
        // 仅保留真正的 user 角色
        if let Some(role) = &msg.role {
            if role != "user" {
                continue;
            }
        }
        let content_val = match &msg.content {
            Some(c) => c,
            None => continue,
        };
        let prompt_text = match extract_prompt_text(content_val) {
            Some(t) => t,
            None => continue,
        };
        let timestamp = match ts {
            Some(t) => t,
            None => continue,
        };
        if first_prompt.is_empty() {
            first_prompt = prompt_text.clone();
        }
        let line_project = parsed
            .cwd
            .clone()
            .filter(|c| !c.is_empty())
            .or_else(|| project.clone())
            .unwrap_or_default();
        user_prompts.push(RawPrompt {
            text: prompt_text,
            project: line_project,
            timestamp,
            session_id: Some(session_id.clone()),
            git_branch: parsed
                .git_branch
                .clone()
                .filter(|b| !b.is_empty())
                .or_else(|| git_branch.clone()),
            pasted_count: 0,
            from_history: false,
        });
    }

    if started_at == i64::MAX {
        started_at = 0;
    }
    if ended_at == i64::MIN {
        ended_at = 0;
    }

    // 回填：早于首个 cwd 出现的 prompt 行没有 project
    if let Some(proj) = &project {
        for p in user_prompts.iter_mut() {
            if p.project.is_empty() {
                p.project = proj.clone();
            }
        }
    }

    Some(ConvFileResult {
        path: path.to_path_buf(),
        session_id,
        project,
        git_branch,
        version,
        started_at,
        ended_at,
        message_count,
        first_prompt,
        user_prompts,
    })
}

/// 解析对话文件的完整内容（用于「对话详情」页面）。
pub fn parse_conversation_detail(path: &Path) -> Option<ConversationDetail> {
    let content = fs::read_to_string(path).ok()?;
    let session_id = path.file_stem()?.to_string_lossy().to_string();

    let mut project: Option<String> = None;
    let mut git_branch: Option<String> = None;
    let mut version: Option<String> = None;
    let mut started_at = i64::MAX;
    let mut ended_at = i64::MIN;
    let mut messages: Vec<ChatMessage> = Vec::new();

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let parsed: ConvLine = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let ltype = parsed.line_type.as_deref().unwrap_or("");
        let ts = parsed.timestamp.as_deref().and_then(iso_to_ms);
        if let Some(t) = ts {
            if t < started_at {
                started_at = t;
            }
            if t > ended_at {
                ended_at = t;
            }
        }
        if project.is_none() {
            if let Some(c) = &parsed.cwd {
                if !c.is_empty() {
                    project = Some(c.clone());
                }
            }
        }
        if git_branch.is_none() {
            if let Some(b) = &parsed.git_branch {
                if !b.is_empty() {
                    git_branch = Some(b.clone());
                }
            }
        }
        if version.is_none() {
            version = parsed.version.clone();
        }
        if ltype != "user" && ltype != "assistant" {
            continue;
        }
        let msg = match &parsed.message {
            Some(m) => m,
            None => continue,
        };
        let role = msg.role.clone().unwrap_or_else(|| ltype.to_string());
        let blocks = content_to_blocks(msg.content.as_ref());
        if blocks.is_empty() {
            continue;
        }
        messages.push(ChatMessage {
            uuid: parsed.uuid.unwrap_or_default(),
            role,
            timestamp: ts.unwrap_or(0),
            is_sidechain: parsed.is_sidechain.unwrap_or(false),
            blocks,
        });
    }

    if started_at == i64::MAX {
        started_at = 0;
    }
    if ended_at == i64::MIN {
        ended_at = 0;
    }

    Some(ConversationDetail {
        session_id,
        project: project.unwrap_or_default(),
        git_branch,
        started_at,
        ended_at,
        version,
        messages,
    })
}

// ----------------------------- 文本处理 -----------------------------

/// 从 user 消息 content 提取可作为 prompt 的纯文本
fn extract_prompt_text(content: &serde_json::Value) -> Option<String> {
    let raw = match content {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Array(arr) => {
            let mut parts: Vec<String> = Vec::new();
            let mut saw_text = false;
            let mut saw_tool_result = false;
            for block in arr {
                let bt = block.get("type").and_then(|v| v.as_str()).unwrap_or("");
                match bt {
                    "text" => {
                        if let Some(t) = block.get("text").and_then(|v| v.as_str()) {
                            parts.push(t.to_string());
                            saw_text = true;
                        }
                    }
                    "image" => {
                        parts.push("[图片]".to_string());
                        saw_text = true;
                    }
                    "tool_result" => saw_tool_result = true,
                    _ => {}
                }
            }
            // 纯 tool_result 的 user 消息不是真正的 prompt
            if !saw_text && saw_tool_result {
                return None;
            }
            parts.join("\n")
        }
        _ => return None,
    };
    clean_prompt_text(&raw)
}

/// 清洗 prompt 文本：剥离系统提示 / 命令包裹标签，识别斜杠命令。
fn clean_prompt_text(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    // 本地命令的标准输出/错误输出，不是 prompt
    if trimmed.starts_with("<local-command-stdout>")
        || trimmed.starts_with("<local-command-stderr>")
        || trimmed.starts_with("<bash-stdout>")
    {
        return None;
    }
    // 斜杠命令：<command-name>/foo</command-name>...
    if let Some(name) = extract_between(trimmed, "<command-name>", "</command-name>") {
        let n = name.trim();
        if !n.is_empty() {
            return Some(n.to_string());
        }
    }
    // 去掉系统提示与命令相关包裹标签
    let mut s = strip_tag_blocks(trimmed, "system-reminder");
    s = strip_tag_blocks(&s, "command-message");
    s = strip_tag_blocks(&s, "command-args");
    s = strip_tag_blocks(&s, "command-name");
    s = strip_tag_blocks(&s, "command-stdout");
    let s = s.trim();
    if s.is_empty()
        || s == "[Request interrupted by user]"
        || s == "[Request interrupted by user for tool use]"
    {
        return None;
    }
    Some(s.to_string())
}

/// 删除所有 `<tag ...>...</tag>` 区块
fn strip_tag_blocks(s: &str, tag: &str) -> String {
    let open_prefix = format!("<{tag}");
    let close = format!("</{tag}>");
    let mut out = String::new();
    let mut rest = s;
    loop {
        match rest.find(&open_prefix) {
            Some(start) => match rest[start..].find(&close) {
                Some(close_rel) => {
                    out.push_str(&rest[..start]);
                    let after = start + close_rel + close.len();
                    rest = &rest[after..];
                }
                None => {
                    out.push_str(rest);
                    break;
                }
            },
            None => {
                out.push_str(rest);
                break;
            }
        }
    }
    out
}

/// 取出 open 与 close 标记之间的内容
fn extract_between(s: &str, open: &str, close: &str) -> Option<String> {
    let start = s.find(open)? + open.len();
    let rel_end = s[start..].find(close)?;
    Some(s[start..start + rel_end].to_string())
}

/// 字符级截断
fn truncate(s: &str) -> String {
    if s.chars().count() > MAX_BLOCK_CHARS {
        let t: String = s.chars().take(MAX_BLOCK_CHARS).collect();
        format!("{t}\n…（内容过长，已截断）")
    } else {
        s.to_string()
    }
}

/// 把消息 content 转成内容块列表（用于对话详情展示）
fn content_to_blocks(content: Option<&serde_json::Value>) -> Vec<ContentBlock> {
    let mut blocks = Vec::new();
    match content {
        Some(serde_json::Value::String(s)) => {
            let t = s.trim();
            if !t.is_empty() {
                blocks.push(ContentBlock {
                    kind: "text".to_string(),
                    text: Some(truncate(t)),
                    tool_name: None,
                    tool_input: None,
                });
            }
        }
        Some(serde_json::Value::Array(arr)) => {
            for b in arr {
                let bt = b.get("type").and_then(|v| v.as_str()).unwrap_or("");
                match bt {
                    "text" => {
                        if let Some(t) = b.get("text").and_then(|v| v.as_str()) {
                            blocks.push(ContentBlock {
                                kind: "text".to_string(),
                                text: Some(truncate(t)),
                                tool_name: None,
                                tool_input: None,
                            });
                        }
                    }
                    "thinking" => {
                        if let Some(t) = b.get("thinking").and_then(|v| v.as_str()) {
                            blocks.push(ContentBlock {
                                kind: "thinking".to_string(),
                                text: Some(truncate(t)),
                                tool_name: None,
                                tool_input: None,
                            });
                        }
                    }
                    "tool_use" => {
                        let name = b
                            .get("name")
                            .and_then(|v| v.as_str())
                            .unwrap_or("tool")
                            .to_string();
                        blocks.push(ContentBlock {
                            kind: "tool_use".to_string(),
                            text: None,
                            tool_name: Some(name),
                            tool_input: b.get("input").cloned(),
                        });
                    }
                    "tool_result" => {
                        let txt = tool_result_text(b.get("content"));
                        blocks.push(ContentBlock {
                            kind: "tool_result".to_string(),
                            text: Some(truncate(&txt)),
                            tool_name: None,
                            tool_input: None,
                        });
                    }
                    "image" => {
                        blocks.push(ContentBlock {
                            kind: "image".to_string(),
                            text: Some("[图片]".to_string()),
                            tool_name: None,
                            tool_input: None,
                        });
                    }
                    _ => {}
                }
            }
        }
        _ => {}
    }
    blocks
}

/// 提取 tool_result 的可读文本
fn tool_result_text(content: Option<&serde_json::Value>) -> String {
    match content {
        Some(serde_json::Value::String(s)) => s.clone(),
        Some(serde_json::Value::Array(arr)) => {
            let mut parts = Vec::new();
            for b in arr {
                let bt = b.get("type").and_then(|v| v.as_str()).unwrap_or("");
                if bt == "text" {
                    if let Some(t) = b.get("text").and_then(|v| v.as_str()) {
                        parts.push(t.to_string());
                    }
                } else if bt == "image" {
                    parts.push("[图片]".to_string());
                }
            }
            parts.join("\n")
        }
        Some(other) => other.to_string(),
        None => String::new(),
    }
}
