import { useCallback, useEffect, useRef, useState } from "react";
import type { PromptEntry } from "@/lib/types";
import { useT } from "@/i18n";
import { formatNumber } from "@/lib/utils";
import { PromptCard } from "./PromptCard";

const BATCH_SIZE = 200;

export interface PromptListItem {
  entry: PromptEntry;
  ranges?: [number, number][];
}

export function PromptList({
  items,
  showProject = false,
  showAgentBadge = true,
}: {
  items: PromptListItem[];
  showProject?: boolean;
  showAgentBadge?: boolean;
}) {
  const t = useT();
  const [visible, setVisible] = useState(BATCH_SIZE);

  // items 引用变化（新数据）时重置分批
  useEffect(() => {
    setVisible(BATCH_SIZE);
  }, [items]);

  // sentinel 进入视口时追加一批（callback ref：挂载即观察，卸载即断开）
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible((v) => v + BATCH_SIZE);
        }
      },
      { rootMargin: "400px 0px" }
    );
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  const shown = items.slice(0, visible);
  const remaining = items.length - shown.length;

  return (
    <div className="space-y-2.5">
      {shown.map((it) => (
        <div key={it.entry.id} className="cv-auto">
          <PromptCard
            entry={it.entry}
            ranges={it.ranges}
            showProject={showProject}
            showAgentBadge={showAgentBadge}
          />
        </div>
      ))}

      {remaining > 0 && (
        <>
          <div ref={sentinelRef} aria-hidden className="h-px" />
          <p className="pb-2 pt-1 text-center text-[11px] text-muted">
            {t("showedCount", {
              shown: formatNumber(shown.length),
              total: formatNumber(items.length),
            })}
          </p>
        </>
      )}
    </div>
  );
}
