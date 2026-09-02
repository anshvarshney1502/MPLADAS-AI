"use client";

import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { NetworkCanvas } from "@/components/NetworkCanvas";
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

function isVendor(id: string) {
  return id.startsWith("vendor::");
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

  // Bidirectional neighbor index — works for either a vendor or a state
  // node, so clicking a state on the canvas gets a real detail panel too,
  // not just vendors picked from the list. Built once from the same real
  // edges the API already returns.
  const nodesById = useMemo(() => new Map((result.data?.nodes ?? []).map((n) => [n.id, n])), [result.data]);
  const neighborStats = useMemo(() => {
    const m = new Map<string, { count: number; totalWeight: number }>();
    for (const e of result.data?.edges ?? []) {
      const a = m.get(e.source) ?? { count: 0, totalWeight: 0 };
      a.count += 1;
      a.totalWeight += e.weight;
      m.set(e.source, a);
      const b = m.get(e.target) ?? { count: 0, totalWeight: 0 };
      b.count += 1;
      b.totalWeight += e.weight;
      m.set(e.target, b);
    }
    return m;
  }, [result.data]);

  const activeId = selected ?? vendors[0]?.id ?? null;
  const activeNode = activeId ? nodesById.get(activeId) : undefined;
  const activeStats = activeId ? neighborStats.get(activeId) : undefined;

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
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <div className="max-h-[560px] overflow-y-auto rounded-[var(--radius-md)] border border-border bg-surface">
            {vendors.slice(0, 50).map((v) => (
              <button
                key={v.id}
                onClick={() => setSelected(v.id)}
                className={cn(
                  "flex w-full items-center justify-between border-b border-border-subtle px-4 py-3 text-left last:border-0 hover:bg-surface-soft",
                  activeId === v.id && "bg-accent-soft"
                )}
              >
                <span className="line-clamp-1 text-[12.5px] font-medium text-text-primary">{v.label}</span>
                <span className="ml-2 flex-none border border-border bg-surface-soft px-2 py-0.5 text-[10.5px] font-semibold text-text-muted">
                  {v.states.length} states
                </span>
              </button>
            ))}
          </div>

          <div className="min-w-0 space-y-4">
            {activeNode ? (
              <div className="rounded-[var(--radius-md)] border border-border bg-surface p-5">
                <div className="font-heading text-sm font-bold text-text-primary">{activeNode.label}</div>
                <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Stat label={isVendor(activeNode.id) ? "Connected states" : "Connected vendors"} value={activeStats?.count ?? 0} />
                  <Stat label="Transaction weight" value={activeStats?.totalWeight ?? 0} />
                  <Stat
                    label={isVendor(activeNode.id) ? "Avg. per state" : "Avg. per vendor"}
                    value={Math.round((activeStats?.totalWeight ?? 0) / Math.max(1, activeStats?.count ?? 1))}
                  />
                </div>
              </div>
            ) : null}

            <NetworkCanvas
              nodes={result.data!.nodes}
              edges={result.data!.edges}
              selectedId={activeId}
              onSelect={(id) => setSelected(id)}
            />

            <p className="text-[11px] text-text-muted">{result.data!.language_rule}</p>
          </div>
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
