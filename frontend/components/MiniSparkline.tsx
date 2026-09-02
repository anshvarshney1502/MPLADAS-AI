"use client";

import "@/lib/chart-setup";
import { Line, Bar } from "react-chartjs-2";
import { CHART_COLORS } from "@/lib/chart-setup";

/** A minimal inline trend chart for KPI cards — no axes, no legend, no grid.
 * Communicates direction at a glance; the real number lives beside it. */
export function MiniSparkline({ values, type = "line", color = CHART_COLORS.primary }: { values: number[]; type?: "line" | "bar"; color?: string }) {
  const data = {
    labels: values.map((_, i) => String(i)),
    datasets: [
      {
        data: values,
        borderColor: color,
        backgroundColor: type === "line" ? "transparent" : color,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2,
        borderRadius: type === "bar" ? 2 : undefined,
        maxBarThickness: 10,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600 },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { display: false },
      y: { display: false },
    },
    elements: { point: { radius: 0 } },
  };

  return (
    <div className="h-10 w-full">
      {type === "line" ? <Line data={data} options={options} /> : <Bar data={data} options={options} />}
    </div>
  );
}
