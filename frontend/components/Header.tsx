"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronDown, LogOut, Bell } from "lucide-react";
import { AccessibilityBar } from "./AccessibilityBar";
import { api } from "@/lib/api";
import type { SearchResultItem, Role } from "@/lib/types";
import { useRole, ROLE_LABELS } from "@/lib/role-context";

export function Header() {
  const router = useRouter();
  const { role, setRole, clearRole } = useRole();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [open, setOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      api
        .search(query.trim(), 8)
        .then((res) => {
          setResults(res.data);
          setOpen(true);
        })
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function goTo(item: SearchResultItem) {
    setOpen(false);
    setQuery("");
    router.push(`/works/${encodeURIComponent(item.work_key)}`);
  }

  return (
    <div className="flex-none">
      <AccessibilityBar />
      <div className="flex flex-wrap items-center gap-4 border-b border-border bg-surface px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full border-2 border-primary bg-accent-soft font-heading text-lg font-bold text-primary">
            M
          </div>
          <div>
            <div className="text-[11px] font-medium text-text-muted">Independent Analysis Prototype</div>
            <div className="font-heading text-[17px] font-bold leading-tight text-primary">MPLADS AI</div>
            <div className="text-[12px] font-semibold leading-tight text-text-secondary">
              Risk &amp; Monitoring Intelligence
            </div>
          </div>
        </div>

        <div ref={boxRef} className="relative ml-auto w-full max-w-sm sm:ml-6">
          <div className="flex h-10 items-center gap-2 rounded-[var(--radius-lg)] border border-border bg-surface px-3.5 shadow-[var(--shadow-card)] focus-within:border-accent">
            <Search size={15} className="text-text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results.length && setOpen(true)}
              placeholder="Search Work, Vendor, Agency, MP, Constituency..."
              className="w-full bg-transparent text-[12.5px] text-text-primary outline-none placeholder:text-text-muted"
            />
          </div>
          {open && results.length > 0 ? (
            <div className="absolute left-0 right-0 top-11 z-30 max-h-80 overflow-y-auto rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-card-hover)]">
              {results.map((r) => (
                <button
                  key={r.work_key}
                  onClick={() => goTo(r)}
                  className="flex w-full flex-col items-start gap-0.5 border-b border-border-subtle px-4 py-2.5 text-left last:border-0 hover:bg-surface-soft"
                >
                  <span className="text-[12.5px] font-medium text-text-primary line-clamp-1">{r.work ?? "Untitled work"}</span>
                  <span className="text-[11px] text-text-muted">
                    {r.mp ?? "—"} · {r.constituency ?? "—"} · {r.state ?? "—"}
                    {r.risk_score != null ? ` · Risk ${r.risk_score}` : ""}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-none items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setNotifOpen((o) => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-text-secondary hover:bg-surface-soft"
            >
              <Bell size={17} />
            </button>
            {notifOpen ? (
              <div className="absolute right-0 top-10 z-30 w-64 rounded-[var(--radius-md)] border border-border bg-surface p-3 text-xs text-text-muted shadow-[var(--shadow-card-hover)]">
                No new notifications.
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              onClick={() => setRoleMenuOpen((o) => !o)}
              className="flex items-center gap-1.5 font-heading text-[13px] font-bold text-primary hover:text-accent"
            >
              {role ? ROLE_LABELS[role].toUpperCase() : "SELECT ROLE"}
              <ChevronDown size={14} />
            </button>
            {roleMenuOpen ? (
              <div className="absolute right-0 top-8 z-30 w-52 rounded-[var(--radius-md)] border border-border bg-surface py-1 shadow-[var(--shadow-card-hover)]">
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      setRole(r);
                      setRoleMenuOpen(false);
                    }}
                    className={`block w-full px-3.5 py-2 text-left text-xs hover:bg-surface-soft ${role === r ? "font-semibold text-accent" : "text-text-secondary"}`}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                ))}
                <div className="my-1 border-t border-border-subtle" />
                <button
                  onClick={() => {
                    clearRole();
                    router.push("/login");
                  }}
                  className="flex w-full items-center gap-1.5 px-3.5 py-2 text-left text-xs text-risk-high hover:bg-risk-high-bg"
                >
                  <LogOut size={12} /> Switch demo access
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
