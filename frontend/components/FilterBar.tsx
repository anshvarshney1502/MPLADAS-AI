"use client";

import { useState } from "react";
import { RotateCcw, Search } from "lucide-react";

export interface FilterField {
  key: string;
  label: string;
  type: "text" | "select";
  options?: { value: string; label: string }[];
}

export function FilterBar({
  fields,
  values,
  onApply,
  onReset,
}: {
  fields: FilterField[];
  values: Record<string, string>;
  onApply: (values: Record<string, string>) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(values);
  // Reset the draft when the parent's committed `values` change (e.g. a
  // Reset click, or a deep link seeding a filter) — adjusted during render
  // per React's "you might not need an effect" guidance, rather than in a
  // useEffect, so it doesn't cost an extra render pass.
  const [prevValues, setPrevValues] = useState(values);
  if (prevValues !== values) {
    setPrevValues(values);
    setDraft(values);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface-soft p-3">
      {fields.map((f) => (
        <div key={f.key} className="min-w-[140px] flex-1 sm:flex-none sm:w-44">
          {f.type === "select" ? (
            <select
              value={draft[f.key] ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              className="w-full rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 py-1.5 text-xs text-text-secondary outline-none focus:border-accent"
            >
              <option value="">{f.label}</option>
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={draft[f.key] ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              placeholder={f.label}
              className="w-full rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 py-1.5 text-xs text-text-secondary outline-none placeholder:text-text-muted focus:border-accent"
            />
          )}
        </div>
      ))}
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => onApply(draft)}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-primary px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-secondary"
        >
          <Search size={13} /> Apply
        </button>
        <button
          onClick={() => {
            setDraft({});
            onReset();
          }}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-soft"
        >
          <RotateCcw size={13} /> Reset
        </button>
      </div>
    </div>
  );
}
