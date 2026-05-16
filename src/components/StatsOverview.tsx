import type { ReactNode } from "react";
import {
  CalendarClock,
  Folder,
  Hash,
  MessageSquare,
  MessagesSquare,
  Terminal,
} from "lucide-react";
import type { AppStats } from "@/lib/types";
import { dayLabel, daysSpan, formatNumber } from "@/lib/utils";

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

export function StatsOverview({ stats }: { stats: AppStats }) {
  const span = daysSpan(stats.firstUse, stats.lastUse);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatCard
        icon={<MessageSquare size={13} />}
        label="总 Prompt"
        value={formatNumber(stats.totalPrompts)}
        sub={`历史 ${formatNumber(stats.historyPrompts)} · 对话 ${formatNumber(
          stats.conversationPrompts
        )}`}
      />
      <StatCard
        icon={<Folder size={13} />}
        label="文件夹"
        value={formatNumber(stats.totalProjects)}
        sub="交互过的项目目录"
      />
      <StatCard
        icon={<MessagesSquare size={13} />}
        label="会话"
        value={formatNumber(stats.totalSessions)}
        sub={`${formatNumber(stats.totalMessages)} 条对话消息`}
      />
      <StatCard
        icon={<Terminal size={13} />}
        label="斜杠命令"
        value={formatNumber(stats.commandCount)}
        sub="/clear、/model 等"
      />
      <StatCard
        icon={<CalendarClock size={13} />}
        label="活跃跨度"
        value={`${formatNumber(span)} 天`}
        sub={stats.firstUse ? `${dayLabel(stats.firstUse)} 起` : "—"}
      />
      <StatCard
        icon={<Hash size={13} />}
        label="CC 版本"
        value={formatNumber(stats.ccVersions.length)}
        sub={stats.ccVersions[0] ? `最新 ${stats.ccVersions[0]}` : "—"}
      />
    </div>
  );
}
