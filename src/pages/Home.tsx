import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { useStore } from "@/store";
import { useIndexMeta, useRecentPrompts, useStats } from "@/hooks/queries";
import { StatsOverview } from "@/components/StatsOverview";
import { ActivityChart, HourChart, ProjectChart } from "@/components/Charts";
import { TokenStats } from "@/components/TokenStats";
import { PromptList } from "@/components/PromptList";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CenterMessage,
  Skeleton,
} from "@/components/ui";
import { errMessage } from "@/lib/api";
import { useT } from "@/i18n";
import { absoluteTime, formatNumber } from "@/lib/utils";

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-[88px] w-full" />
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}

export function Home() {
  const { includeCommands } = useStore();
  const t = useT();
  const statsQ = useStats();
  const metaQ = useIndexMeta();
  const recentQ = useRecentPrompts(24, includeCommands);

  // memo 保持引用稳定：PromptList 以 items 引用变化作为重置分批的信号
  const recentItems = useMemo(
    () => (recentQ.data ?? []).map((entry) => ({ entry })),
    [recentQ.data]
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          {t("overviewTitle")}
        </h1>
        <p className="mt-0.5 text-xs text-muted">
          {metaQ.data
            ? [
                t("indexMetaSummary", {
                  files: formatNumber(metaQ.data.sourceFiles),
                  time: absoluteTime(metaQ.data.builtAt),
                }),
                metaQ.data.fromCache
                  ? t("indexFromCache")
                  : t("indexFreshScan"),
                ...(metaQ.data.reparsedFiles > 0
                  ? [
                      t("indexReparsedFiles", {
                        count: formatNumber(metaQ.data.reparsedFiles),
                      }),
                    ]
                  : []),
              ].join(" · ")
            : t("loadingLocalData")}
        </p>
      </div>

      {statsQ.isLoading ? (
        <StatsSkeleton />
      ) : statsQ.isError ? (
        <CenterMessage
          icon={<AlertTriangle size={28} />}
          title={t("cannotLoadData")}
          hint={t("cannotLoadDataHint", { error: errMessage(statsQ.error) })}
        />
      ) : statsQ.data ? (
        <>
          <StatsOverview stats={statsQ.data} />

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("dailyActivity")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ActivityChart data={statsQ.data.byDay} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t("hourlyDistribution")}</CardTitle>
              </CardHeader>
              <CardContent>
                <HourChart data={statsQ.data.byHour} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("topActiveFolders")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ProjectChart data={statsQ.data.topProjects} />
            </CardContent>
          </Card>

          <TokenStats usage={statsQ.data.usage} />
        </>
      ) : null}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          {t("recentPrompts")}
        </h2>
        {recentQ.isLoading ? (
          <ListSkeleton />
        ) : recentQ.isError ? (
          <p className="text-xs text-muted">
            {t("loadFailedWithError", { error: errMessage(recentQ.error) })}
          </p>
        ) : recentItems.length > 0 ? (
          <PromptList items={recentItems} showProject />
        ) : (
          <p className="text-xs text-muted">{t("noPromptRecords")}</p>
        )}
      </div>
    </div>
  );
}
