import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  CRITICAL: "text-risk-high bg-risk-high-bg border-risk-high/20",
  HIGH: "text-risk-high bg-risk-high-bg border-risk-high/20",
  MEDIUM: "text-risk-medium bg-risk-medium-bg border-risk-medium/20",
  LOW: "text-risk-low bg-risk-low-bg border-risk-low/20",
};

export function RiskBadge({ level, className }: { level: string; className?: string }) {
  const key = (level || "").toUpperCase();
  const style = STYLES[key] ?? "text-text-muted bg-surface-soft border-border";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-2 py-0.5 text-[10.5px] font-bold tracking-wide uppercase",
        style,
        className
      )}
    >
      <span className="h-1.5 w-1.5 flex-none bg-current" />
      {key || "UNKNOWN"}
    </span>
  );
}
