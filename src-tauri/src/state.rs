//! 应用运行时状态 与 数据源路径解析。

use crate::indexer::AppIndex;
use crate::models::SettingsInput;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

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

/// 项目根目录（src-tauri 的上级），编译期确定。
/// 仅作为 dev 模式的兼容回退使用：发布版用户机器上该路径并不存在。
fn project_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."))
}

/// 旧版配置文件路径：<项目根>/settings.json（dev 模式兼容回退）
fn legacy_settings_path() -> PathBuf {
    project_root().join("settings.json")
}

/// 正式配置文件路径：<app_config_dir>/settings.json（发布版 / dev 均可用）
pub fn config_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|d| d.join("settings.json"))
        .map_err(|e| format!("无法获取应用配置目录：{e}"))
}

/// 默认数据目录 ~/.claude
fn default_claude_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude"))
}

/// 读取并解析某个 settings.json（解析失败时返回全空配置）。
fn read_settings_file(path: &Path) -> SettingsInput {
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

/// 加载设置：优先 app_config_dir/settings.json，其次回退旧的 <项目根>/settings.json；
/// 都不存在则返回全空配置（即默认 ~/.claude）。
/// 返回 (设置内容, 实际使用的配置文件路径)；都不存在时路径指向 app_config_dir 下的目标位置
/// （set_settings 将写入该处）。
pub fn load_settings(app: &AppHandle) -> (SettingsInput, PathBuf) {
    let primary = config_file_path(app).ok();
    if let Some(p) = &primary {
        if p.is_file() {
            return (read_settings_file(p), p.clone());
        }
    }
    let legacy = legacy_settings_path();
    if legacy.is_file() {
        return (read_settings_file(&legacy), legacy);
    }
    (SettingsInput::default(), primary.unwrap_or(legacy))
}

/// 把设置写入 app_config_dir/settings.json（pretty JSON，目录不存在则创建）。
pub fn save_settings(app: &AppHandle, s: &SettingsInput) -> Result<PathBuf, String> {
    let path = config_file_path(app)?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| format!("创建配置目录失败：{e}"))?;
    }
    let json =
        serde_json::to_string_pretty(s).map_err(|e| format!("序列化设置失败：{e}"))?;
    fs::write(&path, json).map_err(|e| format!("写入配置文件失败：{e}"))?;
    Ok(path)
}

/// 按「设置内容 > 默认 ~/.claude」解析出三个数据源路径。
pub fn resolve_from_settings(s: &SettingsInput) -> Result<DataPaths, String> {
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
            base.as_ref()
                .map(|b| b.join(sub))
                .ok_or_else(|| "无法定位数据目录：请在设置中填写 claudeDataDir。".to_string())
        }
    };

    Ok(DataPaths {
        history: pick(&s.history_file, "history.jsonl")?,
        projects: pick(&s.projects_dir, "projects")?,
        sessions: pick(&s.sessions_dir, "sessions")?,
    })
}

/// 读取设置并解析出三个数据源路径（命令层入口）。
pub fn resolve_data_paths(app: &AppHandle) -> Result<DataPaths, String> {
    let (s, _) = load_settings(app);
    resolve_from_settings(&s)
}
