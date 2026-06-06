//! Prompt 导出：在已构建的索引上做「时间范围过滤 + 排序 + Markdown 拼接」。
//! 不重新解析任何 JSONL —— 数据全部来自 indexer 产出的 PromptEntry。

use crate::models::PromptEntry;
use chrono::{Datelike, Local, NaiveDate, TimeZone};
use std::collections::HashMap;

/// 单条 prompt 正文超过此字符数仍原样保留（导出追求「完整」，不截断）。
/// 仅用于在「预览」里限制返回给前端的长度。
const PREVIEW_MAX_CHARS: usize = 12_000;

/// 导出参数
pub struct ExportParams<'a> {
    pub start_ms: i64,
    pub end_ms: i64,
    pub project: Option<&'a str>,
    pub include_commands: bool,
    /// "project" | "day" | "none"
    pub group_by: &'a str,
    /// 展示用的日期范围（YYYY-MM-DD）
    pub start_date: &'a str,
    pub end_date: &'a str,
}

/// 导出产物
pub struct ExportData {
    pub markdown: String,
    pub prompt_count: usize,
    pub folder_count: usize,
    pub day_count: usize,
}

impl ExportData {
    /// 截断到预览上限，超出时追加省略提示。
    pub fn preview(&self) -> String {
        if self.markdown.chars().count() <= PREVIEW_MAX_CHARS {
            return self.markdown.clone();
        }
        let head: String = self.markdown.chars().take(PREVIEW_MAX_CHARS).collect();
        format!("{head}\n\n…（预览已截断，导出的文件包含全部内容）")
    }
}

/// 把 YYYY-MM-DD 解析为本地时区当天 00:00:00 的毫秒时间戳。
pub fn day_start_ms(date: &str) -> Option<i64> {
    let d = NaiveDate::parse_from_str(date.trim(), "%Y-%m-%d").ok()?;
    let naive = d.and_hms_opt(0, 0, 0)?;
    Local
        .from_local_datetime(&naive)
        .single()
        .map(|dt| dt.timestamp_millis())
}

/// 把 YYYY-MM-DD 解析为本地时区当天 23:59:59.999 的毫秒时间戳。
pub fn day_end_ms(date: &str) -> Option<i64> {
    let d = NaiveDate::parse_from_str(date.trim(), "%Y-%m-%d").ok()?;
    let naive = d.and_hms_milli_opt(23, 59, 59, 999)?;
    Local
        .from_local_datetime(&naive)
        .single()
        .map(|dt| dt.timestamp_millis())
}

/// 主入口：从全量 prompt 里过滤并生成 Markdown。
pub fn build(prompts: &[PromptEntry], p: &ExportParams) -> ExportData {
    // 1. 过滤：时间范围 + 文件夹 + 命令开关
    let mut items: Vec<&PromptEntry> = prompts
        .iter()
        .filter(|e| e.timestamp >= p.start_ms && e.timestamp <= p.end_ms)
        .filter(|e| p.project.map_or(true, |pf| e.project == pf))
        .filter(|e| p.include_commands || !e.is_command)
        .collect();
    items.sort_by_key(|e| e.timestamp);

    // 2. 统计
    let prompt_count = items.len();
    let mut day_set = std::collections::HashSet::new();
    let mut folder_set = std::collections::HashSet::new();
    for e in &items {
        day_set.insert(day_key(e.timestamp));
        folder_set.insert(e.project.clone());
    }
    let day_count = day_set.len();
    let folder_count = folder_set.len();

    // 3. 头部
    let mut md = String::new();
    md.push_str("# Claude Code Prompt 导出\n\n");
    md.push_str(&format!(
        "> **时间范围**　{} ~ {}\n",
        p.start_date, p.end_date
    ));
    md.push_str(&format!(
        "> **共**　{prompt_count} 条 prompt · {folder_count} 个文件夹 · 跨 {day_count} 天\n"
    ));
    md.push_str(&format!("> **导出于**　{}\n\n", now_label()));

    if items.is_empty() {
        md.push_str("---\n\n_该范围内没有 prompt。_\n");
        return ExportData {
            markdown: md,
            prompt_count,
            folder_count,
            day_count,
        };
    }

    md.push_str("---\n\n");

    // 4. 正文
    match p.group_by {
        "day" => render_by_day(&mut md, &items),
        "none" => render_flat(&mut md, &items),
        _ => render_by_project(&mut md, &items),
    }

    ExportData {
        markdown: md,
        prompt_count,
        folder_count,
        day_count,
    }
}

// ----------------------------- 分组渲染 -----------------------------

/// 按文件夹分组：文件夹按 prompt 数量倒序，文件夹内按时间正序，正文完整保留。
fn render_by_project(md: &mut String, items: &[&PromptEntry]) {
    // 保持首次出现顺序收集分组，再按数量倒序
    let mut order: Vec<String> = Vec::new();
    let mut groups: HashMap<String, Vec<&PromptEntry>> = HashMap::new();
    for e in items {
        let key = e.project.clone();
        if !groups.contains_key(&key) {
            order.push(key.clone());
        }
        groups.entry(key).or_default().push(e);
    }
    order.sort_by(|a, b| groups[b].len().cmp(&groups[a].len()));

    for (i, proj) in order.iter().enumerate() {
        let list = &groups[proj];
        md.push_str(&format!("## 📁 {}\n\n", project_name(proj)));
        md.push_str(&format!("`{}` · {} 条\n\n", pretty_path(proj), list.len()));
        for e in list.iter() {
            // 文件夹内可能跨年，时间带上完整年份避免歧义
            push_prompt(md, e, "%Y-%m-%d %H:%M");
        }
        if i + 1 < order.len() {
            md.push_str("---\n\n");
        }
    }
}

/// 按天分组：每天一个 ## 标题，天内按时间正序。
fn render_by_day(md: &mut String, items: &[&PromptEntry]) {
    let mut order: Vec<String> = Vec::new();
    let mut groups: HashMap<String, Vec<&PromptEntry>> = HashMap::new();
    for e in items {
        let key = day_key(e.timestamp);
        if !groups.contains_key(&key) {
            order.push(key.clone());
        }
        groups.entry(key).or_default().push(e);
    }
    // items 已按时间升序，order 自然是日期升序
    for (i, day) in order.iter().enumerate() {
        let list = &groups[day];
        md.push_str(&format!(
            "## {} {}（{} 条）\n\n",
            day,
            weekday_zh(list[0].timestamp),
            list.len()
        ));
        for e in list.iter() {
            push_prompt(md, e, "%H:%M");
        }
        if i + 1 < order.len() {
            md.push_str("---\n\n");
        }
    }
}

/// 纯时间线：全局按时间正序。
fn render_flat(md: &mut String, items: &[&PromptEntry]) {
    for e in items {
        let when = fmt_time(e.timestamp, "%Y-%m-%d %H:%M");
        md.push_str(&format!("**{when}**{}\n\n", meta_suffix(e)));
        md.push_str(&format!("{}\n\n", e.text.trim()));
    }
}

/// 渲染单条 prompt：粗体时间 + 元信息标记，空行，完整正文。
fn push_prompt(md: &mut String, e: &PromptEntry, time_fmt: &str) {
    let when = fmt_time(e.timestamp, time_fmt);
    md.push_str(&format!("**{when}**{}\n\n", meta_suffix(e)));
    md.push_str(&format!("{}\n\n", e.text.trim()));
}

/// 时间后缀：分支 / 命令 / 粘贴标记。
fn meta_suffix(e: &PromptEntry) -> String {
    let mut s = String::new();
    if let Some(b) = &e.git_branch {
        if !b.is_empty() {
            s.push_str(&format!(" · `{b}`"));
        }
    }
    if e.is_command {
        s.push_str(" · 命令");
    }
    if e.pasted_count > 0 {
        s.push_str(&format!(" · 含 {} 段粘贴", e.pasted_count));
    }
    s
}

// ----------------------------- 时间 / 路径工具 -----------------------------

fn fmt_time(ts: i64, fmt: &str) -> String {
    Local
        .timestamp_millis_opt(ts)
        .single()
        .map(|dt| dt.format(fmt).to_string())
        .unwrap_or_default()
}

fn day_key(ts: i64) -> String {
    fmt_time(ts, "%Y-%m-%d")
}

fn weekday_zh(ts: i64) -> &'static str {
    let idx = Local
        .timestamp_millis_opt(ts)
        .single()
        .map(|dt| dt.weekday().num_days_from_monday())
        .unwrap_or(0);
    match idx {
        0 => "周一",
        1 => "周二",
        2 => "周三",
        3 => "周四",
        4 => "周五",
        5 => "周六",
        _ => "周日",
    }
}

fn now_label() -> String {
    Local::now().format("%Y-%m-%d %H:%M").to_string()
}

/// 取路径末级目录名作为展示名。
fn project_name(path: &str) -> String {
    let trimmed = path.trim_end_matches('/');
    match trimmed.rsplit('/').next() {
        Some(s) if !s.is_empty() => s.to_string(),
        _ => path.to_string(),
    }
}

/// /Users/xxx/... → ~/...
fn pretty_path(path: &str) -> String {
    if let Some(home) = dirs::home_dir() {
        let home = home.to_string_lossy().to_string();
        if let Some(rest) = path.strip_prefix(&home) {
            return format!("~{rest}");
        }
    }
    path.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mk(project: &str, ts: i64, text: &str, is_command: bool) -> PromptEntry {
        PromptEntry {
            id: format!("{ts}"),
            text: text.to_string(),
            project: project.to_string(),
            timestamp: ts,
            source: "conversation".to_string(),
            session_id: None,
            git_branch: None,
            is_command,
            pasted_count: 0,
            char_count: text.chars().count(),
        }
    }

    fn params<'a>(start: &'a str, end: &'a str, include_commands: bool) -> ExportParams<'a> {
        ExportParams {
            start_ms: day_start_ms(start).unwrap(),
            end_ms: day_end_ms(end).unwrap(),
            project: None,
            include_commands,
            group_by: "project",
            start_date: start,
            end_date: end,
        }
    }

    #[test]
    fn date_bounds_cover_full_local_day() {
        let s = day_start_ms("2026-05-16").unwrap();
        let e = day_end_ms("2026-05-16").unwrap();
        assert_eq!(e - s, 86_399_999, "一天应覆盖 23:59:59.999");
        // 次日 00:00 应紧接当日末尾之后 1ms
        let next = day_start_ms("2026-05-17").unwrap();
        assert_eq!(next - e, 1);
    }

    #[test]
    fn filters_range_and_commands_then_groups_by_count() {
        let d16 = day_start_ms("2026-05-16").unwrap();
        let d17 = day_start_ms("2026-05-17").unwrap();
        let d18 = day_start_ms("2026-05-18").unwrap();
        let prompts = vec![
            mk("/p/alpha", d16 + 3_600_000, "你好，自我介绍一下", false),
            mk("/p/alpha", d16 + 7_200_000, "抽出 parser", false),
            mk("/p/beta", d17 + 1_000, "跑测试", false),
            mk("/p/alpha", d18 + 1_000, "范围外不应出现", false), // 越界
            mk("/p/alpha", d16 + 100, "/clear", true),            // 命令
        ];

        // 默认不含命令
        let out = build(&prompts, &params("2026-05-16", "2026-05-17", false));
        assert_eq!(out.prompt_count, 3);
        assert_eq!(out.folder_count, 2);
        assert_eq!(out.day_count, 2);
        assert!(out.markdown.contains("# Claude Code Prompt 导出"));
        assert!(out.markdown.contains("你好，自我介绍一下"));
        assert!(!out.markdown.contains("范围外不应出现"), "越界 prompt 不应导出");
        assert!(!out.markdown.contains("/clear"), "默认不含命令");
        // alpha(2 条) 应排在 beta(1 条) 之前
        let ia = out.markdown.find("alpha").unwrap();
        let ib = out.markdown.find("beta").unwrap();
        assert!(ia < ib, "数量多的文件夹应在前");

        // 打开命令开关
        let out2 = build(&prompts, &params("2026-05-16", "2026-05-17", true));
        assert_eq!(out2.prompt_count, 4);
        assert!(out2.markdown.contains("/clear"));
        assert!(out2.markdown.contains("命令"));
    }

    #[test]
    fn empty_range_reports_zero() {
        let prompts = vec![mk("/p/a", day_start_ms("2026-01-01").unwrap(), "x", false)];
        let out = build(&prompts, &params("2026-05-16", "2026-05-17", false));
        assert_eq!(out.prompt_count, 0);
        assert!(out.markdown.contains("没有 prompt"));
    }
}
