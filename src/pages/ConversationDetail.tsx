import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Download,
  Folder,
  FolderOpen,
  GitBranch,
  MessageSquare,
  Terminal,
} from "lucide-react";
import { useConversation } from "@/hooks/queries";
import { useCopy } from "@/hooks/useCopy";
import { getCurrentLang, useT } from "@/i18n";
import {
  Badge,
  Button,
  CenterMessage,
  Skeleton,
  Spinner,
} from "@/components/ui";
import type {
  ChatMessage,
  ContentBlock,
  ConversationExportResult,
} from "@/lib/types";
import { absoluteTime, encodePath, formatNumber, prettyPath } from "@/lib/utils";
import { api, errMessage } from "@/lib/api";

function BlockView({ block }: { block: ContentBlock }) {
  const t = useT();
  if (block.kind === "text") {
    return (
      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
        {block.text}
      </div>
    );
  }
  if (block.kind === "image") {
    return (
      <div className="text-xs text-muted">
        🖼 {block.text ?? t("imageFallback")}
      </div>
    );
  }

  const summary =
    block.kind === "tool_use"
      ? t("toolUseLabel", { name: block.toolName ?? "tool" })
      : block.kind === "thinking"
        ? t("thinkingLabel")
        : block.kind === "tool_result"
          ? t("toolResultLabel")
          : block.kind;
  const body =
    block.kind === "tool_use"
      ? JSON.stringify(block.toolInput ?? {}, null, 2)
      : block.text ?? "";

  return (
    <details className="rounded-lg border border-border bg-background">
      <summary className="cursor-pointer select-none px-3 py-1.5 text-xs font-medium text-muted">
        {summary}
      </summary>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words px-3 pb-2.5 text-[11px] leading-relaxed text-muted">
        {body}
      </pre>
    </details>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const t = useT();
  const isUser = msg.role === "user";
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <Badge tone={isUser ? "accent" : "default"}>
          {isUser ? t("roleUser") : "Claude"}
        </Badge>
        {msg.isSidechain && <Badge tone="muted">{t("sidechainBadge")}</Badge>}
        <span className="text-[11px] text-muted">
          {absoluteTime(msg.timestamp)}
        </span>
      </div>
      <div className="space-y-2">
        {msg.blocks.map((b, i) => (
          <BlockView key={i} block={b} />
        ))}
      </div>
    </div>
  );
}

export function ConversationDetail() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const t = useT();
  const { data, isLoading, isError, error } = useConversation(
    sessionId ?? null
  );
  const { copied, copy } = useCopy();

  // 导出 Markdown
  const [exportOpen, setExportOpen] = useState(false);
  const [includeTools, setIncludeTools] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] =
    useState<ConversationExportResult | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!data || exporting) return;
    setExporting(true);
    setExportError(null);
    setExportResult(null);
    try {
      const res = await api.exportConversation({
        sessionId: data.sessionId,
        includeTools,
        write: true,
        lang: getCurrentLang(),
      });
      setExportResult(res);
    } catch (e) {
      setExportError(errMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const revealExported = async () => {
    if (exportResult?.path) {
      try {
        await api.revealPath(exportResult.path);
      } catch {
        /* 文件可能被移动，忽略 */
      }
    }
  };

  // 在终端中恢复该会话的命令
  const resumeCommand = data
    ? data.project
      ? `cd "${data.project}" && claude --resume ${data.sessionId}`
      : `claude --resume ${data.sessionId}`
    : "";

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
        className="mb-4 -ml-2"
      >
        <ArrowLeft size={14} />
        {t("back")}
      </Button>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : isError ? (
        <CenterMessage
          icon={<MessageSquare size={28} />}
          title={t("cannotLoadConversation")}
          hint={errMessage(error)}
        />
      ) : data ? (
        <>
          <div className="mb-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-lg font-semibold text-foreground">
                {t("conversationDetailTitle")}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(resumeCommand)}
                  title={resumeCommand}
                >
                  {copied ? (
                    <Check size={13} className="text-success" />
                  ) : (
                    <Terminal size={13} />
                  )}
                  {copied ? t("copied") : t("copyResumeCommand")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExportOpen((v) => !v)}
                  title={t("exportMarkdownTitle")}
                >
                  <Download size={13} />
                  {t("exportMarkdown")}
                </Button>
              </div>
            </div>

            {exportOpen && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
                <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={includeTools}
                    onChange={(e) => setIncludeTools(e.target.checked)}
                    className="accent-[var(--accent)]"
                  />
                  {t("includeToolsLabel")}
                </label>
                <Button size="sm" onClick={handleExport} disabled={exporting}>
                  {exporting ? (
                    <Spinner className="border-accent-fg/40 border-t-accent-fg" />
                  ) : (
                    <Download size={13} />
                  )}
                  {exporting ? t("exporting") : t("confirmExport")}
                </Button>
              </div>
            )}
            {exportError && (
              <p className="mt-2 text-xs text-danger">
                {t("exportFailed", { error: exportError })}
              </p>
            )}
            {exportResult && (
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <Check size={13} className="shrink-0 text-success" />
                <span className="text-foreground">
                  {t("exportedMessages", {
                    count: formatNumber(exportResult.messageCount),
                  })}{" "}
                  <span
                    className="font-medium"
                    title={exportResult.path ?? undefined}
                  >
                    {exportResult.path
                      ? exportResult.path.split("/").pop()
                      : t("notWrittenToFile")}
                  </span>
                </span>
                {exportResult.path && (
                  <button
                    onClick={revealExported}
                    className="flex items-center gap-1 text-accent transition-colors hover:underline"
                  >
                    <FolderOpen size={12} />
                    {t("revealInFinder")}
                  </button>
                )}
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted">
              {data.project && (
                <Link
                  to={`/project/${encodePath(data.project)}`}
                  className="flex items-center gap-1 transition-colors hover:text-accent"
                  title={data.project}
                >
                  <Folder size={11} />
                  {prettyPath(data.project)}
                </Link>
              )}
              {data.gitBranch && (
                <span className="flex items-center gap-1">
                  <GitBranch size={11} />
                  {data.gitBranch}
                </span>
              )}
              {data.version && <Badge tone="muted">CC {data.version}</Badge>}
              <span>
                {absoluteTime(data.startedAt)} ~ {absoluteTime(data.endedAt)}
              </span>
              <span>
                · {t("messagesCount", { count: formatNumber(data.messages.length) })}
              </span>
            </div>
          </div>

          {data.messages.length === 0 ? (
            <CenterMessage
              icon={<MessageSquare size={28} />}
              title={t("noMessagesInSession")}
            />
          ) : (
            <div className="space-y-3">
              {data.messages.map((m, i) => (
                <MessageBubble key={m.uuid || i} msg={m} />
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
