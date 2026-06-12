import { useMemo, useState } from "react";
import { Check, Download, FolderOpen, SearchX } from "lucide-react";
import { useStore } from "@/store";
import { useSearch } from "@/hooks/queries";
import { PromptList, type PromptListItem } from "@/components/PromptList";
import { Button, CenterMessage, Spinner } from "@/components/ui";
import { api, errMessage } from "@/lib/api";
import { getCurrentLang, useT } from "@/i18n";
import { formatNumber } from "@/lib/utils";
import type { ExportResult } from "@/lib/types";

export function SearchResults() {
  const { query, scope, currentProject, currentProjectName, includeCommands } =
    useStore();
  const t = useT();
  const projectFilter = scope === "folder" ? currentProject : null;
  const { data, isLoading, isError, error, debouncedQuery } = useSearch(
    query,
    projectFilter,
    includeCommands
  );

  // memo 保持引用稳定：PromptList 以 items 引用变化作为重置分批的信号
  const items: PromptListItem[] = useMemo(
    () => (data ?? []).map((r) => ({ entry: r.entry, ranges: r.matchRanges })),
    [data]
  );

  // 批量导出当前搜索结果
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!debouncedQuery || exporting) return;
    setExporting(true);
    setExportError(null);
    setExportResult(null);
    try {
      const res = await api.exportSearchResults({
        query: debouncedQuery,
        projectFilter,
        includeCommands,
        write: true,
        lang: getCurrentLang(),
      });
      setExportResult(res);
    } catch (e) {
      setExportError(errMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const revealExported = async () => {
    if (exportResult?.path) {
      try {
        await api.revealPath(exportResult.path);
      } catch {
        /* 文件可能被移动，忽略 */
      }
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {t("searchResultsTitle")}
          </h1>
          <p className="mt-0.5 text-xs text-muted">
            {scope === "folder" && currentProjectName
              ? t("searchInFolder", { name: currentProjectName })
              : t("globalSearch")}
            {debouncedQuery &&
              ` · ${t("searchKeyword", { keyword: debouncedQuery })}`}
            {data &&
              ` · ${t("searchHits", { count: formatNumber(data.length) })}`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exporting || items.length === 0}
        >
          {exporting ? (
            <Spinner className="border-accent/40 border-t-accent" />
          ) : (
            <Download size={13} />
          )}
          {t("exportSearchResults")}
        </Button>
      </div>

      {exportError && (
        <p className="mb-3 text-xs text-danger">
          {t("exportFailed", { error: exportError })}
        </p>
      )}
      {exportResult?.path && (
        <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <Check size={13} className="shrink-0 text-success" />
          <span className="text-foreground">
            {t("exportedCountTo", {
              count: formatNumber(exportResult.promptCount),
            })}{" "}
            <span className="font-medium" title={exportResult.path}>
              {exportResult.path.split("/").pop()}
            </span>
          </span>
          <button
            onClick={revealExported}
            className="flex items-center gap-1 text-accent transition-colors hover:underline"
          >
            <FolderOpen size={12} />
            {t("revealInFinder")}
          </button>
        </div>
      )}

      {isLoading ? (
        <CenterMessage
          icon={<Spinner className="h-6 w-6" />}
          title={t("searching")}
        />
      ) : isError ? (
        <CenterMessage
          icon={<SearchX size={28} />}
          title={t("searchFailed")}
          hint={errMessage(error)}
        />
      ) : items.length === 0 ? (
        <CenterMessage
          icon={<SearchX size={28} />}
          title={t("noMatchingPrompts")}
          hint={t("noMatchingPromptsHint")}
        />
      ) : (
        <PromptList items={items} showProject={scope === "global"} />
      )}
    </div>
  );
}
