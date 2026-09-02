"use client";

import "@/lib/chart-setup";
import { Doughnut } from "react-chartjs-2";
import type { Plugin } from "chart.js";
import { CHART_COLORS } from "@/lib/chart-setup";

/** Draws a soft offset shadow ring beneath the doughnut before it renders —
 * a subtle extrusion cue so the ring reads as a raised 3D disc rather than a
 * flat 2D arc, without altering the real data arcs or their hit-testing. */
const donut3dPlugin: Plugin<"doughnut"> = {
  id: "donut3d",
  beforeDatasetsDraw(chart) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    const offset = 5;
    ctx.save();
    ctx.translate(0, offset);
    meta.data.forEach((arc) => {
      const { x, y, innerRadius, outerRadius, startAngle, endAngle } = arc.getProps(
        ["x", "y", "innerRadius", "outerRadius", "startAngle", "endAngle"],
        true
      );
      ctx.beginPath();
      ctx.fillStyle = "rgba(15, 23, 42, 0.14)";
      ctx.arc(x, y, outerRadius, startAngle, endAngle);
      ctx.arc(x, y, innerRadius, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
  },
};

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
        plugins={[donut3dPlugin]}
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
