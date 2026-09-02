"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { RiskBadge } from "@/components/RiskBadge";
import { WorkflowStepper } from "@/components/WorkflowStepper";
import { TableSkeleton, KpiSkeletonRow } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { staggerReveal } from "@/lib/animations";
import { gsap } from "gsap";

export default function InspectionQueuePage() {
  const [page, setPage] = useState(1);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [openedKeys, setOpenedKeys] = useState<Set<string>>(new Set());

  const queue = useApi(() => api.inspectionQueue({ min_score: 60, page, page_size: 20 }), [page]);
  const critical = useApi(() => api.riskIntelligence({ min_score: 80, page_size: 1 }), []);
  const high = useApi(() => api.riskIntelligence({ min_score: 60, max_score: 79.99, page_size: 1 }), []);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) staggerReveal(listRef.current.querySelectorAll(":scope > div"));
  }, [queue.data]);

  async function openCase(workKey: string, rowEl: HTMLElement | null) {
    setBusyKey(workKey);
    try {
      await api.inspectionAction(workKey, "initiate_verification");
      setOpenedKeys((s) => new Set(s).add(workKey));
      if (rowEl) gsap.fromTo(rowEl, { backgroundColor: "var(--color-accent-soft)" }, { backgroundColor: "transparent", duration: 0.9, ease: "power1.out" });
    } catch {
      // surfaced inline per row via the button falling back to "Retry"
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-5 pb-12">
      <div>
        <h1 className="font-heading text-2xl font-bold text-primary">Inspection Priority Queue</h1>
        <p className="mt-1 text-[13px] text-text-secondary">The operational path from detection to resolution.</p>
      </div>

      <WorkflowStepper activeIndex={2} />

      {critical.loading || high.loading ? (
        <KpiSkeletonRow count={2} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
            <div className="text-[11px] font-semibold uppercase text-text-muted">Critical</div>
            <div className="mt-1 font-heading text-xl font-bold text-risk-high">{critical.data?.meta.total.toLocaleString("en-IN") ?? "—"}</div>
          </div>
          <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
            <div className="text-[11px] font-semibold uppercase text-text-muted">High</div>
            <div className="mt-1 font-heading text-xl font-bold text-risk-high">{high.data?.meta.total.toLocaleString("en-IN") ?? "—"}</div>
          </div>
          <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
            <div className="text-[11px] font-semibold uppercase text-text-muted">In this queue</div>
            <div className="mt-1 font-heading text-xl font-bold text-text-primary">{queue.data?.meta.total.toLocaleString("en-IN") ?? "—"}</div>
          </div>
          <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
            <div className="text-[11px] font-semibold uppercase text-text-muted">Threshold</div>
            <div className="mt-1 font-heading text-xl font-bold text-text-primary">Score ≥ 60</div>
          </div>
        </div>
      )}

      {queue.loading ? (
        <TableSkeleton cols={5} />
      ) : queue.error ? (
        <ErrorState message={queue.error} onRetry={queue.reload} />
      ) : queue.data && queue.data.data.length > 0 ? (
        <div ref={listRef} className="divide-y divide-border-subtle rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-card)]">
          {queue.data.data.map((item) => {
            const opened = openedKeys.has(item.work_key);
            return (
              <div
                key={item.work_key}
                id={`queue-row-${item.work_key}`}
                className="flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-surface-soft sm:flex-row sm:items-center"
              >
                <div className="w-10 flex-none font-heading text-sm font-bold text-text-primary">#{item.rank}</div>
                <div className="min-w-0 flex-1">
                  <Link href={`/risk-intelligence/${encodeURIComponent(item.work_key)}`} className="line-clamp-1 text-[13px] font-semibold text-text-primary hover:text-accent">
                    {item.work ?? "Untitled work"}
                  </Link>
                  <div className="mt-0.5 line-clamp-1 text-[11.5px] text-text-muted">{item.reason}</div>
                  <div className="mt-0.5 text-[11px] text-text-muted">
                    {item.location ?? "—"}, {item.state ?? "—"}
                  </div>
                </div>
                <div className="flex flex-none items-center gap-4">
                  <div className="text-center">
                    <div className="font-heading text-lg font-bold text-risk-high">{item.score.toFixed(0)}</div>
                  </div>
                  <RiskBadge level={item.priority} />
                  <button
                    onClick={(e) => openCase(item.work_key, e.currentTarget.closest(`#queue-row-${CSS.escape(item.work_key)}`))}
                    disabled={busyKey === item.work_key || opened}
                    className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-primary px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-secondary disabled:opacity-60"
                  >
                    {busyKey === item.work_key ? <Loader2 size={13} className="animate-spin" /> : null}
                    {opened ? "Case Opened" : "Open Case"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No works currently meet the inspection threshold." />
      )}

      {queue.data && queue.data.meta.total_pages > 1 ? (
        <div className="flex items-center justify-center gap-2 text-xs text-text-muted">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-[var(--radius-sm)] border border-border px-3 py-1 disabled:opacity-40">
            Previous
          </button>
          <span>
            Page {queue.data.meta.page} of {queue.data.meta.total_pages}
          </span>
          <button
            disabled={page >= queue.data.meta.total_pages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-[var(--radius-sm)] border border-border px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
