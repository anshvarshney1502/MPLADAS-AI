import { cn } from "@/lib/utils";

// Single controlled status vocabulary used across the entire product.
export const STATUS_VOCABULARY = [
  "New",
  "Under Review",
  "Verification Required",
  "Escalated",
  "Verified",
  "Resolved",
  "Closed",
] as const;

const STYLES: Record<string, string> = {
  New: "text-text-secondary bg-surface-soft border-border",
  "Under Review": "text-info bg-info-bg border-info/20",
  "Verification Required": "text-info bg-info-bg border-info/20",
  Escalated: "text-risk-high bg-risk-high-bg border-risk-high/20",
  Verified: "text-risk-low bg-risk-low-bg border-risk-low/20",
  Resolved: "text-risk-low bg-risk-low-bg border-risk-low/20",
  Closed: "text-text-muted bg-surface-soft border-border",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const style = STYLES[status] ?? "text-text-muted bg-surface-soft border-border";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-sm)] border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide",
        style,
        className
      )}
    >
      {status}
    </span>
  );
}
