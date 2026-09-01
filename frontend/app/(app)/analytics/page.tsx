"use client";

import { useState } from "react";
import "@/lib/chart-setup";
import { Bar, Line } from "react-chartjs-2";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { CardSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { baseChartOptions, CHART_COLORS } from "@/lib/chart-setup";
import { cn, formatCurrency } from "@/lib/utils";

const DIMENSIONS: { key: string; label: string; column: string; description: string }[] = [
  { key: "state", label: "State", column: "State", description: "State-wise expenditure trend" },
  { key: "district", label: "District", column: "Constituency", description: "District/constituency-wise expenditure trend" },
  { key: "agency", label: "Agency", column: "IDA", description: "Agency-wise expenditure & risk trend" },
  { key: "category", label: "Category", column: "Work Description", description: "Category-wise cost trend (by work description)" },
  { key: "year_over_year", label: "Year-over-Year", column: "Expenditure_Year", description: "Year-over-year utilization & average risk" },
];

export default function AnalyticsPage() {
  const [dimension, setDimension] = useState("state");
  const active = DIMENSIONS.find((d) => d.key === dimension)!;
  const result = useApi(() => api.analytics(dimension), [dimension]);

  const rows = result.data?.data ?? [];
  const isYoY = dimension === "year_over_year";

  const labels = rows
    .slice(0, 15)
    .map((r) => String(r[active.column] ?? "—"))
    .map((s) => (s.length > 22 ? s.slice(0, 22) + "…" : s));

  const values = isYoY
    ? rows.slice(0, 15).map((r) => Number(r.expenditure ?? 0))
    : rows.slice(0, 15).map((r) => Number(r.sum ?? 0));

  return (
    <div className="space-y-5 pb-12">
      <div>
        <h1 className="font-heading text-2xl font-bold text-primary">Analytics</h1>
        <p className="mt-1 text-[13px] text-text-secondary">Expenditure and risk trends across the required dimensions.</p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {DIMENSIONS.map((d) => (
          <button
            key={d.key}
            onClick={() => setDimension(d.key)}
            className={cn(
              "border-b-2 px-3.5 py-2 text-[12.5px] font-medium transition-colors",
              dimension === d.key ? "border-primary font-semibold text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
            )}
          >
            {d.label}
          </button>
        ))}
      </div>

      <p className="text-[11px] text-text-muted">{active.description}</p>

      {result.loading ? (
        <CardSkeleton />
      ) : result.error ? (
        <ErrorState message={result.error} onRetry={result.reload} />
      ) : rows.length === 0 ? (
        <EmptyState title="No analytics data available for this dimension." />
      ) : (
        <>
          <div className="h-80 rounded-[var(--radius-md)] border border-border bg-surface p-5">
            {isYoY ? (
              <Line
                data={{
                  labels,
                  datasets: [
                    {
                      label: "Expenditure",
                      data: values,
                      borderColor: CHART_COLORS.primary,
                      backgroundColor: CHART_COLORS.primarySoft,
                      fill: true,
                      tension: 0.35,
                      pointRadius: 3,
                    },
                  ],
                }}
                options={baseChartOptions}
              />
            ) : (
              <Bar
                data={{
                  labels,
                  datasets: [
                    {
                      label: "Total expenditure",
                      data: values,
                      backgroundColor: CHART_COLORS.primary,
                      borderRadius: 4,
                    },
                  ],
                }}
                options={baseChartOptions}
              />
            )}
          </div>

          <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-soft text-left text-[10.5px] font-bold uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-2.5">{active.label}</th>
                  <th className="px-4 py-2.5">{isYoY ? "Expenditure" : "Total"}</th>
                  <th className="px-4 py-2.5">{isYoY ? "Avg. risk score" : "Average"}</th>
                  <th className="px-4 py-2.5">{isYoY ? "Works" : "Count"}</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 25).map((r, i) => (
                  <tr key={i} className="border-b border-border-subtle last:border-0">
                    <td className="px-4 py-2.5 text-text-primary">{String(r[active.column] ?? "—")}</td>
                    <td className="px-4 py-2.5 text-text-secondary">
                      {formatCurrency(Number(isYoY ? r.expenditure : r.sum) || 0)}
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary">
                      {isYoY ? Number(r.average_risk ?? 0).toFixed(1) : formatCurrency(Number(r.mean) || 0)}
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary">
                      {Number(isYoY ? r.works : r.count).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
