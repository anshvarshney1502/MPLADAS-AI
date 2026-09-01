"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { RiskReasonList } from "@/components/RiskReason";
import { EvidenceGrid } from "@/components/EvidenceCard";
import { StatusBadge } from "@/components/StatusBadge";
import { RiskBadge } from "@/components/RiskBadge";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { CardSkeleton, Skeleton } from "@/components/LoadingSkeleton";
import { cn, formatCurrency, formatDate, formatPercent } from "@/lib/utils";

const TABS = ["Overview", "Financial", "Timeline", "Progress", "Risk Analysis", "Payments", "Documents", "Activity"] as const;
type Tab = (typeof TABS)[number];

export default function WorkDetailPage() {
  const params = useParams<{ workKey: string }>();
  const router = useRouter();
  const workKey = decodeURIComponent(params.workKey);
  const result = useApi(() => api.workDetail(workKey), [workKey]);
  const [tab, setTab] = useState<Tab>("Overview");

  if (result.loading) {
    return (
      <div className="space-y-4 pb-10">
        <Skeleton className="h-4 w-32" />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (result.error || !result.data) {
    return <ErrorState message={result.error ?? "Work not found."} onRetry={result.reload} />;
  }

  const { work, tabs } = result.data;

  return (
    <div className="space-y-5 pb-12">
      <button
        onClick={() => router.push("/works")}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-primary"
      >
        <ArrowLeft size={13} /> Back to Works
      </button>

      <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-mono text-[11px] text-text-muted">MPLADS/{workKey}</div>
          <h1 className="mt-1 font-heading text-lg font-bold text-primary">{String(work["Work Description"] ?? "Untitled work")}</h1>
          <div className="mt-1 text-[12.5px] text-text-secondary">
            {String(work.Constituency ?? "—")}, {String(work.State ?? "—")} · MP: {String(work["MP Name"] ?? "—")} · Agency:{" "}
            {String(work.IDA ?? "—")}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wide text-text-muted">Status</div>
            <div className="mt-1"><StatusBadge status={String(work.Risk_Status ?? "New")} /></div>
          </div>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wide text-text-muted">Risk Score</div>
            <div className="mt-1 font-heading text-xl font-bold text-risk-high">{Number(work.Risk_Score ?? 0).toFixed(0)}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "border-b-2 px-3.5 py-2 text-[12.5px] font-medium transition-colors",
              tab === t ? "border-primary font-semibold text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" ? (
        <div className="grid grid-cols-2 gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-5 lg:grid-cols-3">
          <Field label="Category" value={String(tabs.overview.Category ?? "—")} />
          <Field label="Implementing Agency" value={String(tabs.overview.IDA ?? "—")} />
          <Field label="Constituency" value={String(tabs.overview.Constituency ?? "—")} />
          <Field label="District / House" value={String(tabs.overview.House ?? "—")} />
          <Field label="Expenditure Date" value={formatDate(tabs.overview["Expenditure Date"] as string)} />
          <Field label="Vendor" value={String(tabs.overview.Vendor ?? "—")} />
        </div>
      ) : null}

      {tab === "Financial" ? (
        <div className="grid grid-cols-2 gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-5 lg:grid-cols-4">
          <Field label="Allocated (Sanctioned)" value={formatCurrency(tabs.financial.allocated)} />
          <Field label="Total Expenditure" value={formatCurrency(tabs.financial.total_expenditure)} />
          <Field label="Unspent Balance" value={formatCurrency(tabs.financial.unspent)} />
          <Field label="Utilization" value={formatPercent(tabs.financial.utilization)} />
        </div>
      ) : null}

      {tab === "Timeline" ? (
        <div className="grid grid-cols-2 gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-5">
          <Field label="Expenditure Date" value={formatDate(tabs.timeline.expenditure_date)} />
          <Field label="Completed Date" value={formatDate(tabs.timeline.completed_date)} />
          <p className="col-span-2 mt-1 text-[11px] text-text-muted">
            No per-work sanction/recommendation timeline exists in the source dataset — only these two real dated fields are shown.
          </p>
        </div>
      ) : null}

      {tab === "Progress" ? (
        <div className="grid grid-cols-2 gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-5">
          <Field label="Completed Works (MP)" value={String(tabs.progress.completed_work_count ?? "—")} />
          <Field label="Completion Rate (MP)" value={formatPercent(tabs.progress.completion_rate)} />
        </div>
      ) : null}

      {tab === "Risk Analysis" ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="font-heading text-xl font-bold text-primary">{tabs.risk_analysis.score.toFixed(0)}/100</span>
            <RiskBadge level={tabs.risk_analysis.category} />
            <span className="text-xs text-text-muted">{tabs.risk_analysis.type}</span>
          </div>
          <RiskReasonList reasons={tabs.risk_analysis.reasons} />
          <EvidenceGrid evidence={tabs.risk_analysis.evidence} />
        </div>
      ) : null}

      {tab === "Payments" ? (
        <div className="grid grid-cols-2 gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-5 lg:grid-cols-3">
          <Field label="Status" value={String(tabs.payments.status ?? "—")} />
          <Field label="Successful" value={String(tabs.payments.successful)} />
          <Field label="Pending" value={String(tabs.payments.pending)} />
        </div>
      ) : null}

      {tab === "Documents" ? (
        <EmptyState
          title="No documents available"
          description="Document/image verification is intentionally out of scope for this product — only records already present in the source dataset would appear here."
        />
      ) : null}

      {tab === "Activity" ? (
        tabs.activity.length > 0 ? (
          <div className="divide-y divide-border-subtle rounded-[var(--radius-md)] border border-border bg-surface">
            {tabs.activity.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3 text-[12.5px]">
                <span className="text-text-primary">{a.action.replace(/_/g, " ")}</span>
                <span className="text-text-muted">{formatDate(a.created_at)}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No inspection activity recorded yet." description="Actions taken from Risk Detail will appear here." />
        )
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mt-1 text-[13px] font-medium text-text-primary">{value}</div>
    </div>
  );
}
