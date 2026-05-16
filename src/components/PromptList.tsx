import { useEffect, useState } from "react";
import type { PromptEntry } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import { PromptCard } from "./PromptCard";
import { Button } from "./ui";

const PAGE_SIZE = 60;

export interface PromptListItem {
  entry: PromptEntry;
  ranges?: [number, number][];
}

export function PromptList({
  items,
  showProject = false,
}: {
  items: PromptListItem[];
  showProject?: boolean;
}) {
  const [visible, setVisible] = useState(PAGE_SIZE);

  // 列表内容变化时重置分页
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [items.length, items[0]?.entry.id]);

  const shown = items.slice(0, visible);
  const remaining = items.length - visible;

  return (
    <div className="space-y-2.5">
      {shown.map((it) => (
        <PromptCard
          key={it.entry.id}
          entry={it.entry}
          ranges={it.ranges}
          showProject={showProject}
        />
      ))}
      {remaining > 0 && (
        <div className="flex justify-center pt-1">
          <Button
            variant="subtle"
            size="sm"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
          >
            加载更多（还有 {formatNumber(remaining)} 条）
          </Button>
        </div>
      )}
    </div>
  );
}
