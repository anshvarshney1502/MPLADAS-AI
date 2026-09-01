"use client";

import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { CardSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";

interface VendorGroup {
  id: string;
  label: string;
  states: { label: string; weight: number }[];
  totalWeight: number;
}

export default function NetworkPage() {
  const result = useApi(() => api.network(), []);
  const [selected, setSelected] = useState<string | null>(null);

  const vendors = useMemo<VendorGroup[]>(() => {
    if (!result.data) return [];
    const nodeLabel = new Map(result.data.nodes.map((n) => [n.id, n.label]));
    const byVendor = new Map<string, VendorGroup>();
    for (const e of result.data.edges) {
      const vendorId = e.source.startsWith("vendor::") ? e.source : e.target;
      const stateId = e.source.startsWith("vendor::") ? e.target : e.source;
      if (!byVendor.has(vendorId)) {
        byVendor.set(vendorId, { id: vendorId, label: nodeLabel.get(vendorId) ?? vendorId, states: [], totalWeight: 0 });
      }
      const g = byVendor.get(vendorId)!;
      g.states.push({ label: nodeLabel.get(stateId) ?? stateId, weight: e.weight });
      g.totalWeight += e.weight;
    }
    return Array.from(byVendor.values()).sort((a, b) => b.totalWeight - a.totalWeight);
  }, [result.data]);

  const active = vendors.find((v) => v.id === selected) ?? vendors[0];

  return (
    <div className="space-y-5 pb-12">
      <div>
        <h1 className="font-heading text-2xl font-bold text-primary">Network</h1>
        <p className="mt-1 text-[13px] text-text-secondary">Vendor ↔ State relationship patterns from transaction data.</p>
      </div>

      {result.loading ? (
        <CardSkeleton />
      ) : result.error ? (
        <ErrorState message={result.error} onRetry={result.reload} />
      ) : vendors.length === 0 ? (
        <EmptyState title="No vendor relationship data available." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="max-h-[560px] overflow-y-auto rounded-[var(--radius-md)] border border-border bg-surface">
            {vendors.slice(0, 50).map((v) => (
              <button
                key={v.id}
                onClick={() => setSelected(v.id)}
                className={cn(
                  "flex w-full items-center justify-between border-b border-border-subtle px-4 py-3 text-left last:border-0 hover:bg-surface-soft",
                  active?.id === v.id && "bg-accent-soft"
                )}
              >
                <span className="line-clamp-1 text-[12.5px] font-medium text-text-primary">{v.label}</span>
                <span className="ml-2 flex-none border border-border bg-surface-soft px-2 py-0.5 text-[10.5px] font-semibold text-text-muted">
                  {v.states.length} states
                </span>
              </button>
            ))}
          </div>

          {active ? (
            <div className="space-y-4">
              <div className="rounded-[var(--radius-md)] border border-border bg-surface p-5">
                <div className="font-heading text-sm font-bold text-text-primary">{active.label}</div>
                <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Stat label="Connected states" value={active.states.length} />
                  <Stat label="Transaction weight" value={active.totalWeight} />
                  <Stat label="Avg. per state" value={Math.round(active.totalWeight / Math.max(1, active.states.length))} />
                </div>
              </div>

              <div className="rounded-[var(--radius-md)] border border-border bg-surface p-5">
                <svg viewBox="0 0 400 280" className="h-72 w-full">
                  <circle cx="70" cy="140" r="24" fill="var(--color-primary)" />
                  <text x="70" y="144" textAnchor="middle" fontSize="9" fill="#fff" fontFamily="var(--font-inter)">
                    Vendor
                  </text>
                  {active.states.slice(0, 8).map((s, i, arr) => {
                    const y = 30 + (i * (250 - 30)) / Math.max(1, arr.length - 1 || 1);
                    return (
                      <g key={i}>
                        <line x1="94" y1="140" x2="320" y2={y} stroke="var(--color-border)" strokeWidth={Math.min(4, 1 + s.weight / 5)} />
                        <circle cx="330" cy={y} r="14" fill="var(--color-accent-soft)" stroke="var(--color-accent)" strokeWidth="1.5" />
                        <text x="330" y={y + 24} textAnchor="middle" fontSize="9" fill="var(--color-text-secondary)" fontFamily="var(--font-inter)">
                          {s.label.length > 14 ? s.label.slice(0, 14) + "…" : s.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {result.data ? <p className="text-[11px] text-text-muted">{result.data.language_rule}</p> : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mt-0.5 font-heading text-lg font-bold text-text-primary">{value.toLocaleString("en-IN")}</div>
    </div>
  );
}
