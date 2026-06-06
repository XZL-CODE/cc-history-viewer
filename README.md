<div align="center">

<img src="src-tauri/icons/icon.png" width="120" alt="CC History Viewer" />

# CC History Viewer

**可视化浏览本地 Claude Code 的历史 Prompt 与对话**
**A local, read-only desktop viewer for your Claude Code prompt & conversation history**

[简体中文](#简体中文) · [English](#english)

</div>

---

## 简体中文

一个纯本地、**只读**的桌面工具：扫描 `~/.claude/` 下的数据，按文件夹（项目）聚合你在
Claude Code 里输入过的所有 Prompt，支持全局 / 文件夹内模糊搜索、统计概览与对话详情查看。

### ✨ 功能特性

- **文件夹导航** —— 以「文件夹（项目）」为一级维度，逐条浏览该目录下的全部历史 Prompt
- **双数据源合并** —— `history.jsonl`（输入框历史）与对话文件中的 user 消息合并去重，来源清晰标注
- **模糊搜索** —— 全局 / 当前文件夹两种范围；子串匹配、不区分大小写、空格分词（多关键词 AND）、命中高亮
- **统计概览** —— Prompt 总数、每日活跃度、24 小时分布、最活跃文件夹 Top 榜、CC 版本等
- **对话详情** —— 以聊天气泡查看完整会话，工具调用 / 思考过程可折叠
- **按日期范围导出** —— 选定时间范围，把发给 Claude Code 的每条 Prompt 导出成一份完整 Markdown（按文件夹分组 / 按天 / 时间线三种组织方式），一键保存到 `~/Downloads`
- **斜杠命令过滤** —— 一键显示 / 隐藏 `/clear`、`/model` 等命令
- **深色 / 浅色主题**
- **本地缓存** —— 首次扫描后建立索引并缓存，数据无变化时秒开

### 🧱 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Tauri v2 |
| 前端 | Vite · React 18 · TypeScript · Tailwind CSS v4 |
| 后端 | Rust（JSONL 解析、索引构建、搜索） |
| 其它 | Recharts · React Router · TanStack Query |

### 📂 数据来源（全部只读）

| 来源 | 路径 | 用途 |
|---|---|---|
| Prompt 历史 | `~/.claude/history.jsonl` | 输入框打过的每条 prompt |
| 完整对话 | `~/.claude/projects/<编码路径>/*.jsonl` | 会话消息流、对话详情 |
| 会话元数据 | `~/.claude/sessions/*.json` | 会话状态、CC 版本 |

> ⚠️ 本工具**绝不修改或删除** `~/.claude/` 下任何文件，数据全部在本机处理、不联网上传。

### 🚀 安装与运行

环境要求：Node.js ≥ 18、pnpm ≥ 8、Rust 工具链。Rust 安装见 [Rust 工具链安装指南](./Rust工具链安装指南.md)。

```bash
pnpm install
pnpm tauri dev      # 开发模式（前端 HMR + Rust 自动编译）
pnpm tauri build    # 构建发布版本
```

> 首次 `pnpm tauri dev` 需把 Rust 依赖编译一遍，约几分钟，属正常现象。

### ⚙️ 配置数据源（可选）

默认读取 `~/.claude`。若你的数据不在默认位置，复制 `settings.example.json` 为
`settings.json` 并填写：

| 字段 | 说明 |
|---|---|
| `claudeDataDir` | Claude 数据目录（含 `history.jsonl` / `projects` / `sessions`） |
| `historyFile` / `projectsDir` / `sessionsDir` | 可选，单独覆盖某一项；留空则由 `claudeDataDir` 推导 |

全部留空 = 默认 `~/.claude`。改完保存后，在应用右上角点**刷新**按钮即可生效，无需重新编译。

### 🗂 项目结构

```
src/              React 前端（pages / components / hooks / lib）
src-tauri/src/    Rust 后端（parser 解析 / indexer 索引 / export 导出 / commands 命令）
scripts/          应用图标生成脚本
```

### 🔒 隐私

完全本地运行——不联网、不上传、不采集任何数据；对 `~/.claude` 只读不写。

### 📄 许可证

[MIT](./LICENSE)

---

## English

A fully local, **read-only** desktop tool: it scans the data under `~/.claude/`, aggregates
every prompt you have typed in Claude Code by folder (project), and provides global /
in-folder fuzzy search, statistics, and full conversation views.

### ✨ Features

- **Folder navigation** — browse every historical prompt under a folder (project), the primary navigation dimension
- **Merged data sources** — prompts from `history.jsonl` (input history) and user messages from conversation files are merged & de-duplicated, with the origin clearly labelled
- **Fuzzy search** — global or current-folder scope; substring match, case-insensitive, space-tokenised (multi-keyword AND), with match highlighting
- **Statistics** — total prompts, daily activity, 24-hour distribution, most active folders, Claude Code versions, and more
- **Conversation detail** — view full sessions as chat bubbles; tool calls / thinking blocks are collapsible
- **Date-range export** — pick a date range and export every prompt you sent to Claude Code as a single complete Markdown file (grouped by folder / by day / flat timeline), saved to `~/Downloads` with one click
- **Slash-command filter** — show / hide `/clear`, `/model` and other commands with one click
- **Dark / light theme**
- **Local cache** — an index is built and cached after the first scan; subsequent launches are instant when nothing changed

### 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri v2 |
| Frontend | Vite · React 18 · TypeScript · Tailwind CSS v4 |
| Backend | Rust (JSONL parsing, indexing, search) |
| Others | Recharts · React Router · TanStack Query |

### 📂 Data Sources (read-only)

| Source | Path | Purpose |
|---|---|---|
| Prompt history | `~/.claude/history.jsonl` | every prompt typed into the input box |
| Full conversations | `~/.claude/projects/<encoded-path>/*.jsonl` | message streams & conversation detail |
| Session metadata | `~/.claude/sessions/*.json` | session status, Claude Code version |

> ⚠️ This tool **never modifies or deletes** anything under `~/.claude/`. All data is processed locally and nothing is uploaded.

### 🚀 Getting Started

Requirements: Node.js ≥ 18, pnpm ≥ 8, and the Rust toolchain. See the
[Rust toolchain install guide](./Rust工具链安装指南.md) (Chinese).

```bash
pnpm install
pnpm tauri dev      # development mode (frontend HMR + Rust auto-rebuild)
pnpm tauri build    # build a release bundle
```

> The first `pnpm tauri dev` compiles all Rust dependencies once and may take a few minutes — this is normal.

### ⚙️ Configuration (optional)

By default the app reads `~/.claude`. If your data lives elsewhere, copy
`settings.example.json` to `settings.json` and fill it in:

| Field | Description |
|---|---|
| `claudeDataDir` | the Claude data directory (containing `history.jsonl` / `projects` / `sessions`) |
| `historyFile` / `projectsDir` / `sessionsDir` | optional per-path overrides; left empty they are derived from `claudeDataDir` |

All empty = default `~/.claude`. After editing, click the **refresh** button in the app — no recompilation needed.

### 🗂 Project Structure

```
src/              React frontend (pages / components / hooks / lib)
src-tauri/src/    Rust backend (parser / indexer / export / commands)
scripts/          app icon generator
```

### 🔒 Privacy

Runs entirely on your machine — no network, no upload, no telemetry. `~/.claude` is read only, never written.

### 📄 License

[MIT](./LICENSE)
