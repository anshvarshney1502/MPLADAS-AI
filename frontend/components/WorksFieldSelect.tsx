"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { getWorksIndex, onWorksIndexProgress, type WorksIndexField } from "@/lib/works-index";

/**
 * Searchable dropdown over the COMPLETE distinct list for a Works field
 * (Constituency, MP, or Vendor) — no slicing, no top-N. The list itself
 * comes from lib/works-index (a one-time full scan of the real dataset via
 * the existing /api/works endpoint); this component just does local,
 * instant substring search + a fully scrollable list over whatever has
 * loaded so far, matching the same UX as the State filter.
 */
export function WorksFieldSelect({
  field,
  value,
  onChange,
  placeholder,
}: {
  field: WorksIndexField;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [allOptions, setAllOptions] = useState<string[] | null>(null);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onWorksIndexProgress((loaded, total) => {
      if (!cancelled) setProgress({ loaded, total });
    });
    getWorksIndex().then((idx) => {
      if (!cancelled) setAllOptions(idx[field]);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [field]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = useMemo(() => {
    if (!allOptions) return [];
    const q = query.trim().toLowerCase();
    if (!q) return allOptions;
    return allOptions.filter((s) => s.toLowerCase().includes(q));
  }, [allOptions, query]);

  const loading = allOptions === null;

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-1.5 rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 py-1.5 text-xs text-text-secondary outline-none focus:border-accent"
      >
        <span className={value ? "truncate text-text-primary" : "truncate text-text-muted"}>{value || placeholder}</span>
        <span className="flex flex-none items-center gap-1">
          {value ? (
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
        <div className="absolute left-0 top-9 z-30 w-64 overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-card-hover)]">
          <div className="border-b border-border-subtle p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${placeholder.toLowerCase()}...`}
              className="w-full rounded-[var(--radius-sm)] border border-border bg-surface-soft px-2 py-1 text-xs outline-none focus:border-accent"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {loading ? (
              <div className="px-3 py-2 text-xs text-text-muted">
                Loading full list{progress ? ` (${progress.loaded}/${progress.total} pages)` : "…"}
              </div>
            ) : filtered.length > 0 ? (
              filtered.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => {
                    onChange(o);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`block w-full truncate px-3 py-1.5 text-left text-xs transition-colors hover:bg-surface-soft ${
                    value === o ? "font-semibold text-accent" : "text-text-secondary"
                  }`}
                >
                  {o}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-text-muted">No matches found.</div>
            )}
          </div>
          {!loading ? (
            <div className="border-t border-border-subtle px-3 py-1 text-[10px] text-text-muted">
              {allOptions.length.toLocaleString("en-IN")} total
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
