import { formatCurrency } from "@/lib/utils";
import type { FundsResponse } from "@/lib/types";

const STAGES: { key: keyof FundsResponse["funnel"]; label: string }[] = [
  { key: "sanctioned", label: "Sanctioned" },
  { key: "released", label: "Released" },
  { key: "paid", label: "Paid" },
  { key: "expended", label: "Expended" },
  { key: "balance", label: "Balance" },
];

export function FundFunnel({ funnel, utilizationPercent }: { funnel: FundsResponse["funnel"]; utilizationPercent: number | null }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {STAGES.map((s, i) => {
          const value = funnel[s.key];
          return (
            <div key={s.key} className={i < STAGES.length - 1 ? "border-r-0 sm:border-r sm:border-dashed sm:border-border" : ""}>
              <div className="text-center">
                <div className="text-[10.5px] font-bold uppercase tracking-wide text-text-muted">{s.label}</div>
                <div className="mt-2 font-heading text-sm font-bold text-text-primary">
                  {value == null ? <span className="text-xs font-normal text-text-muted">Not tracked</span> : formatCurrency(value)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-text-muted">
          <span>Utilization</span>
          <span className="font-semibold text-text-primary">{utilizationPercent != null ? `${utilizationPercent.toFixed(1)}%` : "—"}</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-border-subtle">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-700"
            style={{ width: `${Math.min(100, Math.max(0, utilizationPercent ?? 0))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
