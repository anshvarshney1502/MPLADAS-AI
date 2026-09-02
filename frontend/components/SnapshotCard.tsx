import type { LucideIcon } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface SnapshotRow {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: "risk" | "default";
}

export function SnapshotCard({
  title,
  subtitle,
  rows,
  bare = false,
}: {
  title: string;
  subtitle: string;
  rows: SnapshotRow[];
  /** See KpiCard — renders as a plain cell for use inside a shared-border grid. */
  bare?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col p-5",
        bare ? "bg-surface" : "rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-card)]"
      )}
    >
      <div className="text-[16px] font-semibold text-primary">{title}</div>
      <p className="mt-0.5 text-[13px] text-text-secondary">{subtitle}</p>
      <div className="mt-4 border-t border-border-subtle pt-4 flex-1 space-y-3">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.label} className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 flex-none items-center justify-center rounded-[var(--radius-sm)] ${
                  row.tone === "risk" ? "bg-risk-high-bg text-risk-high" : "bg-accent-soft text-accent"
                }`}
              >
                <Icon size={14} strokeWidth={2.2} />
              </div>
              <span className="flex-1 text-[13px] text-text-secondary">{row.label}</span>
              <span className="font-heading text-[15px] font-bold text-primary">{formatNumber(row.value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
