"use client";

import { useState } from "react";
import { CheckCircle2, ShieldAlert, ClipboardCheck, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

const ACTIONS: { key: string; label: string; icon: typeof ShieldAlert; style: string }[] = [
  {
    key: "initiate_verification",
    label: "Initiate Verification",
    icon: ClipboardCheck,
    style: "bg-primary text-white hover:bg-primary-secondary",
  },
  {
    key: "escalate",
    label: "Escalate to Authority",
    icon: ShieldAlert,
    style: "border border-border bg-surface text-text-primary hover:bg-surface-soft",
  },
  {
    key: "routine_review",
    label: "Mark for Routine Review",
    icon: CheckCircle2,
    style: "border border-border bg-surface text-text-primary hover:bg-surface-soft",
  },
];

export function RecommendationCard({
  workKey,
  checklist,
  disclaimer,
  onActionRecorded,
}: {
  workKey: string;
  checklist: string[];
  disclaimer?: string;
  onActionRecorded?: (action: string) => void;
}) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(actionKey: string) {
    setPending(actionKey);
    setError(null);
    try {
      await api.inspectionAction(workKey, actionKey);
      setDone(actionKey);
      onActionRecorded?.(actionKey);
    } catch {
      setError("Could not record this action. Please retry.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-5">
      <div className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Recommended Verification</div>
      <div className="mt-3 space-y-2">
        {checklist.map((item, i) => (
          <label key={i} className="flex items-start gap-2 text-[13px] text-text-secondary">
            <input
              type="checkbox"
              checked={!!checked[i]}
              onChange={(e) => setChecked((c) => ({ ...c, [i]: e.target.checked }))}
              className="mt-0.5 h-3.5 w-3.5 accent-accent"
            />
            {item}
          </label>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            disabled={pending !== null}
            onClick={() => act(a.key)}
            className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-60 ${a.style}`}
          >
            {pending === a.key ? <Loader2 size={14} className="animate-spin" /> : <a.icon size={14} />}
            {a.label}
            {done === a.key ? " — Recorded" : ""}
          </button>
        ))}
      </div>

      {error ? <p className="mt-2 text-xs text-risk-high">{error}</p> : null}
      {disclaimer ? <p className="mt-3 text-[11px] leading-relaxed text-text-muted">{disclaimer}</p> : null}
    </div>
  );
}
