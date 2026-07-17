//! Opt-in smoke test against the developer's real local Claude Code and Codex data.
//!
//! This test never supplies a cache path, never renders prompt text, and checks only
//! aggregate invariants. Run it explicitly with `RUN_REAL_DATA_SMOKE=1 cargo test
//! --test real_data_smoke -- --ignored`.

use cc_history_viewer_lib::indexer;
use cc_history_viewer_lib::models::{Agent, AgentFilter, AppStats, UsageStats};
use cc_history_viewer_lib::state::{self, DataPaths};
use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

#[derive(PartialEq, Eq)]
struct FileStamp {
    path: PathBuf,
    len: u64,
    modified: Option<SystemTime>,
}

fn collect_matching(
    root: &Path,
    extension: &str,
    required_prefix: Option<&str>,
    cutoff: SystemTime,
    output: &mut Vec<FileStamp>,
) {
    if !root.is_dir() {
        return;
    }
    for entry in walkdir::WalkDir::new(root)
        .into_iter()
        .filter_map(Result::ok)
    {
        let path = entry.path();
        let name_matches = required_prefix.map_or(true, |prefix| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with(prefix))
        });
        if !path.is_file()
            || path.extension().and_then(|value| value.to_str()) != Some(extension)
            || !name_matches
        {
            continue;
        }
        let Ok(metadata) = fs::metadata(path) else {
            continue;
        };
        let modified = metadata.modified().ok();
        if modified.is_some_and(|time| time > cutoff) {
            continue;
        }
        output.push(FileStamp {
            path: path.to_path_buf(),
            len: metadata.len(),
            modified,
        });
    }
}

fn stable_source_snapshot(paths: &DataPaths, cutoff: SystemTime) -> Vec<FileStamp> {
    let mut output = Vec::new();
    for history in [&paths.claude.history, &paths.codex.history] {
        let Ok(metadata) = fs::metadata(history) else {
            continue;
        };
        let modified = metadata.modified().ok();
        if modified.map_or(true, |time| time <= cutoff) {
            output.push(FileStamp {
                path: history.clone(),
                len: metadata.len(),
                modified,
            });
        }
    }
    collect_matching(&paths.claude.projects, "jsonl", None, cutoff, &mut output);
    collect_matching(&paths.claude.sessions, "json", None, cutoff, &mut output);
    collect_matching(
        &paths.codex.sessions,
        "jsonl",
        Some("rollout-"),
        cutoff,
        &mut output,
    );
    collect_matching(
        &paths.codex.archived_sessions,
        "jsonl",
        None,
        cutoff,
        &mut output,
    );
    output.sort_by(|left, right| left.path.cmp(&right.path));
    output
}

fn assert_usage_additive(all: &UsageStats, claude: &UsageStats, codex: &UsageStats) {
    assert_eq!(
        all.uncached_input,
        claude.uncached_input + codex.uncached_input
    );
    assert_eq!(all.cache_read, claude.cache_read + codex.cache_read);
    assert_eq!(
        all.cache_creation,
        claude.cache_creation + codex.cache_creation
    );
    assert_eq!(all.output, claude.output + codex.output);
    assert_eq!(
        all.reasoning_output,
        claude.reasoning_output + codex.reasoning_output
    );
    assert_eq!(
        all.total_tokens_including_cache,
        claude.total_tokens_including_cache + codex.total_tokens_including_cache
    );
    assert_eq!(
        all.unknown_model_tokens,
        claude.unknown_model_tokens + codex.unknown_model_tokens
    );
    assert_eq!(
        all.assistant_messages,
        claude.assistant_messages + codex.assistant_messages
    );
    assert!(
        (all.est_cost_usd - claude.est_cost_usd - codex.est_cost_usd).abs() < 1e-8,
        "combined known-price cost is not additive"
    );
}

fn assert_stats_additive(all: &AppStats, claude: &AppStats, codex: &AppStats) {
    assert_eq!(
        all.total_prompts,
        claude.total_prompts + codex.total_prompts
    );
    assert_eq!(
        all.total_sessions,
        claude.total_sessions + codex.total_sessions
    );
    assert_eq!(
        all.total_messages,
        claude.total_messages + codex.total_messages
    );
    assert_eq!(
        all.history_prompts,
        claude.history_prompts + codex.history_prompts
    );
    assert_eq!(
        all.conversation_prompts,
        claude.conversation_prompts + codex.conversation_prompts
    );
    assert_eq!(
        all.command_count,
        claude.command_count + codex.command_count
    );
    assert_usage_additive(&all.usage, &claude.usage, &codex.usage);
}

#[test]
#[ignore = "reads the developer's local agent history; opt in with RUN_REAL_DATA_SMOKE=1"]
fn real_sources_are_read_only_and_merged_aggregates_are_consistent() {
    if std::env::var("RUN_REAL_DATA_SMOKE").as_deref() != Ok("1") {
        return;
    }

    let paths = state::resolve_from_settings(&Default::default())
        .unwrap_or_else(|_| panic!("unable to resolve local agent data roots"));
    assert!(
        paths.claude.history.is_file() && paths.claude.projects.is_dir(),
        "local Claude Code data is unavailable"
    );
    assert!(
        paths.codex.history.is_file() && paths.codex.sessions.is_dir(),
        "local Codex data is unavailable"
    );

    // Ignore files active in the last ten minutes because the CLIs may append to
    // their current rollout while this independent read-only smoke test runs.
    let cutoff = SystemTime::now()
        .checked_sub(Duration::from_secs(10 * 60))
        .unwrap_or(SystemTime::UNIX_EPOCH);
    let before = stable_source_snapshot(&paths, cutoff);
    assert!(!before.is_empty(), "no stable local source files found");

    let index = indexer::load_or_build(&paths, None);
    let all = index.stats_for(AgentFilter::All);
    let claude = index.stats_for(AgentFilter::Claude);
    let codex = index.stats_for(AgentFilter::Codex);
    assert!(
        claude.total_prompts > 0,
        "Claude Code prompt index is empty"
    );
    assert!(codex.total_prompts > 0, "Codex prompt index is empty");
    assert_stats_additive(all, claude, codex);

    let claude_projects: BTreeSet<&str> = index
        .projects_for(AgentFilter::Claude)
        .iter()
        .map(|project| project.path.as_str())
        .collect();
    let codex_projects: BTreeSet<&str> = index
        .projects_for(AgentFilter::Codex)
        .iter()
        .map(|project| project.path.as_str())
        .collect();
    let expected_projects: BTreeSet<&str> =
        claude_projects.union(&codex_projects).copied().collect();
    let all_projects: BTreeSet<&str> = index
        .projects_for(AgentFilter::All)
        .iter()
        .map(|project| project.path.as_str())
        .collect();
    assert!(
        all_projects == expected_projects,
        "merged project union is inconsistent"
    );
    assert_eq!(all.total_projects, all_projects.len());

    assert!(index
        .prompts
        .iter()
        .all(|prompt| matches!(prompt.agent, Agent::Claude | Agent::Codex)));
    for usage in [&all.usage, &claude.usage, &codex.usage] {
        assert_eq!(
            usage.total_tokens_including_cache,
            usage.uncached_input + usage.cache_read + usage.cache_creation + usage.output
        );
        assert!(usage.reasoning_output <= usage.output);
    }

    let after = stable_source_snapshot(&paths, cutoff);
    assert!(
        before == after,
        "stable source metadata changed during read-only smoke test"
    );
}
