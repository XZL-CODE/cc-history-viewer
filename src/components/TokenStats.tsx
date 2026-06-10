// Token 用量与成本统计区块（Home 页）。数据来自 stats.usage。

import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CircleDollarSign,
  DatabaseZap,
} from "lucide-react";
import type { DayUsage, UsageStats } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { useT } from "@/i18n";
import { encodePath, formatNumber, formatTokens } from "@/lib/utils";

const AXIS = "var(--muted)";
const GRID = "var(--border)";
const ACCENT = "var(--accent)";

/** 成本展示："$X.XX"，≥$100 显示整数 */
function formatCost(v: number): string {
  if (v >= 100) return `$${Math.round(v).toLocaleString("zh-CN")}`;
  return `$${v.toFixed(2)}`;
}

/** 去掉 "claude-" 前缀让模型名更紧凑 */
function shortModel(model: string): string {
  return model.replace(/^claude-/, "");
}

/* ----------------------------- 指标卡 ----------------------------- */

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

/* ----------------------------- 按天成本图 ----------------------------- */

interface DayTooltipProps {
  active?: boolean;
  payload?: { payload?: DayUsage }[];
  label?: string | number;
}

function DayCostTooltip({ active, payload, label }: DayTooltipProps) {
  const t = useT();
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow-lg">
      <div className="font-medium text-foreground">{label}</div>
      <div className="mt-0.5 space-y-0.5 text-muted">
        <div>
          {t("costLabel")}{" "}
          <span className="font-medium text-foreground">
            {formatCost(row.estCostUsd)}
          </span>
        </div>
        <div>
          {t("inputOutputLine", {
            input: formatTokens(row.input),
            output: formatTokens(row.output),
          })}
        </div>
        <div>{t("cacheReadLine", { value: formatTokens(row.cacheRead) })}</div>
      </div>
    </div>
  );
}

function DayCostChart({ data }: { data: DayUsage[] }) {
  const t = useT();
  if (data.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center text-xs text-muted">
        {t("noData")}
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={208}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fill: AXIS, fontSize: 10 }}
          tickFormatter={(d: string) => d.slice(5)}
          interval="preserveStartEnd"
          minTickGap={28}
          stroke={GRID}
        />
        <YAxis
          tick={{ fill: AXIS, fontSize: 10 }}
          stroke={GRID}
          width={48}
          tickFormatter={(v: number) => `$${v}`}
        />
        <Tooltip
          content={<DayCostTooltip />}
          cursor={{ fill: "var(--surface-2)" }}
        />
        <Bar dataKey="estCostUsd" fill={ACCENT} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ----------------------------- 按模型表格 ----------------------------- */

function ModelTable({ usage }: { usage: UsageStats }) {
  const t = useT();
  if (usage.byModel.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-muted">{t("noData")}</div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-muted">
            <th className="pb-2 pr-2 text-left font-medium">{t("modelCol")}</th>
            <th className="pb-2 px-2 text-right font-medium">
              {t("messagesCol")}
            </th>
            <th className="pb-2 px-2 text-right font-medium">{t("inputCol")}</th>
            <th className="pb-2 px-2 text-right font-medium">
              {t("outputCol")}
            </th>
            <th className="pb-2 px-2 text-right font-medium">
              {t("cacheReadCol")}
            </th>
            <th className="pb-2 pl-2 text-right font-medium">
              {t("estCostCol")}
            </th>
          </tr>
        </thead>
        <tbody>
          {usage.byModel.map((m) => (
            <tr key={m.model} className="border-b border-border/60 last:border-0">
              <td className="py-2 pr-2">
                <span
                  className="block max-w-[160px] truncate font-medium text-foreground"
                  title={m.model}
                >
                  {shortModel(m.model)}
                </span>
              </td>
              <td className="py-2 px-2 text-right text-muted">
                {formatNumber(m.messages)}
              </td>
              <td className="py-2 px-2 text-right text-muted">
                {formatTokens(m.input)}
              </td>
              <td className="py-2 px-2 text-right text-muted">
                {formatTokens(m.output)}
              </td>
              <td className="py-2 px-2 text-right text-muted">
                {formatTokens(m.cacheRead)}
              </td>
              <td className="py-2 pl-2 text-right font-medium text-foreground">
                {m.estCostUsd === null ? "—" : formatCost(m.estCostUsd)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ----------------------------- 按项目 Top 列表 ----------------------------- */

function ProjectCostList({ usage }: { usage: UsageStats }) {
  const t = useT();
  const top = useMemo(
    () =>
      [...usage.byProject]
        .sort((a, b) => b.estCostUsd - a.estCostUsd || b.output - a.output)
        .slice(0, 8),
    [usage.byProject]
  );

  if (top.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-muted">{t("noData")}</div>
    );
  }

  const maxCost = Math.max(...top.map((p) => p.estCostUsd));
  const maxOutput = Math.max(...top.map((p) => p.output));
  // 全部成本为 0（如均为未知定价模型）时，退化为按输出 token 占比
  const ratio = (p: { estCostUsd: number; output: number }) =>
    maxCost > 0
      ? p.estCostUsd / maxCost
      : maxOutput > 0
        ? p.output / maxOutput
        : 0;

  return (
    <div className="space-y-2.5">
      {top.map((p) => (
        <Link
          key={p.path}
          to={`/project/${encodePath(p.path)}`}
          className="block rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-2"
          title={p.path}
        >
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="truncate font-medium text-foreground">
              {p.name}
            </span>
            <span className="shrink-0 text-muted">
              {formatCost(p.estCostUsd)} ·{" "}
              {t("outputSuffix", { value: formatTokens(p.output) })}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.max(ratio(p) * 100, 2)}%` }}
            />
          </div>
        </Link>
      ))}
    </div>
  );
}

/* ----------------------------- 主区块 ----------------------------- */

export function TokenStats({ usage }: { usage: UsageStats }) {
  const t = useT();
  if (usage.assistantMessages === 0) {
    return (
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          {t("tokenUsageTitle")}
        </h2>
        <Card>
          <CardContent className="py-10 text-center text-xs text-muted">
            {t("noTokenData")}
          </CardContent>
        </Card>
      </section>
    );
  }

  const inputWithCache = usage.totalInput + usage.totalCacheRead;
  const hitRate =
    inputWithCache > 0
      ? `${((usage.totalCacheRead / inputWithCache) * 100).toFixed(1)}%`
      : "—";

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">
        {t("tokenUsageTitle")}
      </h2>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={<CircleDollarSign size={13} />}
          label={t("estTotalCost")}
          value={formatCost(usage.estCostUsd)}
          sub={t("assistantMessagesSub", {
            count: formatNumber(usage.assistantMessages),
          })}
        />
        <StatCard
          icon={<ArrowUpFromLine size={13} />}
          label={t("outputTokensCard")}
          value={formatTokens(usage.totalOutput)}
          sub={t("outputTokensSub")}
        />
        <StatCard
          icon={<ArrowDownToLine size={13} />}
          label={t("inputTokensCard")}
          value={formatTokens(inputWithCache)}
          sub={t("inputTokensSub", {
            value: formatTokens(usage.totalCacheRead),
          })}
        />
        <StatCard
          icon={<DatabaseZap size={13} />}
          label={t("cacheHitRate")}
          value={hitRate}
          sub={t("cacheHitRateSub")}
        />
      </div>

      <div className="space-y-0.5">
        <p className="text-[11px] text-muted">{t("costNote")}</p>
        {usage.unknownModelTokens > 0 && (
          <p className="text-[11px] text-warning">
            {t("unknownModelNote", {
              value: formatTokens(usage.unknownModelTokens),
            })}
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("dailyCost")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DayCostChart data={usage.byDay} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("byModel")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ModelTable usage={usage} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("topCostFolders")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectCostList usage={usage} />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
