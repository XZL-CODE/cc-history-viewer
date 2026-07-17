import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Spinner,
} from "@/components/ui";
import { cn, formatNumber, prettyPath } from "@/lib/utils";
import type { AgentFilter, ExportGroupBy, ExportResult } from "@/lib/types";
import { AgentFilterControl } from "@/components/AgentBadge";

const fmtDay = (date: Date) => format(date, "yyyy-MM-dd");

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
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

const fieldClass =
  "h-9 w-full rounded-lg border border-border bg-surface-2/60 px-3 text-sm text-foreground outline-none transition-colors focus:border-accent focus:bg-surface focus:ring-2 focus:ring-ring/20";

export function Export() {
  const [agentFilter, setAgentFilter] = useState<AgentFilter>("all");
  const projectsQ = useProjects(agentFilter);
  const statsQ = useStats(agentFilter);
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

  useEffect(() => {
    if (
      project &&
      projectsQ.data &&
      !projectsQ.data.some((item) => item.path === project)
    ) {
      setProject("");
    }
  }, [project, projectsQ.data]);

  useEffect(() => {
    setResult(null);
    setError(null);
  }, [agentFilter, endDate, groupBy, includeCommands, project, startDate]);

  const rangeValid = startDate <= endDate;

  const previewQ = useExportPreview({
    startDate,
    endDate,
    project: project || null,
    includeCommands,
    groupBy,
    agentFilter,
    lang,
    enabled: rangeValid,
  });

  const preset = (start: Date, end: Date) => {
    setStartDate(fmtDay(start));
    setEndDate(fmtDay(end));
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
      const response = await api.buildExport({
        startDate,
        endDate,
        project: project || null,
        includeCommands,
        groupBy,
        agentFilter,
        lang,
        write: true,
      });
      setResult(response);
    } catch (exportError) {
      setError(errMessage(exportError));
    } finally {
      setExporting(false);
    }
  };

  const reveal = async () => {
    if (!result?.path) return;
    try {
      await api.revealPath(result.path);
    } catch {
      // 文件可能已被移动。
    }
  };

  return (
    <div className="page-content space-y-5 py-6">
      <header className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Download size={18} className="text-accent" />
            <h1 className="text-xl font-semibold text-foreground">
              {t("navExport")}
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted">
            {t("exportIntroPrefix")}
            <span className="text-foreground">~/Downloads</span>
            {t("exportIntroSuffix")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs font-medium text-muted max-[1080px]:hidden">
            {t("exportAgentSource")}
          </span>
          <AgentFilterControl
            value={agentFilter}
            onChange={setAgentFilter}
            ariaLabel={t("exportAgentSource")}
          />
        </div>
      </header>

      <div className="grid min-w-0 grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)] items-start gap-4 max-[1200px]:grid-cols-1">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("exportScope")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("startDate")}>
                  <input
                    type="date"
                    value={startDate}
                    max={endDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className={fieldClass}
                  />
                </Field>
                <Field label={t("endDate")}>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className={fieldClass}
                  />
                </Field>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {presets.map((presetOption) => (
                  <button
                    key={presetOption.labelKey}
                    type="button"
                    onClick={presetOption.run}
                    className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent/40 hover:bg-surface-2 hover:text-foreground"
                  >
                    <Calendar size={12} />
                    {t(presetOption.labelKey)}
                  </button>
                ))}
              </div>

              <Field label={t("folderScope")}>
                <select
                  value={project}
                  onChange={(event) => setProject(event.target.value)}
                  className={fieldClass}
                >
                  <option value="">{t("allFolders")}</option>
                  {projectsQ.data?.map((projectOption) => (
                    <option key={projectOption.path} value={projectOption.path}>
                      {t("folderOption", {
                        name: projectOption.name,
                        count: formatNumber(projectOption.promptCount),
                      })}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t("groupByLabel")}>
                <div className="flex w-fit max-w-full items-center rounded-lg border border-border bg-background p-0.5">
                  {groupOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setGroupBy(option.value)}
                      className={cn(
                        "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                        groupBy === option.value
                          ? "bg-accent text-accent-fg"
                          : "text-muted hover:text-foreground"
                      )}
                    >
                      {t(option.labelKey)}
                    </button>
                  ))}
                </div>
              </Field>

              <button
                type="button"
                onClick={() => setIncludeCommands((value) => !value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                  includeCommands
                    ? "border-accent/40 bg-accent/15 text-accent"
                    : "border-border text-muted hover:bg-surface-2 hover:text-foreground"
                )}
              >
                <Terminal size={13} />
                {includeCommands
                  ? t("includeSlashCommands")
                  : t("excludeSlashCommands")}
              </button>
            </CardContent>
          </Card>

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
                    <span className="font-medium">
                      {prettyPath(result.path)}
                    </span>
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={reveal}>
                  <FolderOpen size={14} />
                  {t("revealInFinder")}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="min-w-0">
          <CardHeader className="flex items-start justify-between">
            <div>
              <CardTitle>{t("preview")}</CardTitle>
              <p className="mt-1 text-xs text-muted">{t("exportScope")}</p>
            </div>
            <FileText size={17} className="text-muted" />
          </CardHeader>
          <CardContent>
            {!rangeValid ? (
              <div className="py-12 text-center text-sm text-danger">
                {t("invalidDateRange")}
              </div>
            ) : previewQ.isLoading ? (
              <div className="h-64 animate-pulse rounded-lg bg-surface-2" />
            ) : previewQ.isError ? (
              <div className="py-12 text-center text-sm text-danger">
                {errMessage(previewQ.error)}
              </div>
            ) : count === 0 ? (
              <div className="py-12 text-center text-sm text-muted">
                {t("noExportablePrompts")}
              </div>
            ) : (
              <>
                <strong className="block text-[26px] font-semibold leading-tight text-foreground">
                  {formatNumber(count)}
                </strong>
                <p className="mt-1 text-xs text-muted">
                  {t("willExportSuffix", {
                    folders: formatNumber(previewQ.data?.folderCount ?? 0),
                    days: formatNumber(previewQ.data?.dayCount ?? 0),
                  })}
                </p>
                <pre className="mt-5 max-h-[28rem] overflow-auto rounded-md bg-surface-2/70 p-3 text-xs leading-relaxed text-foreground whitespace-pre-wrap break-words">
                  {previewQ.data?.preview}
                </pre>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
