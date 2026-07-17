# Synthetic Codex fixture

This directory contains fabricated JSONL records only. It must never be replaced with files copied from a real `CODEX_HOME`.

Coverage:

- `history.jsonl`: seconds and milliseconds timestamps, session association, a damaged line, and a record missing prompt text.
- `rollout-current.jsonl`: current metadata and event shapes, duplicate injected `response_item` user content, two `turn_context` models, assistant messages, function/custom tools, `last_token_usage` versus cumulative totals, an unknown event, and recovery after a damaged line.
- `rollout-legacy.jsonl`: no `event_msg`, `turn_context`, or token event; only the real legacy user message may survive fallback filtering.
- `rollout-fork-original.jsonl` and `rollout-fork-copy.jsonl`: the same copied token event under different file and session identities, which must count once.
- `rollout-distinct-same-usage.jsonl`: the same numeric usage in a different event, which must still count.
- `rollout-subagent.jsonl`: an automatic subagent prompt excluded from default prompt/session statistics while its model usage remains included under `/synthetic/project-subagent`.
- `archived_sessions/synthetic-archived.jsonl`: discovery of an archived `.jsonl` whose name does not use the live-session `rollout-` prefix, plus parsing outside the dated session tree.
- `cases/rollout-mixed.jsonl`: a direct-parser case that transitions from legacy `response_item` prompts to current `event_msg` prompts, deduplicates the transition prompt, rejects later legacy fallback records, and covers current tool-search and image-generation detail shapes. Files under `cases/` are intentionally outside index discovery.

For the first current token event, normalized usage is `uncachedInput=600`, `cacheRead=400`, `cacheCreation=0`, `output=200`, and `reasoningOutput=50`; total tokens including cache is `1200`. The much larger `total_token_usage` object is cumulative and must be ignored.
