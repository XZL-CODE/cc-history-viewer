import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Folder, GitBranch, ListTree, MessagesSquare } from "lucide-react";
import { useStore } from "@/store";
import {
  useProjectPrompts,
  useProjectSessions,
  useProjects,
} from "@/hooks/queries";
import { PromptList } from "@/components/PromptList";
import { Badge, CenterMessage, Skeleton } from "@/components/ui";
import type { SessionSummary, SortMode } from "@/lib/types";
import { absoluteTime, cn, formatNumber } from "@/lib/utils";
import { errMessage } from "@/lib/api";

const sortOptions: { value: SortMode; label: string }[] = [
  { value: "newest", label: "最新" },
  { value: "oldest", label: "最早" },
  { value: "longest", label: "最长" },
];

function ListSkeleton() {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-accent text-accent-fg"
          : "text-muted hover:text-foreground"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function SessionRow({ session }: { session: SessionSummary }) {
  return (
    <Link
      to={`/conversation/${session.sessionId}`}
      className="block rounded-xl border border-border bg-surface p-3.5 transition-colors hover:border-accent/40"
    >
      <div className="line-clamp-2 text-sm font-medium text-foreground">
        {session.title}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
        <span>{absoluteTime(session.startedAt)}</span>
        <span>{formatNumber(session.messageCount)} 条消息</span>
        {session.gitBranch && (
          <span className="flex items-center gap-1">
            <GitBranch size={11} />
            {session.gitBranch}
          </span>
        )}
      </div>
    </Link>
  );
}

export function ProjectPrompts() {
  const params = useParams();
  const projectPath = params.encoded ?? "";
  const name = projectPath.split("/").filter(Boolean).pop() || projectPath;

  // 「当前文件夹」由 Layout 根据路由统一登记，这里只读 includeCommands
  const { includeCommands } = useStore();
  const [sort, setSort] = useState<SortMode>("newest");
  const [tab, setTab] = useState<"prompts" | "sessions">("prompts");

  const projectsQ = useProjects();
  const info = projectsQ.data?.find((p) => p.path === projectPath);
  const promptsQ = useProjectPrompts(projectPath, sort, includeCommands);
  const sessionsQ = useProjectSessions(
    tab === "sessions" ? projectPath : null
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <Folder size={18} className="text-accent" />
          <h1 className="text-lg font-semibold text-foreground">{name}</h1>
        </div>
        <p className="mt-1 break-all text-xs text-muted">{projectPath}</p>
        {info && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Badge tone="accent">
              {formatNumber(info.promptCount)} prompt
            </Badge>
            {info.commandCount > 0 && (
              <Badge tone="muted">
                {formatNumber(info.commandCount)} 命令
              </Badge>
            )}
            {info.hasConversations && (
              <Badge tone="muted">
                {formatNumber(info.sessionCount)} 会话
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center rounded-lg border border-border bg-surface p-0.5">
          <TabButton
            active={tab === "prompts"}
            onClick={() => setTab("prompts")}
            icon={<ListTree size={13} />}
          >
            Prompt 列表
          </TabButton>
          <TabButton
            active={tab === "sessions"}
            onClick={() => setTab("sessions")}
            icon={<MessagesSquare size={13} />}
          >
            会话
          </TabButton>
        </div>

        {tab === "prompts" && (
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5">
            {sortOptions.map((o) => (
              <button
                key={o.value}
                onClick={() => setSort(o.value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  sort === o.value
                    ? "bg-accent text-accent-fg"
                    : "text-muted hover:text-foreground"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "prompts" ? (
        promptsQ.isLoading ? (
          <ListSkeleton />
        ) : promptsQ.isError ? (
          <CenterMessage
            icon={<Folder size={28} />}
            title="加载失败"
            hint={errMessage(promptsQ.error)}
          />
        ) : promptsQ.data && promptsQ.data.length > 0 ? (
          <PromptList items={promptsQ.data.map((entry) => ({ entry }))} />
        ) : (
          <CenterMessage
            icon={<Folder size={28} />}
            title="该文件夹下暂无 prompt"
            hint={
              includeCommands
                ? undefined
                : "若只剩斜杠命令，可在顶栏开启「命令」按钮查看。"
            }
          />
        )
      ) : sessionsQ.isLoading ? (
        <ListSkeleton />
      ) : sessionsQ.isError ? (
        <CenterMessage
          icon={<MessagesSquare size={28} />}
          title="加载失败"
          hint={errMessage(sessionsQ.error)}
        />
      ) : sessionsQ.data && sessionsQ.data.length > 0 ? (
        <div className="space-y-2.5">
          {sessionsQ.data.map((s) => (
            <SessionRow key={s.sessionId} session={s} />
          ))}
        </div>
      ) : (
        <CenterMessage
          icon={<MessagesSquare size={28} />}
          title="该文件夹下没有对话记录"
          hint="只有在 ~/.claude/projects 下有对话文件的文件夹才会显示会话。"
        />
      )}
    </div>
  );
}
