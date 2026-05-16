//! 暴露给前端的 Tauri Commands。

use crate::indexer::{self, AppIndex};
use crate::models::*;
use crate::parser;
use crate::state::{resolve_data_paths, AppState};
use std::path::Path;
use tauri::{AppHandle, Manager, State};

/// 索引磁盘缓存文件路径
fn cache_file(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|d| d.join("index_cache.json"))
}

/// 确保索引已构建（懒加载）
fn ensure_index(state: &AppState, app: &AppHandle) -> Result<(), String> {
    let mut guard = state.index.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        return Ok(());
    }
    let paths = resolve_data_paths()?;
    if !paths.history.exists() && !paths.projects.exists() {
        return Err(format!(
            "未找到数据源：{} 与 {} 均不存在。请检查项目根目录下的 settings.json 配置。",
            paths.history.display(),
            paths.projects.display()
        ));
    }
    let cache = cache_file(app);
    *guard = Some(indexer::load_or_build(&paths, cache.as_deref()));
    Ok(())
}

/// 在索引上执行只读闭包
fn read_index<F, R>(state: &AppState, app: &AppHandle, f: F) -> Result<R, String>
where
    F: FnOnce(&AppIndex) -> R,
{
    ensure_index(state, app)?;
    let guard = state.index.lock().map_err(|e| e.to_string())?;
    let idx = guard.as_ref().ok_or("索引尚未就绪")?;
    Ok(f(idx))
}

fn sort_prompts(v: &mut [PromptEntry], sort: Option<&str>) {
    match sort {
        Some("oldest") => v.sort_by(|a, b| a.timestamp.cmp(&b.timestamp)),
        Some("longest") => v.sort_by(|a, b| b.char_count.cmp(&a.char_count)),
        _ => v.sort_by(|a, b| b.timestamp.cmp(&a.timestamp)),
    }
}

/// 文件夹（项目）列表
#[tauri::command]
pub fn get_projects(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Vec<ProjectInfo>, String> {
    read_index(&state, &app, |idx| idx.projects.clone())
}

/// 指定文件夹下的 prompt 列表
#[tauri::command]
pub fn get_project_prompts(
    project: String,
    sort: Option<String>,
    include_commands: Option<bool>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Vec<PromptEntry>, String> {
    let inc = include_commands.unwrap_or(true);
    read_index(&state, &app, |idx| {
        let mut v: Vec<PromptEntry> = idx
            .prompts
            .iter()
            .filter(|p| p.project == project)
            .filter(|p| inc || !p.is_command)
            .cloned()
            .collect();
        sort_prompts(&mut v, sort.as_deref());
        v
    })
}

/// 全局最近的 prompt（已按时间倒序）
#[tauri::command]
pub fn get_recent_prompts(
    limit: Option<usize>,
    include_commands: Option<bool>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Vec<PromptEntry>, String> {
    let lim = limit.unwrap_or(30);
    let inc = include_commands.unwrap_or(true);
    read_index(&state, &app, |idx| {
        idx.prompts
            .iter()
            .filter(|p| inc || !p.is_command)
            .take(lim)
            .cloned()
            .collect()
    })
}

/// 模糊搜索（全局 / 文件夹内）
#[tauri::command]
pub fn search_prompts(
    query: String,
    project_filter: Option<String>,
    include_commands: Option<bool>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Vec<SearchResult>, String> {
    let inc = include_commands.unwrap_or(true);
    read_index(&state, &app, |idx| {
        indexer::search(&idx.prompts, &query, project_filter.as_deref(), inc)
    })
}

/// 统计信息
#[tauri::command]
pub fn get_stats(state: State<'_, AppState>, app: AppHandle) -> Result<AppStats, String> {
    read_index(&state, &app, |idx| idx.stats.clone())
}

/// 指定文件夹下的会话列表
#[tauri::command]
pub fn get_project_sessions(
    project: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Vec<SessionSummary>, String> {
    read_index(&state, &app, |idx| {
        let mut v: Vec<SessionSummary> = idx
            .sessions
            .iter()
            .filter(|s| s.project == project)
            .cloned()
            .collect();
        v.sort_by(|a, b| b.started_at.cmp(&a.started_at));
        v
    })
}

/// 单个会话的完整对话详情
#[tauri::command]
pub fn get_conversation(
    session_id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<ConversationDetail, String> {
    ensure_index(&state, &app)?;
    let file = {
        let guard = state.index.lock().map_err(|e| e.to_string())?;
        let idx = guard.as_ref().ok_or("索引尚未就绪")?;
        idx.session_files.get(&session_id).cloned()
    };
    let file = file.ok_or_else(|| format!("找不到会话文件：{session_id}"))?;
    parser::parse_conversation_detail(Path::new(&file))
        .ok_or_else(|| "对话文件解析失败".to_string())
}

/// 索引元信息
#[tauri::command]
pub fn get_index_meta(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<IndexMeta, String> {
    read_index(&state, &app, |idx| IndexMeta {
        built_at: idx.built_at,
        from_cache: idx.from_cache,
        source_files: idx.source_fingerprint.len(),
    })
}

/// 强制重建索引
#[tauri::command]
pub fn refresh_index(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<IndexMeta, String> {
    let paths = resolve_data_paths()?;
    let cache = cache_file(&app);
    let idx = indexer::build_and_cache(&paths, cache.as_deref());
    let meta = IndexMeta {
        built_at: idx.built_at,
        from_cache: false,
        source_files: idx.source_fingerprint.len(),
    };
    let mut guard = state.index.lock().map_err(|e| e.to_string())?;
    *guard = Some(idx);
    Ok(meta)
}
