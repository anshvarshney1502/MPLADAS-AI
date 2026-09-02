"use client";

import { useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { StateSelect } from "@/components/StateSelect";
import { WorksFieldSelect } from "@/components/WorksFieldSelect";
import type { WorksIndexField } from "@/lib/works-index";

export interface FilterField {
  key: string;
  label: string;
  type: "text" | "select" | "state" | "works-field";
  options?: { value: string; label: string }[];
  /** Required when type is "works-field" — which complete distinct list to
   * search (Constituency/MP/Vendor), from lib/works-index. */
  worksField?: WorksIndexField;
}

const TEXT_DEBOUNCE_MS = 300;

export function FilterBar({
  fields,
  values,
  onChange,
  onReset,
}: {
  fields: FilterField[];
  values: Record<string, string>;
  /** Called immediately with the new full filter set on every change —
   * select/state fields apply instantly, text fields are debounced. */
  onChange: (values: Record<string, string>) => void;
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

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  function setField(key: string, value: string, debounce = false) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    clearTimeout(timers.current[key]);
    if (debounce) {
      timers.current[key] = setTimeout(() => onChange(next), TEXT_DEBOUNCE_MS);
    } else {
      onChange(next);
    }
  }

  function handleReset() {
    Object.values(timers.current).forEach(clearTimeout);
    setDraft({});
    onReset();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface-soft p-3">
      {fields.map((f) => (
        <div key={f.key} className="min-w-[140px] flex-1 sm:flex-none sm:w-44">
          {f.type === "state" ? (
            <StateSelect value={draft[f.key] ?? ""} onChange={(v) => setField(f.key, v)} placeholder={f.label} />
          ) : f.type === "works-field" ? (
            <WorksFieldSelect
              field={f.worksField!}
              value={draft[f.key] ?? ""}
              onChange={(v) => setField(f.key, v)}
              placeholder={f.label}
            />
          ) : f.type === "select" ? (
            <select
              value={draft[f.key] ?? ""}
              onChange={(e) => setField(f.key, e.target.value)}
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
              onChange={(e) => setField(f.key, e.target.value, true)}
              placeholder={f.label}
              className="w-full rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 py-1.5 text-xs text-text-secondary outline-none placeholder:text-text-muted focus:border-accent"
            />
          )}
        </div>
      ))}
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-soft"
        >
          <RotateCcw size={13} /> Reset
        </button>
      </div>
    </div>
  );
}
