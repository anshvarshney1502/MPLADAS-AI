"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { canonicalStateName } from "@/lib/states";

/**
 * Searchable state dropdown backed by the real state list from
 * /api/geo/risk-by-state (the same endpoint the India Risk Map already
 * uses) — no hardcoded state list. Values it emits are the backend's own
 * `State` strings, so they match /api/works and /api/risk-intelligence's
 * state filter exactly, whichever page this is used on.
 */
export function StateSelect({
  value,
  onChange,
  placeholder = "State",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const statesResult = useApi(() => api.geoRiskByState(), []);
  const states = useMemo(
    () => [...(statesResult.data?.data ?? [])].map((r) => r.state).sort((a, b) => a.localeCompare(b)),
    [statesResult.data]
  );
  // A value seeded from elsewhere (URL deep link, map scope) might use a
  // different spelling of the same state — resolve it to the same canonical
  // string the dropdown itself uses, so the button label matches an actual entry.
  const canonicalValue = useMemo(() => (value ? canonicalStateName(value, states) : ""), [value, states]);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return states;
    return states.filter((s) => s.toLowerCase().includes(q));
  }, [states, query]);

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-1.5 rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 py-1.5 text-xs text-text-secondary outline-none focus:border-accent"
      >
        <span className={canonicalValue ? "truncate text-text-primary" : "truncate text-text-muted"}>{canonicalValue || placeholder}</span>
        <span className="flex flex-none items-center gap-1">
          {canonicalValue ? (
            <X
              size={12}
              className="text-text-muted hover:text-text-primary"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                setOpen(false);
              }}
            />
          ) : null}
          <ChevronDown size={12} className="text-text-muted" />
        </span>
      </button>
      {open ? (
        <div className="absolute left-0 top-9 z-30 w-56 overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-card-hover)]">
          <div className="border-b border-border-subtle p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search states..."
              className="w-full rounded-[var(--radius-sm)] border border-border bg-surface-soft px-2 py-1 text-xs outline-none focus:border-accent"
            />
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {statesResult.loading ? (
              <div className="px-3 py-2 text-xs text-text-muted">Loading states…</div>
            ) : filtered.length > 0 ? (
              filtered.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    onChange(s);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`block w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-surface-soft ${
                    canonicalValue === s ? "font-semibold text-accent" : "text-text-secondary"
                  }`}
                >
                  {s}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-text-muted">No states found.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
