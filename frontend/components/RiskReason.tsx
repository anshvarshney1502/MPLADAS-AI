import { RiskBadge } from "./RiskBadge";
import type { RiskReason as RiskReasonType } from "@/lib/types";

// Renders "Why was this flagged?" — plain-language reasons only.
// No ML/model terminology (Isolation Forest, embedding distance, etc.) is
// ever surfaced here by design; the backend's `reasons()` already emits
// only human-readable signal descriptions.
export function RiskReasonList({ reasons }: { reasons: RiskReasonType[] }) {
  return (
    <div className="divide-y divide-border-subtle rounded-[var(--radius-md)] border border-border bg-surface">
      {reasons.map((r, i) => (
        <div key={i} className="flex items-start gap-4 px-5 py-4">
          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
            {String(i + 1).padStart(2, "0")}
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-heading text-[13px] font-semibold text-text-primary">{r.type}</span>
              <RiskBadge level={r.level} />
            </div>
            <p className="mt-1 text-[13px] text-text-secondary">{r.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
