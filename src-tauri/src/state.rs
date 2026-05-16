//! 应用运行时状态 与 数据源路径解析。

use crate::indexer::AppIndex;
use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// Tauri 托管状态：缓存构建好的索引，避免每次命令都重新扫描。
pub struct AppState {
    /// 懒加载的索引；首次命令调用时构建。
    pub index: Mutex<Option<AppIndex>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            index: Mutex::new(None),
        }
    }
}

/// 解析后得到的三个数据源路径。
#[derive(Debug, Clone)]
pub struct DataPaths {
    pub history: PathBuf,
    pub projects: PathBuf,
    pub sessions: PathBuf,
}

/// 项目根目录下 settings.json 的内容。
#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct ViewerSettings {
    /// Claude 数据目录（含 history.jsonl / projects / sessions）
    claude_data_dir: String,
    /// 可选：单独指定 history.jsonl 路径
    history_file: String,
    /// 可选：单独指定 projects 目录
    projects_dir: String,
    /// 可选：单独指定 sessions 目录
    sessions_dir: String,
}

/// 项目根目录（src-tauri 的上级），编译期确定。
fn project_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."))
}

/// 配置文件路径：<项目根>/settings.json
pub fn settings_path() -> PathBuf {
    project_root().join("settings.json")
}

/// 默认数据目录 ~/.claude
fn default_claude_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude"))
}

/// 读取并解析 settings.json（缺失 / 解析失败 时返回全空配置）。
fn load_settings() -> ViewerSettings {
    fs::read_to_string(settings_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

/// 按「settings.json 配置 > 默认 ~/.claude」解析出三个数据源路径。
pub fn resolve_data_paths() -> Result<DataPaths, String> {
    let s = load_settings();

    // 基准目录：配置了 claudeDataDir 则用它，否则用 ~/.claude
    let base: Option<PathBuf> = if s.claude_data_dir.trim().is_empty() {
        default_claude_dir()
    } else {
        Some(PathBuf::from(s.claude_data_dir.trim()))
    };

    // 单项优先用显式配置，否则在基准目录下推导
    let pick = |explicit: &str, sub: &str| -> Result<PathBuf, String> {
        if !explicit.trim().is_empty() {
            Ok(PathBuf::from(explicit.trim()))
        } else {
            base.as_ref().map(|b| b.join(sub)).ok_or_else(|| {
                "无法定位数据目录：请在项目根目录的 settings.json 中填写 claudeDataDir。"
                    .to_string()
            })
        }
    };

    Ok(DataPaths {
        history: pick(&s.history_file, "history.jsonl")?,
        projects: pick(&s.projects_dir, "projects")?,
        sessions: pick(&s.sessions_dir, "sessions")?,
    })
}
