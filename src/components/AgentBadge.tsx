import { Layers } from "lucide-react";
import type { Agent, AgentFilter } from "@/lib/types";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { Badge } from "./ui";

export function AgentBadge({
  agent,
  className,
}: {
  agent: Agent;
  className?: string;
}) {
  const t = useT();
  return (
    <Badge
      tone={agent === "claude" ? "warning" : "success"}
      className={className}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {agent === "claude" ? t("agentClaude") : t("agentCodex")}
    </Badge>
  );
}

const OPTIONS: AgentFilter[] = ["claude", "codex", "all"];

export function AgentFilterControl({
  value,
  onChange,
  className,
  compact = false,
}: {
  value: AgentFilter;
  onChange: (value: AgentFilter) => void;
  className?: string;
  compact?: boolean;
}) {
  const t = useT();
  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center rounded-lg border border-border bg-surface p-0.5",
        className
      )}
      role="group"
      aria-label={t("agentFilterLabel")}
    >
      {OPTIONS.map((option) => {
        const fullLabel =
          option === "all"
            ? t("agentAll")
            : option === "claude"
              ? t("agentClaude")
              : t("agentCodex");
        const label =
          compact && option === "claude" ? t("agentClaudeShort") : fullLabel;

        return (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            title={compact ? fullLabel : undefined}
            className={cn(
              "flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
              value === option
                ? "bg-accent text-accent-fg"
                : "text-muted hover:text-foreground"
            )}
          >
            {option === "all" ? (
              <Layers size={13} aria-hidden />
            ) : (
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  option === "claude" ? "bg-warning" : "bg-success"
                )}
                aria-hidden
              />
            )}
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
