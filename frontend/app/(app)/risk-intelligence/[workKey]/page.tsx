"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { RiskScore } from "@/components/RiskScore";
import { StatusBadge } from "@/components/StatusBadge";
import { RiskReasonList } from "@/components/RiskReason";
import { EvidenceGrid } from "@/components/EvidenceCard";
import { FinancialVsPhysicalProgress } from "@/components/ProgressChart";
import { RecommendationCard } from "@/components/RecommendationCard";
import { ErrorState } from "@/components/ErrorState";
import { CardSkeleton, Skeleton } from "@/components/LoadingSkeleton";
import { SectionHead } from "@/components/SectionHead";

export default function RiskDetailPage() {
  const params = useParams<{ workKey: string }>();
  const router = useRouter();
  const workKey = decodeURIComponent(params.workKey);
  const result = useApi(() => api.riskDetail(workKey), [workKey]);

  if (result.loading) {
    return (
      <div className="space-y-4 pb-10">
        <Skeleton className="h-4 w-40" />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (result.error || !result.data) {
    return <ErrorState message={result.error ?? "Work not found."} onRetry={result.reload} />;
  }

  const { work, risk, reasons, evidence, recommended_verification, disclaimer } = result.data;
  const financialProgress = evidence.financial.utilization;
  const physicalProgress =
    typeof work["Completion Rate %"] === "number" ? (work["Completion Rate %"] as number) : null;

  return (
    <div className="space-y-6 pb-12">
      <button
        onClick={() => router.push("/risk-intelligence")}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-primary"
      >
        <ArrowLeft size={13} /> Back to Risk Intelligence
      </button>

      <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-mono text-[11px] text-text-muted">MPLADS/{workKey}</div>
          <h1 className="mt-1 font-heading text-lg font-bold text-primary">
            {String(work["Work Description"] ?? "Untitled work")}
          </h1>
          <div className="mt-1 text-[12.5px] text-text-secondary">
            {String(work.Constituency ?? "—")}, {String(work.State ?? "—")} · MP: {String(work["MP Name"] ?? "—")}
          </div>
          <div className="mt-2">
            <StatusBadge status={risk.status} />
          </div>
        </div>
        <RiskScore score={risk.score} level={risk.category} />
      </div>

      <section>
        <SectionHead title="Why was this flagged?" tag="no ML jargon" />
        <RiskReasonList reasons={reasons} />
      </section>

      {reasons.length > 0 ? (
        <div className="rounded-[var(--radius-md)] border border-border bg-surface-soft p-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Why this work is receiving attention</div>
          <p className="mt-1.5 text-[13px] italic text-text-secondary">&ldquo;{reasons[0].message}&rdquo;</p>
        </div>
      ) : null}

      <section>
        <SectionHead title="Evidence" />
        <EvidenceGrid evidence={evidence} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <SectionHead title="Financial vs. Physical Progress" />
          <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
            <FinancialVsPhysicalProgress financialProgress={financialProgress} physicalProgress={physicalProgress} />
            <p className="mt-2 text-[10.5px] text-text-muted">
              MP-level snapshot values from the source dataset — no per-work time series is available.
            </p>
          </div>
        </div>
        <RecommendationCard workKey={workKey} checklist={recommended_verification} disclaimer={disclaimer} />
      </section>

      <div className="text-right">
        <Link href={`/works/${encodeURIComponent(workKey)}`} className="text-xs font-medium text-accent hover:underline">
          View full work record →
        </Link>
      </div>
    </div>
  );
}
