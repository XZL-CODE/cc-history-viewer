import type { ReactNode } from "react";

/** 按字符索引区间高亮命中关键词（区间来自 Rust 端，基于 Unicode 标量索引）。 */
export function Highlight({
  text,
  ranges,
}: {
  text: string;
  ranges?: [number, number][];
}) {
  if (!ranges || ranges.length === 0) return <>{text}</>;

  const chars = Array.from(text);
  const nodes: ReactNode[] = [];
  let cursor = 0;

  ranges.forEach(([start, end], i) => {
    const s = Math.max(cursor, Math.min(start, chars.length));
    const e = Math.max(s, Math.min(end, chars.length));
    if (s > cursor) {
      nodes.push(<span key={`t${i}`}>{chars.slice(cursor, s).join("")}</span>);
    }
    nodes.push(
      <mark
        key={`m${i}`}
        className="rounded-[3px] bg-accent/30 px-0.5 text-foreground"
      >
        {chars.slice(s, e).join("")}
      </mark>
    );
    cursor = e;
  });

  if (cursor < chars.length) {
    nodes.push(<span key="tail">{chars.slice(cursor).join("")}</span>);
  }
  return <>{nodes}</>;
}
