import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Folder, GitBranch, MessageSquare } from "lucide-react";
import { useConversation } from "@/hooks/queries";
import { Badge, Button, CenterMessage, Skeleton } from "@/components/ui";
import type { ChatMessage, ContentBlock } from "@/lib/types";
import { absoluteTime, encodePath, formatNumber, prettyPath } from "@/lib/utils";
import { errMessage } from "@/lib/api";

const detailsLabel: Record<string, string> = {
  thinking: "💭 思考过程",
  tool_result: "↩ 工具结果",
};

function BlockView({ block }: { block: ContentBlock }) {
  if (block.kind === "text") {
    return (
      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
        {block.text}
      </div>
    );
  }
  if (block.kind === "image") {
    return (
      <div className="text-xs text-muted">🖼 {block.text ?? "[图片]"}</div>
    );
  }

  const summary =
    block.kind === "tool_use"
      ? `🔧 调用工具 · ${block.toolName ?? "tool"}`
      : detailsLabel[block.kind] ?? block.kind;
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
  const isUser = msg.role === "user";
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <Badge tone={isUser ? "accent" : "default"}>
          {isUser ? "用户" : "Claude"}
        </Badge>
        {msg.isSidechain && <Badge tone="muted">子代理</Badge>}
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
  const { data, isLoading, isError, error } = useConversation(
    sessionId ?? null
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
        className="mb-4 -ml-2"
      >
        <ArrowLeft size={14} />
        返回
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
          title="无法加载对话"
          hint={errMessage(error)}
        />
      ) : data ? (
        <>
          <div className="mb-5">
            <h1 className="text-lg font-semibold text-foreground">对话详情</h1>
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
              <span>· {formatNumber(data.messages.length)} 条消息</span>
            </div>
          </div>

          {data.messages.length === 0 ? (
            <CenterMessage
              icon={<MessageSquare size={28} />}
              title="该会话没有可显示的消息"
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
