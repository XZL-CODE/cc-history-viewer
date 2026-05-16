import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  ChevronUp,
  Clipboard,
  Command,
  Folder,
  GitBranch,
  MessageSquare,
} from "lucide-react";
import type { PromptEntry } from "@/lib/types";
import {
  absoluteTime,
  cn,
  encodePath,
  formatNumber,
  prettyPath,
  relativeTime,
} from "@/lib/utils";
import { Highlight } from "./Highlight";
import { Badge } from "./ui";

const sourceLabel: Record<string, string> = {
  history: "输入历史",
  conversation: "对话记录",
  both: "历史 + 对话",
};

export function PromptCard({
  entry,
  ranges,
  showProject = false,
}: {
  entry: PromptEntry;
  ranges?: [number, number][];
  showProject?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const collapsible = entry.charCount > 150 || entry.text.includes("\n");

  return (
    <div className="rounded-xl border border-border bg-surface p-3.5 transition-colors hover:border-accent/40">
      <div
        onClick={() => collapsible && setExpanded((v) => !v)}
        className={cn(
          "whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground",
          collapsible && "cursor-pointer",
          !expanded && "line-clamp-3"
        )}
      >
        <Highlight text={entry.text} ranges={ranges} />
      </div>

      {collapsible && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 flex items-center gap-0.5 text-[11px] font-medium text-accent hover:underline"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? "收起" : "展开全文"}
        </button>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted">
        <span title={absoluteTime(entry.timestamp)}>
          {relativeTime(entry.timestamp)}
        </span>

        {showProject && entry.project && (
          <Link
            to={`/project/${encodePath(entry.project)}`}
            className="flex items-center gap-1 transition-colors hover:text-accent"
            title={entry.project}
          >
            <Folder size={11} />
            <span className="max-w-[220px] truncate">
              {prettyPath(entry.project)}
            </span>
          </Link>
        )}

        {entry.isCommand && (
          <Badge tone="warning">
            <Command size={10} />
            命令
          </Badge>
        )}

        <Badge tone="muted">{sourceLabel[entry.source] ?? entry.source}</Badge>

        {entry.gitBranch && (
          <span className="flex items-center gap-1">
            <GitBranch size={11} />
            {entry.gitBranch}
          </span>
        )}

        {entry.pastedCount > 0 && (
          <span className="flex items-center gap-1">
            <Clipboard size={11} />
            {entry.pastedCount} 处粘贴
          </span>
        )}

        <span className="ml-auto flex items-center gap-3">
          <span>{formatNumber(entry.charCount)} 字</span>
          {entry.sessionId && (
            <Link
              to={`/conversation/${entry.sessionId}`}
              className="flex items-center gap-1 font-medium text-accent hover:underline"
            >
              <MessageSquare size={11} />
              查看对话
            </Link>
          )}
        </span>
      </div>
    </div>
  );
}
