import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

/** 合并 Tailwind 类名 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 相对时间，如「3 天前」 */
export function relativeTime(ts: number): string {
  if (!ts) return "未知时间";
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true, locale: zhCN });
  } catch {
    return "未知时间";
  }
}

/** 绝对时间，如「2026-05-16 18:30」 */
export function absoluteTime(ts: number): string {
  if (!ts) return "—";
  try {
    return format(new Date(ts), "yyyy-MM-dd HH:mm");
  } catch {
    return "—";
  }
}

/** 日期，如「2026年5月16日」 */
export function dayLabel(ts: number): string {
  if (!ts) return "—";
  try {
    return format(new Date(ts), "yyyy年M月d日");
  } catch {
    return "—";
  }
}

/** 千分位数字 */
export function formatNumber(n: number): string {
  return (n ?? 0).toLocaleString("zh-CN");
}

/** 把绝对路径压缩为可读短路径：/Users/xxx/... → ~/... */
export function prettyPath(path: string): string {
  if (!path) return "";
  return path.replace(/^\/Users\/[^/]+/, "~").replace(/^\/home\/[^/]+/, "~");
}

/** react-router 路由参数编码 */
export function encodePath(path: string): string {
  return encodeURIComponent(path);
}
export function decodePath(param: string): string {
  try {
    return decodeURIComponent(param);
  } catch {
    return param;
  }
}

/** 两个时间戳之间的天数（含两端） */
export function daysSpan(from: number, to: number): number {
  if (!from || !to || to < from) return 0;
  return Math.floor((to - from) / 86_400_000) + 1;
}
