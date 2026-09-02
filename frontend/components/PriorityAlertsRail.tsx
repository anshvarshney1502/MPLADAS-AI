"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { RiskBadge } from "@/components/RiskBadge";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/LoadingSkeleton";
import { staggerReveal } from "@/lib/animations";
import { cn } from "@/lib/utils";

export function PriorityAlertsRail({ state, bare = false }: { state?: string; bare?: boolean }) {
  const result = useApi(() => api.riskIntelligence({ min_score: 80, page: 1, page_size: 5, state }), [state]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) staggerReveal(listRef.current.querySelectorAll(":scope > a"));
  }, [result.data]);

  return (
    <div
      className={cn(
        "flex flex-col p-5",
        bare ? "bg-surface" : "rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-card)]"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="text-[15px] font-semibold text-primary">Priority Alerts</div>
        <Link href="/risk-intelligence" className="text-[12px] font-semibold text-accent hover:underline">
          View all
        </Link>
      </div>
      <p className="mt-0.5 text-[13px] text-text-secondary">Critical-score works needing verification first.</p>

      <div className="mt-3.5 space-y-1 border-t border-border-subtle pt-3">
        {result.loading ? (
          <>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </>
        ) : result.data && result.data.data.length > 0 ? (
          <div ref={listRef} className="space-y-1">
            {result.data.data.map((w) => (
              <Link
                key={w.work_key}
                href={`/risk-intelligence/${encodeURIComponent(w.work_key)}`}
                className="group flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-2 transition-colors hover:bg-surface-soft"
              >
                <div className="flex-1 overflow-hidden">
                  <div className="truncate text-[13px] font-medium text-text-primary">{String(w["Work Description"] ?? "Untitled work")}</div>
                  <div className="truncate text-[12px] text-text-muted">
                    {String(w.Constituency ?? "—")}, {String(w.State ?? "—")}
                  </div>
                </div>
                <RiskBadge level={String(w.priority ?? "")} className="flex-none" />
                <ArrowUpRight size={13} className="flex-none text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="No critical alerts right now." />
        )}
      </div>
    </div>
  );
}
