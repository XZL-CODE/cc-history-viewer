import { useMemo, useState, type ReactNode } from "react";
import { format, startOfMonth, subDays } from "date-fns";
import {
  Calendar,
  Check,
  Download,
  FileText,
  FolderOpen,
  Terminal,
} from "lucide-react";
import { useExportPreview, useProjects, useStats } from "@/hooks/queries";
import { api, errMessage } from "@/lib/api";
import { useLang, useT, type DictKey } from "@/i18n";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Spinner,
} from "@/components/ui";
import { cn, formatNumber, prettyPath } from "@/lib/utils";
import type { ExportGroupBy, ExportResult } from "@/lib/types";

const fmtDay = (d: Date) => format(d, "yyyy-MM-dd");

const groupOptions: { value: ExportGroupBy; labelKey: DictKey }[] = [
  { value: "project", labelKey: "groupByProject" },
  { value: "day", labelKey: "groupByDay" },
  { value: "none", labelKey: "groupByTimeline" },
];

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

const dateInputCls =
  "h-9 rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none transition-colors focus:border-accent";

export function Export() {
  const projectsQ = useProjects();
  const statsQ = useStats();
  const t = useT();
  const { lang } = useLang();

  const today = useMemo(() => new Date(), []);
  const [startDate, setStartDate] = useState(() => fmtDay(subDays(today, 6)));
  const [endDate, setEndDate] = useState(() => fmtDay(today));
  const [project, setProject] = useState("");
  const [includeCommands, setIncludeCommands] = useState(false);
  const [groupBy, setGroupBy] = useState<ExportGroupBy>("project");

  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rangeValid = startDate <= endDate;

  const previewQ = useExportPreview({
    startDate,
    endDate,
    project: project || null,
    includeCommands,
    groupBy,
    lang,
    enabled: rangeValid,
  });

  const preset = (s: Date, e: Date) => {
    setStartDate(fmtDay(s));
    setEndDate(fmtDay(e));
  };

  const presets: { labelKey: DictKey; run: () => void }[] = [
    { labelKey: "last7Days", run: () => preset(subDays(today, 6), today) },
    { labelKey: "last30Days", run: () => preset(subDays(today, 29), today) },
    { labelKey: "thisMonth", run: () => preset(startOfMonth(today), today) },
    {
      labelKey: "allTime",
      run: () => {
        const first = statsQ.data?.firstUse;
        if (first) preset(new Date(first), today);
      },
    },
  ];

  const count = previewQ.data?.promptCount ?? 0;
  const canExport = rangeValid && count > 0 && !exporting;

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.buildExport({
        startDate,
        endDate,
        project: project || null,
        includeCommands,
        groupBy,
        lang,
        write: true,
      });
      setResult(res);
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const reveal = async () => {
    if (result?.path) {
      try {
        await api.revealPath(result.path);
      } catch {
        /* 文件可能被移动，忽略 */
      }
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-6 py-6">
      <div>
        <div className="flex items-center gap-2">
          <Download size={18} className="text-accent" />
          <h1 className="text-lg font-semibold text-foreground">
            {t("navExport")}
          </h1>
        </div>
        <p className="mt-1 text-xs text-muted">
          {t("exportIntroPrefix")}
          <span className="text-foreground">~/Downloads</span>
          {t("exportIntroSuffix")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("exportScope")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 日期 */}
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t("startDate")}>
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={dateInputCls}
              />
            </Field>
            <span className="pb-2 text-muted">~</span>
            <Field label={t("endDate")}>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={dateInputCls}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
              {presets.map((p) => (
                <button
                  key={p.labelKey}
                  onClick={p.run}
                  className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent/40 hover:text-foreground"
                >
                  <Calendar size={12} />
                  {t(p.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* 文件夹 + 分组 */}
          <div className="flex flex-wrap items-end gap-4">
            <Field label={t("folderScope")}>
              <select
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className={cn(dateInputCls, "min-w-[220px] max-w-[360px]")}
              >
                <option value="">{t("allFolders")}</option>
                {projectsQ.data?.map((p) => (
                  <option key={p.path} value={p.path}>
                    {t("folderOption", {
                      name: p.name,
                      count: formatNumber(p.promptCount),
                    })}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t("groupByLabel")}>
              <div className="flex items-center rounded-lg border border-border bg-surface p-0.5">
                {groupOptions.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => setGroupBy(o.value)}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      groupBy === o.value
                        ? "bg-accent text-accent-fg"
                        : "text-muted hover:text-foreground"
                    )}
                  >
                    {t(o.labelKey)}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          {/* 命令开关 */}
          <button
            onClick={() => setIncludeCommands((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
              includeCommands
                ? "border-accent/40 bg-accent/15 text-accent"
                : "border-border text-muted hover:text-foreground"
            )}
          >
            <Terminal size={13} />
            {includeCommands
              ? t("includeSlashCommands")
              : t("excludeSlashCommands")}
          </button>
        </CardContent>
      </Card>

      {/* 统计 + 导出 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted">
          {!rangeValid ? (
            <span className="text-danger">{t("invalidDateRange")}</span>
          ) : previewQ.isLoading ? (
            <>
              <Spinner /> {t("counting")}
            </>
          ) : previewQ.isError ? (
            <span className="text-danger">{errMessage(previewQ.error)}</span>
          ) : (
            <span>
              {t("willExportPrefix")}{" "}
              <span className="font-semibold text-foreground">
                {formatNumber(count)}
              </span>{" "}
              {t("willExportSuffix", {
                folders: formatNumber(previewQ.data?.folderCount ?? 0),
                days: formatNumber(previewQ.data?.dayCount ?? 0),
              })}
            </span>
          )}
        </div>
        <Button onClick={handleExport} disabled={!canExport}>
          {exporting ? (
            <Spinner className="border-accent-fg/40 border-t-accent-fg" />
          ) : (
            <Download size={16} />
          )}
          {t("exportAsMarkdown")}
        </Button>
      </div>

      {/* 导出结果 */}
      {error && (
        <Card className="border-danger/40">
          <CardContent className="py-3 text-sm text-danger">
            {t("exportFailed", { error })}
          </CardContent>
        </Card>
      )}
      {result?.path && (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Check size={16} className="text-success" />
              <span className="text-foreground">
                {t("exportedCountTo", {
                  count: formatNumber(result.promptCount),
                })}{" "}
                <span className="font-medium">{prettyPath(result.path)}</span>
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={reveal}>
              <FolderOpen size={14} />
              {t("revealInFinder")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 预览 */}
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <FileText size={15} className="text-muted" />
          {t("preview")}
        </div>
        {!rangeValid ? null : previewQ.isLoading ? (
          <div className="h-64 animate-pulse rounded-xl bg-surface-2" />
        ) : count === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted">
              {t("noExportablePrompts")}
            </CardContent>
          </Card>
        ) : (
          <pre className="max-h-[28rem] overflow-auto rounded-xl border border-border bg-surface p-4 text-xs leading-relaxed text-foreground whitespace-pre-wrap break-words">
            {previewQ.data?.preview}
          </pre>
        )}
      </div>
    </div>
  );
}
