import type { ReactNode } from "react";
import {
  CircleDollarSign,
  Code2,
  FileText,
  Folder,
  MessagesSquare,
  Terminal,
} from "lucide-react";
import type { AgentFilter, AppStats } from "@/lib/types";
import { useT } from "@/i18n";
import { cn, formatNumber } from "@/lib/utils";

type Tone = "violet" | "blue" | "green" | "orange" | "gray" | "teal";

const toneClasses: Record<Tone, string> = {
  violet: "bg-accent/10 text-accent",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  green: "bg-success/10 text-success",
  orange: "bg-warning/10 text-warning",
  gray: "bg-surface-2 text-muted",
  teal: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
};

function formatCost(value: number | null, total: number, unknown: number): string {
  if (value === null || !Number.isFinite(value) || total <= 0 || unknown >= total) {
    return "—";
  }
  if (value >= 100) return `$${Math.round(value).toLocaleString("en-US")}`;
  return `$${value.toFixed(2)}`;
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: Tone;
}) {
  return (
    <div className="flex min-h-24 min-w-0 items-start gap-3 rounded-lg border border-border bg-surface p-4">
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          toneClasses[tone]
        )}
      >
        {icon}
      </span>
      <span className="grid min-w-0">
        <strong className="truncate text-[22px] font-semibold leading-[1.15] text-foreground">
          {value}
        </strong>
        <span className="mt-1 text-xs font-semibold text-foreground">{label}</span>
        <small className="mt-0.5 truncate text-[11px] leading-relaxed text-muted" title={sub}>
          {sub}
        </small>
      </span>
    </div>
  );
}

export function StatsOverview({
  stats,
  agentFilter,
}: {
  stats: AppStats;
  agentFilter: AgentFilter;
}) {
  const t = useT();
  const usage = stats.usage;
  const totalTokens = usage.totalTokensIncludingCache;
  const knownTokens = Math.max(totalTokens - usage.unknownModelTokens, 0);
  const coverage =
    totalTokens > 0
      ? `${Math.min((knownTokens / totalTokens) * 100, 100).toFixed(0)}%`
      : null;
  const costLabel =
    agentFilter === "claude" ? t("estTotalCost") : t("apiEquivalentCost");

  return (
    <div className="grid grid-cols-3 gap-3">
      <StatCard
        icon={<FileText size={18} />}
        label={t("totalPromptsCard")}
        value={formatNumber(stats.totalPrompts)}
        sub={t("promptSourcesMergedSub")}
        tone="violet"
      />
      <StatCard
        icon={<Folder size={18} />}
        label={t("foldersCard")}
        value={formatNumber(stats.totalProjects)}
        sub={t("foldersCardSub")}
        tone="blue"
      />
      <StatCard
        icon={<MessagesSquare size={18} />}
        label={t("sessionsCard")}
        value={formatNumber(stats.totalSessions)}
        sub={t("messagesSub", { count: formatNumber(stats.totalMessages) })}
        tone="green"
      />
      <StatCard
        icon={<Terminal size={18} />}
        label={t("slashCommandsCard")}
        value={formatNumber(stats.commandCount)}
        sub={t("slashCommandsSub")}
        tone="orange"
      />
      <StatCard
        icon={<Code2 size={18} />}
        label={t("modelsCard")}
        value={formatNumber(usage.byModel.length)}
        sub={t("modelsCardSub")}
        tone="gray"
      />
      <StatCard
        icon={<CircleDollarSign size={18} />}
        label={costLabel}
        value={formatCost(
          usage.estCostUsd,
          totalTokens,
          usage.unknownModelTokens
        )}
        sub={
          coverage
            ? t("priceCoverageSub", { value: coverage })
            : t("priceCoverageUnavailable")
        }
        tone="teal"
      />
    </div>
  );
}
