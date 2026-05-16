import { SearchX } from "lucide-react";
import { useStore } from "@/store";
import { useSearch } from "@/hooks/queries";
import { PromptList, type PromptListItem } from "@/components/PromptList";
import { CenterMessage, Spinner } from "@/components/ui";
import { errMessage } from "@/lib/api";
import { formatNumber } from "@/lib/utils";

export function SearchResults() {
  const { query, scope, currentProject, currentProjectName, includeCommands } =
    useStore();
  const projectFilter = scope === "folder" ? currentProject : null;
  const { data, isLoading, isError, error, debouncedQuery } = useSearch(
    query,
    projectFilter,
    includeCommands
  );

  const items: PromptListItem[] = (data ?? []).map((r) => ({
    entry: r.entry,
    ranges: r.matchRanges,
  }));

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-foreground">搜索结果</h1>
        <p className="mt-0.5 text-xs text-muted">
          {scope === "folder" && currentProjectName
            ? `在「${currentProjectName}」内搜索`
            : "全局搜索"}
          {debouncedQuery && ` · 关键词「${debouncedQuery}」`}
          {data && ` · 命中 ${formatNumber(data.length)} 条`}
        </p>
      </div>

      {isLoading ? (
        <CenterMessage icon={<Spinner className="h-6 w-6" />} title="搜索中…" />
      ) : isError ? (
        <CenterMessage
          icon={<SearchX size={28} />}
          title="搜索失败"
          hint={errMessage(error)}
        />
      ) : items.length === 0 ? (
        <CenterMessage
          icon={<SearchX size={28} />}
          title="没有匹配的 prompt"
          hint="换个关键词试试。输入多个词（空格分隔）表示需同时包含。"
        />
      ) : (
        <PromptList items={items} showProject={scope === "global"} />
      )}
    </div>
  );
}
