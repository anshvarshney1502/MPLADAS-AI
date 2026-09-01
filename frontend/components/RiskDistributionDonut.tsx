"use client";

import "@/lib/chart-setup";
import { Doughnut } from "react-chartjs-2";
import { CHART_COLORS } from "@/lib/chart-setup";

const ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const COLOR_MAP: Record<string, string> = {
  CRITICAL: CHART_COLORS.high,
  HIGH: "#F87171",
  MEDIUM: CHART_COLORS.medium,
  LOW: CHART_COLORS.low,
};

export function RiskDistributionDonut({ distribution }: { distribution: Record<string, number> }) {
  const labels = ORDER.filter((k) => distribution[k] !== undefined);
  const values = labels.map((k) => distribution[k]);
  const total = values.reduce((a, b) => a + b, 0);

  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: labels.map((l) => COLOR_MAP[l]),
        borderWidth: 2,
        borderColor: "#FFFFFF",
      },
    ],
  };

  return (
    <div className="relative flex h-56 items-center justify-center">
      <Doughnut
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: "72%",
          plugins: {
            legend: {
              position: "bottom",
              labels: { boxWidth: 8, boxHeight: 8, font: { size: 11 }, color: "#475569" },
            },
            tooltip: { backgroundColor: "#0F172A", padding: 10, cornerRadius: 8 },
          },
        }}
      />
      <div className="pointer-events-none absolute top-[42%] flex -translate-y-1/2 flex-col items-center">
        <span className="font-heading text-xl font-bold text-primary">{total.toLocaleString("en-IN")}</span>
        <span className="text-[10px] uppercase tracking-wide text-text-muted">Total works</span>
      </div>
    </div>
  );
}
