//! Golden 测试：用「完全合成」的 fixture 锁定 JSONL 解析行为。
//! Claude Code 的 JSONL 格式是本工具最大的外部依赖——格式一变（或解析逻辑被误改），
//! 这里会第一时间报警。fixture 不含任何真实个人数据。

use cc_history_viewer_lib::parser;
use std::path::PathBuf;

fn fixture(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures")
        .join(name)
}

fn iso_ms(s: &str) -> i64 {
    chrono::DateTime::parse_from_rfc3339(s)
        .unwrap()
        .timestamp_millis()
}

#[test]
fn history_golden() {
    let out = parser::parse_history(&fixture("sample_history.jsonl"));
    assert_eq!(out.len(), 3);

    assert_eq!(out[0].text, "帮我重构 parser 模块");
    assert_eq!(out[0].project, "/Users/dev/alpha");
    assert_eq!(out[0].timestamp, 1747363200000);
    assert_eq!(out[0].session_id.as_deref(), Some("sess-aaaa"));
    assert_eq!(out[0].pasted_count, 0, "空 pastedContents 应为 0");
    assert!(out[0].from_history);

    assert_eq!(out[1].text, "/clear");
    assert!(out[1].session_id.is_none());

    assert_eq!(out[2].project, "/Users/dev/beta");
    assert_eq!(out[2].pasted_count, 1, "pastedContents 有 1 个键");
}

#[test]
fn session_golden() {
    let path = fixture("f1e2d3c4-aaaa-bbbb-cccc-000000000001.jsonl");
    let r = parser::parse_conversation_file(&path).expect("fixture 应能解析");

    // 会话元信息
    assert_eq!(r.session_id, "f1e2d3c4-aaaa-bbbb-cccc-000000000001");
    assert_eq!(r.project.as_deref(), Some("/Users/dev/alpha"));
    assert_eq!(r.git_branch.as_deref(), Some("main"));
    assert_eq!(r.version.as_deref(), Some("2.0.0"));
    assert_eq!(r.started_at, iso_ms("2026-05-16T02:00:00.000Z"));
    assert_eq!(r.ended_at, iso_ms("2026-05-16T02:01:35.000Z"));
    // 8 行 user/assistant 全部计入消息数（含 sidechain 与 tool_result 行）
    assert_eq!(r.message_count, 8);

    // prompt 提取：tool_result-only 与 sidechain 的 user 行不算 prompt；
    // <command-name> 包裹的斜杠命令提取为命令名本身
    let texts: Vec<&str> = r.user_prompts.iter().map(|p| p.text.as_str()).collect();
    assert_eq!(texts, vec!["帮我重构 parser 模块", "/model"]);
    assert_eq!(r.first_prompt, "帮我重构 parser 模块");
    assert!(r.user_prompts.iter().all(|p| p.project == "/Users/dev/alpha"));

    // 用量提取：msg_001 被拆成两行（resume/分块复制场景）只记一次；
    // sidechain 的 assistant 行同样计入用量
    assert_eq!(r.usage_entries.len(), 3);
    let keys: Vec<&str> = r.usage_entries.iter().map(|e| e.dedup_key.as_str()).collect();
    assert_eq!(keys, vec!["msg_001", "msg_002", "msg_003"]);

    let input: u64 = r.usage_entries.iter().map(|e| e.input).sum();
    let output: u64 = r.usage_entries.iter().map(|e| e.output).sum();
    let cache_read: u64 = r.usage_entries.iter().map(|e| e.cache_read).sum();
    let cache_creation: u64 = r.usage_entries.iter().map(|e| e.cache_creation).sum();
    assert_eq!(input, 100 + 10 + 7);
    assert_eq!(output, 200 + 20 + 5);
    assert_eq!(cache_read, 1000);
    assert_eq!(cache_creation, 50);

    assert!(r.usage_entries[0].model.starts_with("claude-sonnet-4-5"));
    assert!(r.usage_entries[1].model.starts_with("claude-opus-4-5"));
}

#[test]
fn session_detail_golden() {
    let path = fixture("f1e2d3c4-aaaa-bbbb-cccc-000000000001.jsonl");
    let d = parser::parse_conversation_detail(&path).expect("fixture 应能解析");

    assert_eq!(d.project, "/Users/dev/alpha");
    assert_eq!(d.messages.len(), 8);

    // 第 1 条：user 文本块
    assert_eq!(d.messages[0].role, "user");
    assert_eq!(d.messages[0].blocks[0].kind, "text");

    // 第 3 条（a-1b）：tool_use 块带工具名
    let tool_msg = &d.messages[2];
    assert_eq!(tool_msg.blocks[0].kind, "tool_use");
    assert_eq!(tool_msg.blocks[0].tool_name.as_deref(), Some("Bash"));

    // sidechain 标记保留
    assert!(d.messages[6].is_sidechain);
}
