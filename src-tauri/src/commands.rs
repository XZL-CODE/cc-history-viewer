//! 暴露给前端的 Tauri Commands。

use crate::export::{self, ExportParams};
use crate::indexer::{self, AppIndex};
use crate::models::*;
use crate::parser;
use crate::state::{resolve_data_paths, AppState};
use std::path::{Path, PathBuf};
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

/// 按日期范围导出 prompt。
/// write=false 仅生成预览与统计；write=true 额外把完整 Markdown 写入 ~/Downloads。
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn build_prompt_export(
    start_date: String,
    end_date: String,
    project: Option<String>,
    include_commands: bool,
    group_by: Option<String>,
    write: bool,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<ExportResult, String> {
    let start_ms = export::day_start_ms(&start_date)
        .ok_or_else(|| format!("起始日期无法解析：{start_date}"))?;
    let end_ms =
        export::day_end_ms(&end_date).ok_or_else(|| format!("结束日期无法解析：{end_date}"))?;
    if start_ms > end_ms {
        return Err("起始日期不能晚于结束日期。".to_string());
    }
    let group = group_by.unwrap_or_else(|| "project".to_string());

    let data = read_index(&state, &app, |idx| {
        export::build(
            &idx.prompts,
            &ExportParams {
                start_ms,
                end_ms,
                project: project.as_deref(),
                include_commands,
                group_by: &group,
                start_date: &start_date,
                end_date: &end_date,
            },
        )
    })?;

    let mut path: Option<String> = None;
    if write {
        if data.prompt_count == 0 {
            return Err("该范围内没有可导出的 prompt。".to_string());
        }
        let base = format!("CC-Prompts_{start_date}_{end_date}");
        let target = unique_export_path(&base);
        std::fs::write(&target, &data.markdown).map_err(|e| format!("写入文件失败：{e}"))?;
        path = Some(target.to_string_lossy().to_string());
    }

    Ok(ExportResult {
        preview: data.preview(),
        path,
        prompt_count: data.prompt_count,
        folder_count: data.folder_count,
        day_count: data.day_count,
    })
}

/// 在系统文件管理器中定位某个文件（macOS：Finder 选中）。
#[tauri::command]
pub fn reveal_path(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("文件不存在或已被移动。".to_string());
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&p)
            .spawn()
            .map_err(|e| format!("无法打开 Finder：{e}"))?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg("/select,")
            .arg(&p)
            .spawn()
            .map_err(|e| format!("无法打开资源管理器：{e}"))?;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let dir = p.parent().unwrap_or(&p);
        std::process::Command::new("xdg-open")
            .arg(dir)
            .spawn()
            .map_err(|e| format!("无法打开文件管理器：{e}"))?;
    }
    Ok(())
}

/// 下载目录下生成不冲突的导出文件路径：base.md → base (2).md → …
fn unique_export_path(base: &str) -> PathBuf {
    let dir = dirs::download_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| PathBuf::from("."));
    let mut candidate = dir.join(format!("{base}.md"));
    let mut n = 2;
    while candidate.exists() {
        candidate = dir.join(format!("{base} ({n}).md"));
        n += 1;
    }
    candidate
}
