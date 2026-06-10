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
import { useT } from "@/i18n";
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
  const t = useT();
  const span = daysSpan(stats.firstUse, stats.lastUse);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatCard
        icon={<MessageSquare size={13} />}
        label={t("totalPromptsCard")}
        value={formatNumber(stats.totalPrompts)}
        sub={t("promptSourcesSub", {
          history: formatNumber(stats.historyPrompts),
          conversation: formatNumber(stats.conversationPrompts),
        })}
      />
      <StatCard
        icon={<Folder size={13} />}
        label={t("foldersCard")}
        value={formatNumber(stats.totalProjects)}
        sub={t("foldersCardSub")}
      />
      <StatCard
        icon={<MessagesSquare size={13} />}
        label={t("sessionsCard")}
        value={formatNumber(stats.totalSessions)}
        sub={t("messagesSub", { count: formatNumber(stats.totalMessages) })}
      />
      <StatCard
        icon={<Terminal size={13} />}
        label={t("slashCommandsCard")}
        value={formatNumber(stats.commandCount)}
        sub={t("slashCommandsSub")}
      />
      <StatCard
        icon={<CalendarClock size={13} />}
        label={t("activeSpanCard")}
        value={t("daysCount", { count: formatNumber(span) })}
        sub={stats.firstUse ? t("sinceDate", { date: dayLabel(stats.firstUse) }) : "—"}
      />
      <StatCard
        icon={<Hash size={13} />}
        label={t("ccVersionsCard")}
        value={formatNumber(stats.ccVersions.length)}
        sub={
          stats.ccVersions[0]
            ? t("latestVersion", { version: stats.ccVersions[0] })
            : "—"
        }
      />
    </div>
  );
}
