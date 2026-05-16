//! 索引构建：扫描数据源、合并去重 prompt、聚合项目、计算统计、磁盘缓存。

use crate::models::*;
use crate::parser::{self, ConvFileResult, RawPrompt};
use crate::state::DataPaths;
use chrono::{Datelike, Local, TimeZone, Timelike};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// 同一文本在此时间窗内（毫秒）视为同一条 prompt，用于跨数据源去重
const DEDUP_WINDOW_MS: i64 = 5 * 60 * 1000;

/// 构建好的全量索引（同时作为磁盘缓存的结构）
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppIndex {
    pub prompts: Vec<PromptEntry>,
    pub projects: Vec<ProjectInfo>,
    pub sessions: Vec<SessionSummary>,
    pub stats: AppStats,
    /// sessionId -> 对话文件绝对路径
    pub session_files: HashMap<String, String>,
    /// 数据源文件 -> mtime(ms)，用于缓存有效性校验
    pub source_fingerprint: HashMap<String, i64>,
    pub built_at: i64,
    /// 是否来自缓存（不参与序列化）
    #[serde(skip)]
    pub from_cache: bool,
}

// ----------------------------- 公共入口 -----------------------------

/// 优先读缓存；数据源有变化则重建。
pub fn load_or_build(paths: &DataPaths, cache_path: Option<&Path>) -> AppIndex {
    let conv_files = collect_jsonl_files(&paths.projects);
    let fingerprint = compute_fingerprint(&paths.history, &conv_files);

    if let Some(cp) = cache_path {
        if let Ok(text) = fs::read_to_string(cp) {
            if let Ok(mut cached) = serde_json::from_str::<AppIndex>(&text) {
                if cached.source_fingerprint == fingerprint {
                    cached.from_cache = true;
                    return cached;
                }
            }
        }
    }

    let idx = build(paths, conv_files, fingerprint);
    if let Some(cp) = cache_path {
        write_cache(cp, &idx);
    }
    idx
}

/// 强制重建并刷新缓存。
pub fn build_and_cache(paths: &DataPaths, cache_path: Option<&Path>) -> AppIndex {
    let conv_files = collect_jsonl_files(&paths.projects);
    let fingerprint = compute_fingerprint(&paths.history, &conv_files);
    let idx = build(paths, conv_files, fingerprint);
    if let Some(cp) = cache_path {
        write_cache(cp, &idx);
    }
    idx
}

// ----------------------------- 构建主流程 -----------------------------

fn build(
    paths: &DataPaths,
    conv_files: Vec<PathBuf>,
    fingerprint: HashMap<String, i64>,
) -> AppIndex {
    // 1. history.jsonl
    let history_prompts = parser::parse_history(&paths.history);

    // 2. 并行解析全部对话文件
    let mut conv_results: Vec<ConvFileResult> = conv_files
        .par_iter()
        .filter_map(|p| parser::parse_conversation_file(p))
        .collect();

    // 3. cwd 缺失的会话用「真实路径字典」兜底解码目录名
    resolve_missing_projects(&history_prompts, &mut conv_results);

    // 4. 合并 + 去重 prompt
    let prompts = merge_prompts(history_prompts, &conv_results);

    // 5. sessionId -> 文件路径
    let mut session_files = HashMap::new();
    for cr in &conv_results {
        session_files.insert(
            cr.session_id.clone(),
            cr.path.to_string_lossy().to_string(),
        );
    }

    // 6. 项目聚合
    let projects = aggregate_projects(&prompts, &conv_results);

    // 7. 会话摘要
    let sessions = build_sessions(&conv_results);

    // 8. 统计
    let stats = compute_stats(&prompts, &conv_results, &paths.sessions, projects.len());

    AppIndex {
        prompts,
        projects,
        sessions,
        stats,
        session_files,
        source_fingerprint: fingerprint,
        built_at: now_ms(),
        from_cache: false,
    }
}

/// 用 history 与对话文件里的真实路径，反查 cwd 缺失会话的项目路径。
fn resolve_missing_projects(history: &[RawPrompt], conv: &mut [ConvFileResult]) {
    let mut real_paths: HashSet<String> = HashSet::new();
    for rp in history {
        real_paths.insert(rp.project.clone());
    }
    for cr in conv.iter() {
        if let Some(p) = &cr.project {
            real_paths.insert(p.clone());
        }
    }
    // 编码目录名 -> 真实路径
    let decode_dict: HashMap<String, String> = real_paths
        .iter()
        .map(|p| (p.replace('/', "-"), p.clone()))
        .collect();

    for cr in conv.iter_mut() {
        if cr.project.is_some() {
            continue;
        }
        let dir_name = cr
            .path
            .parent()
            .and_then(|d| d.file_name())
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        let resolved = decode_dict
            .get(&dir_name)
            .cloned()
            .unwrap_or_else(|| naive_decode(&dir_name));
        for up in cr.user_prompts.iter_mut() {
            if up.project.is_empty() {
                up.project = resolved.clone();
            }
        }
        cr.project = Some(resolved);
    }
}

/// 兜底解码：把 '-' 当作 '/'（中文路径无法精确还原，仅极少数缺失 cwd 的旧会话会用到）
fn naive_decode(encoded: &str) -> String {
    if encoded.is_empty() {
        return encoded.to_string();
    }
    encoded.replace('-', "/")
}

// ----------------------------- prompt 合并去重 -----------------------------

fn is_command(text: &str) -> bool {
    text.starts_with('/')
}

fn merge_prompts(history: Vec<RawPrompt>, conv: &[ConvFileResult]) -> Vec<PromptEntry> {
    let mut all: Vec<RawPrompt> = history;
    for cr in conv {
        all.extend(cr.user_prompts.iter().cloned());
    }

    // 按 (项目, 文本) 分组
    let mut groups: HashMap<(String, String), Vec<RawPrompt>> = HashMap::new();
    for rp in all {
        if rp.text.is_empty() || rp.project.is_empty() {
            continue;
        }
        groups
            .entry((rp.project.clone(), rp.text.clone()))
            .or_default()
            .push(rp);
    }

    let mut entries: Vec<PromptEntry> = Vec::new();
    for ((project, text), mut items) in groups {
        items.sort_by_key(|r| r.timestamp);
        let mut i = 0;
        while i < items.len() {
            let base_ts = items[i].timestamp;
            let mut j = i;
            let mut has_history = false;
            let mut has_conv = false;
            let mut session_id: Option<String> = None;
            let mut git_branch: Option<String> = None;
            let mut pasted = 0usize;
            // 把时间相近的同文本条目聚成一条
            while j < items.len() && items[j].timestamp - base_ts <= DEDUP_WINDOW_MS {
                let it = &items[j];
                if it.from_history {
                    has_history = true;
                } else {
                    has_conv = true;
                }
                if session_id.is_none() {
                    session_id = it.session_id.clone();
                }
                if git_branch.is_none() {
                    git_branch = it.git_branch.clone();
                }
                pasted = pasted.max(it.pasted_count);
                j += 1;
            }
            let source = match (has_history, has_conv) {
                (true, true) => "both",
                (true, false) => "history",
                _ => "conversation",
            };
            entries.push(PromptEntry {
                id: make_id(&project, base_ts, &text),
                text: text.clone(),
                project: project.clone(),
                timestamp: base_ts,
                source: source.to_string(),
                session_id,
                git_branch,
                is_command: is_command(&text),
                pasted_count: pasted,
                char_count: text.chars().count(),
            });
            i = j;
        }
    }

    entries.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    entries
}

fn make_id(project: &str, ts: i64, text: &str) -> String {
    use std::hash::{Hash, Hasher};
    let mut h = std::collections::hash_map::DefaultHasher::new();
    project.hash(&mut h);
    ts.hash(&mut h);
    text.hash(&mut h);
    format!("{:016x}", h.finish())
}

// ----------------------------- 项目 / 会话聚合 -----------------------------

fn project_name(path: &str) -> String {
    let trimmed = path.trim_end_matches('/');
    match trimmed.rsplit('/').next() {
        Some(s) if !s.is_empty() => s.to_string(),
        _ => path.to_string(),
    }
}

fn aggregate_projects(prompts: &[PromptEntry], conv: &[ConvFileResult]) -> Vec<ProjectInfo> {
    let mut map: HashMap<String, ProjectInfo> = HashMap::new();
    for p in prompts {
        if p.project.is_empty() {
            continue;
        }
        let info = map.entry(p.project.clone()).or_insert_with(|| ProjectInfo {
            path: p.project.clone(),
            name: project_name(&p.project),
            prompt_count: 0,
            command_count: 0,
            session_count: 0,
            first_active: p.timestamp,
            last_active: p.timestamp,
            has_conversations: false,
        });
        info.prompt_count += 1;
        if p.is_command {
            info.command_count += 1;
        }
        if p.timestamp < info.first_active {
            info.first_active = p.timestamp;
        }
        if p.timestamp > info.last_active {
            info.last_active = p.timestamp;
        }
    }

    // 会话数量与「有对话」标记
    let mut sess_count: HashMap<String, usize> = HashMap::new();
    for cr in conv {
        if let Some(proj) = &cr.project {
            if !proj.is_empty() {
                *sess_count.entry(proj.clone()).or_insert(0) += 1;
            }
        }
    }
    for (proj, cnt) in sess_count {
        match map.get_mut(&proj) {
            Some(info) => {
                info.session_count = cnt;
                info.has_conversations = true;
            }
            None => {
                map.insert(
                    proj.clone(),
                    ProjectInfo {
                        path: proj.clone(),
                        name: project_name(&proj),
                        prompt_count: 0,
                        command_count: 0,
                        session_count: cnt,
                        first_active: 0,
                        last_active: 0,
                        has_conversations: true,
                    },
                );
            }
        }
    }

    let mut list: Vec<ProjectInfo> = map.into_values().collect();
    list.sort_by(|a, b| b.last_active.cmp(&a.last_active));
    list
}

fn build_sessions(conv: &[ConvFileResult]) -> Vec<SessionSummary> {
    let mut out: Vec<SessionSummary> = conv
        .iter()
        .map(|cr| SessionSummary {
            session_id: cr.session_id.clone(),
            project: cr.project.clone().unwrap_or_default(),
            title: if cr.first_prompt.is_empty() {
                "（无 user 消息）".to_string()
            } else {
                cr.first_prompt.clone()
            },
            started_at: cr.started_at,
            ended_at: cr.ended_at,
            message_count: cr.message_count,
            git_branch: cr.git_branch.clone(),
        })
        .collect();
    out.sort_by(|a, b| b.started_at.cmp(&a.started_at));
    out
}

// ----------------------------- 统计 -----------------------------

fn compute_stats(
    prompts: &[PromptEntry],
    conv: &[ConvFileResult],
    sessions_dir: &Path,
    total_projects: usize,
) -> AppStats {
    let mut history_prompts = 0;
    let mut conversation_prompts = 0;
    let mut command_count = 0;
    let mut first_use = i64::MAX;
    let mut last_use = i64::MIN;
    let mut by_day: HashMap<String, usize> = HashMap::new();
    let mut by_hour = [0usize; 24];
    let mut by_weekday = [0usize; 7];
    let mut by_project: HashMap<String, usize> = HashMap::new();

    for p in prompts {
        match p.source.as_str() {
            "history" => history_prompts += 1,
            "conversation" => conversation_prompts += 1,
            "both" => {
                history_prompts += 1;
                conversation_prompts += 1;
            }
            _ => {}
        }
        if p.is_command {
            command_count += 1;
        }
        if p.timestamp < first_use {
            first_use = p.timestamp;
        }
        if p.timestamp > last_use {
            last_use = p.timestamp;
        }
        if let Some(dt) = Local.timestamp_millis_opt(p.timestamp).single() {
            *by_day.entry(dt.format("%Y-%m-%d").to_string()).or_insert(0) += 1;
            by_hour[dt.hour() as usize] += 1;
            by_weekday[dt.weekday().num_days_from_monday() as usize] += 1;
        }
        if !p.project.is_empty() {
            *by_project.entry(p.project.clone()).or_insert(0) += 1;
        }
    }
    if first_use == i64::MAX {
        first_use = 0;
    }
    if last_use == i64::MIN {
        last_use = 0;
    }

    let mut by_day_vec: Vec<DayCount> = by_day
        .into_iter()
        .map(|(day, count)| DayCount { day, count })
        .collect();
    by_day_vec.sort_by(|a, b| a.day.cmp(&b.day));

    let by_hour_vec: Vec<HourCount> = (0..24)
        .map(|h| HourCount {
            hour: h as u8,
            count: by_hour[h],
        })
        .collect();
    let by_weekday_vec: Vec<WeekdayCount> = (0..7)
        .map(|w| WeekdayCount {
            weekday: w as u8,
            count: by_weekday[w],
        })
        .collect();

    let mut top_projects: Vec<ProjectCount> = by_project
        .into_iter()
        .map(|(path, count)| ProjectCount {
            name: project_name(&path),
            path,
            count,
        })
        .collect();
    top_projects.sort_by(|a, b| b.count.cmp(&a.count));
    top_projects.truncate(8);

    // CC 版本：对话文件 + sessions 元数据
    let mut versions: HashSet<String> = HashSet::new();
    for cr in conv {
        if let Some(v) = &cr.version {
            if !v.is_empty() {
                versions.insert(v.clone());
            }
        }
    }
    collect_session_versions(sessions_dir, &mut versions);
    let mut cc_versions: Vec<String> = versions.into_iter().collect();
    cc_versions.sort_by(|a, b| version_cmp(b, a)); // 新 -> 旧

    let total_messages: usize = conv.iter().map(|c| c.message_count).sum();

    AppStats {
        total_prompts: prompts.len(),
        total_projects,
        total_sessions: conv.len(),
        total_messages,
        history_prompts,
        conversation_prompts,
        command_count,
        first_use,
        last_use,
        by_day: by_day_vec,
        by_hour: by_hour_vec,
        by_weekday: by_weekday_vec,
        top_projects,
        cc_versions,
    }
}

fn version_cmp(a: &str, b: &str) -> std::cmp::Ordering {
    let pa: Vec<u32> = a.split('.').map(|s| s.parse().unwrap_or(0)).collect();
    let pb: Vec<u32> = b.split('.').map(|s| s.parse().unwrap_or(0)).collect();
    pa.cmp(&pb)
}

fn collect_session_versions(sessions_dir: &Path, versions: &mut HashSet<String>) {
    if !sessions_dir.is_dir() {
        return;
    }
    if let Ok(entries) = fs::read_dir(sessions_dir) {
        for e in entries.filter_map(|e| e.ok()) {
            let p = e.path();
            if p.extension().map(|x| x == "json").unwrap_or(false) {
                if let Ok(txt) = fs::read_to_string(&p) {
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&txt) {
                        if let Some(ver) = v.get("version").and_then(|x| x.as_str()) {
                            if !ver.is_empty() {
                                versions.insert(ver.to_string());
                            }
                        }
                    }
                }
            }
        }
    }
}

// ----------------------------- 搜索 -----------------------------

/// 子串 + 大小写不敏感 + 空格分词（多关键词 AND）的模糊搜索。
pub fn search(
    prompts: &[PromptEntry],
    query: &str,
    project_filter: Option<&str>,
    include_commands: bool,
) -> Vec<SearchResult> {
    let tokens: Vec<Vec<char>> = query
        .split_whitespace()
        .map(|t| t.chars().map(|c| c.to_ascii_lowercase()).collect::<Vec<char>>())
        .filter(|t| !t.is_empty())
        .collect();
    if tokens.is_empty() {
        return Vec::new();
    }

    let mut results = Vec::new();
    for p in prompts {
        if let Some(pf) = project_filter {
            if p.project != pf {
                continue;
            }
        }
        if !include_commands && p.is_command {
            continue;
        }
        let lower: Vec<char> = p.text.chars().map(|c| c.to_ascii_lowercase()).collect();
        let mut ranges: Vec<[usize; 2]> = Vec::new();
        let mut matched_all = true;
        for tok in &tokens {
            let occ = find_all(&lower, tok);
            if occ.is_empty() {
                matched_all = false;
                break;
            }
            for s in occ {
                ranges.push([s, s + tok.len()]);
            }
        }
        if !matched_all {
            continue;
        }
        results.push(SearchResult {
            entry: p.clone(),
            match_ranges: merge_ranges(ranges),
        });
    }
    results
}

fn find_all(haystack: &[char], needle: &[char]) -> Vec<usize> {
    let mut out = Vec::new();
    if needle.is_empty() || needle.len() > haystack.len() {
        return out;
    }
    let max = haystack.len() - needle.len();
    let mut i = 0;
    while i <= max {
        if haystack[i..].starts_with(needle) {
            out.push(i);
            i += needle.len();
        } else {
            i += 1;
        }
    }
    out
}

fn merge_ranges(mut ranges: Vec<[usize; 2]>) -> Vec<[usize; 2]> {
    if ranges.is_empty() {
        return ranges;
    }
    ranges.sort();
    let mut merged: Vec<[usize; 2]> = Vec::new();
    for r in ranges {
        if let Some(last) = merged.last_mut() {
            if r[0] <= last[1] {
                if r[1] > last[1] {
                    last[1] = r[1];
                }
                continue;
            }
        }
        merged.push(r);
    }
    merged
}

// ----------------------------- 文件 / 缓存工具 -----------------------------

fn collect_jsonl_files(dir: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    if !dir.is_dir() {
        return files;
    }
    for entry in walkdir::WalkDir::new(dir)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let p = entry.path();
        if p.is_file() && p.extension().map(|e| e == "jsonl").unwrap_or(false) {
            files.push(p.to_path_buf());
        }
    }
    files
}

fn compute_fingerprint(history: &Path, conv_files: &[PathBuf]) -> HashMap<String, i64> {
    let mut fp = HashMap::new();
    if history.exists() {
        fp.insert(
            history.to_string_lossy().to_string(),
            file_mtime_ms(history),
        );
    }
    for f in conv_files {
        fp.insert(f.to_string_lossy().to_string(), file_mtime_ms(f));
    }
    fp
}

fn file_mtime_ms(p: &Path) -> i64 {
    fs::metadata(p)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn write_cache(cache_path: &Path, idx: &AppIndex) {
    if let Some(parent) = cache_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string(idx) {
        let _ = fs::write(cache_path, json);
    }
}

pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
