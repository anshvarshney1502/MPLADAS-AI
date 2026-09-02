"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, ClipboardList } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/LoadingSkeleton";
import { cn } from "@/lib/utils";

export function InspectionQueuePreview({ bare = false }: { bare?: boolean }) {
  const result = useApi(() => api.inspectionQueue({ min_score: 60, page: 1, page_size: 3 }), []);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [openedKeys, setOpenedKeys] = useState<Set<string>>(new Set());

  async function openCase(workKey: string) {
    setBusyKey(workKey);
    try {
      await api.inspectionAction(workKey, "initiate_verification");
      setOpenedKeys((s) => new Set(s).add(workKey));
    } catch {
      // inline retry via the same button
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col p-5",
        bare ? "bg-surface" : "rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-card)]"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[15px] font-semibold text-primary">
          <ClipboardList size={14} className="text-accent" />
          Inspection Queue
        </div>
        <Link href="/inspection" className="text-[12px] font-semibold text-accent hover:underline">
          Open queue
        </Link>
      </div>
      <p className="mt-0.5 text-[13px] text-text-secondary">Top-ranked works awaiting verification.</p>

      <div className="mt-3.5 space-y-2 border-t border-border-subtle pt-3">
        {result.loading ? (
          <>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </>
        ) : result.data && result.data.data.length > 0 ? (
          result.data.data.map((item) => {
            const opened = openedKeys.has(item.work_key);
            return (
              <div key={item.work_key} className="flex items-center gap-2.5 rounded-[var(--radius-sm)] border border-border-subtle p-2.5">
                <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary text-[12px] font-bold text-white">
                  #{item.rank}
                </div>
                <Link href={`/works/${encodeURIComponent(item.work_key)}`} className="min-w-0 flex-1 hover:text-accent">
                  <div className="truncate text-[13px] font-medium text-text-primary hover:text-accent">{item.work ?? "Untitled work"}</div>
                  <div className="truncate text-[12px] text-text-muted">
                    {item.location ?? "—"} · Score {item.score.toFixed(0)}
                  </div>
                </Link>
                <button
                  onClick={() => openCase(item.work_key)}
                  disabled={busyKey === item.work_key || opened}
                  className="flex-none rounded-[var(--radius-sm)] bg-primary px-2.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-primary-secondary disabled:opacity-60"
                >
                  {busyKey === item.work_key ? <Loader2 size={11} className="animate-spin" /> : opened ? "Opened" : "Open"}
                </button>
              </div>
            );
          })
        ) : (
          <EmptyState title="Queue is clear." />
        )}
      </div>
    </div>
  );
}
