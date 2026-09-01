"use client";

import "@/lib/chart-setup";
import { Doughnut } from "react-chartjs-2";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { FundFunnel } from "@/components/FundFunnel";
import { CardSkeleton, KpiSkeletonRow } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { SectionHead } from "@/components/SectionHead";
import { CHART_COLORS } from "@/lib/chart-setup";

const ALERT_LABELS: Record<string, string> = {
  low_utilization: "Low utilization",
  high_unused_balance: "High unused balance",
  payment_pending: "Payment pending / in-progress",
  rapid_expenditure: "Rapid / above-average expenditure",
};

export default function FundsPage() {
  const result = useApi(() => api.funds(), []);

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="font-heading text-2xl font-bold text-primary">Fund &amp; Payment Intelligence</h1>
        <p className="mt-1 text-[13px] text-text-secondary">How sanctioned money moves, and where it stalls.</p>
      </div>

      {result.loading ? (
        <>
          <CardSkeleton />
          <KpiSkeletonRow />
        </>
      ) : result.error ? (
        <ErrorState message={result.error} onRetry={result.reload} />
      ) : result.data ? (
        <>
          <section>
            <SectionHead title="Fund Funnel" tag="MP-level rollup, deduped" />
            <FundFunnel funnel={result.data.funnel} utilizationPercent={result.data.utilization_percent} />
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <SectionHead title="Fund Utilization Alerts" />
              <div className="divide-y divide-border-subtle rounded-[var(--radius-md)] border border-border bg-surface">
                {Object.entries(result.data.alerts).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between px-4 py-3">
                    <span className="text-[12.5px] text-text-secondary">{ALERT_LABELS[key] ?? key}</span>
                    <span className="font-heading text-sm font-bold text-text-primary">{value.toLocaleString("en-IN")}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10.5px] text-text-muted">Each alert count is backed by a real rule over the source data — none are hardcoded.</p>
            </div>

            <div>
              <SectionHead title="Payment Status" />
              <div className="flex h-56 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface p-4">
                <Doughnut
                  data={{
                    labels: ["Successful", "Pending / In-Progress"],
                    datasets: [
                      {
                        data: [result.data.payment_counts.successful, result.data.payment_counts.pending],
                        backgroundColor: [CHART_COLORS.low, CHART_COLORS.medium],
                        borderWidth: 2,
                        borderColor: "#FFFFFF",
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: "68%",
                    plugins: {
                      legend: { position: "bottom", labels: { boxWidth: 8, boxHeight: 8, font: { size: 11 }, color: "#475569" } },
                    },
                  }}
                />
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
