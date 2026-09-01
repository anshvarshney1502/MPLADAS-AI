"use client";

import "@/lib/chart-setup";
import { Bar } from "react-chartjs-2";
import { CHART_COLORS } from "@/lib/chart-setup";

// The source dataset carries MP-level financial utilization and completion
// rate (no per-work time-series progress log exists in the real data), so
// this renders the two real, available snapshot values side by side rather
// than fabricating a monthly trend line.
export function FinancialVsPhysicalProgress({
  financialProgress,
  physicalProgress,
}: {
  financialProgress: number | null;
  physicalProgress: number | null;
}) {
  const data = {
    labels: ["Financial progress (utilization)", "Physical progress (completion rate)"],
    datasets: [
      {
        data: [financialProgress ?? 0, physicalProgress ?? 0],
        backgroundColor: [CHART_COLORS.primary, CHART_COLORS.secondary],
        borderRadius: 6,
        barThickness: 36,
      },
    ],
  };

  return (
    <div className="h-40">
      <Bar
        data={data}
        options={{
          indexAxis: "y" as const,
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#0F172A",
              padding: 10,
              cornerRadius: 8,
              callbacks: { label: (ctx) => `${ctx.parsed.x?.toFixed(1)}%` },
            },
          },
          scales: {
            x: { min: 0, max: 100, grid: { color: CHART_COLORS.grid }, ticks: { color: "#64748B" } },
            y: { grid: { display: false }, ticks: { color: "#475569", font: { size: 11 } } },
          },
        }}
      />
    </div>
  );
}
