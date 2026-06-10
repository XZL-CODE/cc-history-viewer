import { useMemo } from "react";
import { SearchX } from "lucide-react";
import { useStore } from "@/store";
import { useSearch } from "@/hooks/queries";
import { PromptList, type PromptListItem } from "@/components/PromptList";
import { CenterMessage, Spinner } from "@/components/ui";
import { errMessage } from "@/lib/api";
import { useT } from "@/i18n";
import { formatNumber } from "@/lib/utils";

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

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-foreground">
          {t("searchResultsTitle")}
        </h1>
        <p className="mt-0.5 text-xs text-muted">
          {scope === "folder" && currentProjectName
            ? t("searchInFolder", { name: currentProjectName })
            : t("globalSearch")}
          {debouncedQuery &&
            ` · ${t("searchKeyword", { keyword: debouncedQuery })}`}
          {data && ` · ${t("searchHits", { count: formatNumber(data.length) })}`}
        </p>
      </div>

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
