import { AlertTriangle } from "lucide-react";
import { useStore } from "@/store";
import { useIndexMeta, useRecentPrompts, useStats } from "@/hooks/queries";
import { StatsOverview } from "@/components/StatsOverview";
import { ActivityChart, HourChart, ProjectChart } from "@/components/Charts";
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
  const statsQ = useStats();
  const metaQ = useIndexMeta();
  const recentQ = useRecentPrompts(24, includeCommands);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">概览</h1>
        <p className="mt-0.5 text-xs text-muted">
          {metaQ.data
            ? `索引含 ${formatNumber(
                metaQ.data.sourceFiles
              )} 个数据文件 · 构建于 ${absoluteTime(metaQ.data.builtAt)} · ${
                metaQ.data.fromCache ? "读取自缓存" : "本次重新扫描"
              }`
            : "正在读取本地 Claude Code 数据…"}
        </p>
      </div>

      {statsQ.isLoading ? (
        <StatsSkeleton />
      ) : statsQ.isError ? (
        <CenterMessage
          icon={<AlertTriangle size={28} />}
          title="无法加载数据"
          hint={`${errMessage(
            statsQ.error
          )}。请确认通过 pnpm tauri dev 启动应用，且 ~/.claude 目录存在。`}
        />
      ) : statsQ.data ? (
        <>
          <StatsOverview stats={statsQ.data} />

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>每日活跃度</CardTitle>
              </CardHeader>
              <CardContent>
                <ActivityChart data={statsQ.data.byDay} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>24 小时分布</CardTitle>
              </CardHeader>
              <CardContent>
                <HourChart data={statsQ.data.byHour} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>最活跃的文件夹 Top 8</CardTitle>
            </CardHeader>
            <CardContent>
              <ProjectChart data={statsQ.data.topProjects} />
            </CardContent>
          </Card>
        </>
      ) : null}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          最近的 Prompt
        </h2>
        {recentQ.isLoading ? (
          <ListSkeleton />
        ) : recentQ.isError ? (
          <p className="text-xs text-muted">
            加载失败：{errMessage(recentQ.error)}
          </p>
        ) : recentQ.data && recentQ.data.length > 0 ? (
          <PromptList
            items={recentQ.data.map((entry) => ({ entry }))}
            showProject
          />
        ) : (
          <p className="text-xs text-muted">暂无 prompt 记录。</p>
        )}
      </div>
    </div>
  );
}
