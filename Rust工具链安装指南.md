# Rust 工具链安装指南（macOS）

本项目是 Tauri v2 桌面应用，后端用 Rust。运行前你需要在本机装好 Rust 工具链。
Node.js 和 pnpm 你已经装好了（已核对：Node v24.9.0 / pnpm 10.33.4），**不用再装**。

下面的命令请在「终端 App」里逐条执行。

---

## 第 1 步：安装 Xcode Command Line Tools

Tauri 在 macOS 上编译需要苹果的命令行工具（包含 C 编译器、链接器）。

```bash
xcode-select --install
```

- 执行后会弹窗，点「安装」，等它装完（几分钟）。
- 如果提示 `command line tools are already installed`，说明已装好，跳过即可。

---

## 第 2 步：安装 Rust（通过 rustup）

rustup 是 Rust 官方的版本管理器，会一起装好 `rustc`（编译器）和 `cargo`（包管理器）。

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

- 执行后会进入一个交互菜单，**直接按回车**选择默认选项（`1) Proceed with standard installation`）即可。
- 安装包约 1.5GB，视网络情况需要几分钟。

装完后，让当前终端立即生效（或者直接关掉终端重开一个）：

```bash
source "$HOME/.cargo/env"
```

---

## 第 3 步：验证安装

```bash
rustc --version
cargo --version
```

两条命令都能打印出版本号（例如 `rustc 1.8x.0`）就算成功。Tauri v2 需要 Rust ≥ 1.77，rustup 默认装的是最新稳定版，没问题。

> Tauri CLI 不用单独装。本项目已经把 `@tauri-apps/cli` 作为 npm 依赖声明好了，
> 装完前端依赖后用 `pnpm tauri` 就能调用。

---

## 第 4 步：安装项目依赖并启动

在项目根目录（即本文档所在目录）执行：

```bash
# 安装前端依赖
pnpm install

# 启动开发模式（前端 HMR + Rust 自动编译）
pnpm tauri dev
```

> ⚠️ **第一次运行 `pnpm tauri dev` 会很慢**：Rust 需要把 Tauri 及其全部依赖从源码编译一遍，
> 视机器性能大约 3~10 分钟，期间终端会刷一大片 `Compiling xxx` 日志，这是正常的。
> 编译完成后会自动弹出应用窗口。之后再启动会走增量编译，只需几秒。

构建发布版本（可选，自己用一般不需要）：

```bash
pnpm tauri build
```

产物在 `src-tauri/target/release/bundle/` 下（macOS 为 `.app` / `.dmg`）。

---

## 常见问题

| 现象 | 解决办法 |
|---|---|
| `command not found: cargo` | 没执行 `source "$HOME/.cargo/env"`，或重开一个终端窗口 |
| `xcrun: error: invalid active developer path` | 重新执行第 1 步的 `xcode-select --install` |
| `pnpm tauri dev` 卡在 `Compiling` 很久 | 正常，首次编译就是慢，耐心等待，不要中断 |
| 编译报 `linker 'cc' not found` | 第 1 步的 Xcode Command Line Tools 没装好 |
| 网络导致 cargo 拉依赖失败 | 可配置国内镜像（rsproxy / 字节 crates 镜像），或挂代理后重试 |

---

## 一句话总结

```bash
xcode-select --install
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustc --version && cargo --version   # 验证
pnpm install && pnpm tauri dev       # 启动
```
