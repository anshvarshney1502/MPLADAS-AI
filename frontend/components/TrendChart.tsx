"use client";

import "@/lib/chart-setup";
import { Line, Bar } from "react-chartjs-2";
import { baseChartOptions, CHART_COLORS, bar3dPlugin, lineElevationPlugin } from "@/lib/chart-setup";
import { formatCurrency } from "@/lib/utils";

export function TrendChart({
  type,
  labels,
  values,
  label,
}: {
  type: "line" | "bar";
  labels: string[];
  values: number[];
  label?: string;
}) {
  const shared = {
    labels,
    datasets: [
      {
        label: label ?? "Expenditure",
        data: values,
        borderColor: CHART_COLORS.primary,
        backgroundColor: type === "line" ? CHART_COLORS.primarySoft : CHART_COLORS.primary,
        fill: type === "line",
        tension: 0.35,
        pointRadius: type === "line" ? 3 : 0,
        pointBackgroundColor: CHART_COLORS.primary,
        borderRadius: 0,
        borderWidth: type === "line" ? 2 : 0,
        maxBarThickness: 34,
      },
    ],
  };

  const options = {
    ...baseChartOptions,
    animation: { duration: 500, easing: "easeOutQuart" as const },
    plugins: {
      ...baseChartOptions.plugins,
      tooltip: {
        ...baseChartOptions.plugins.tooltip,
        callbacks: {
          label: (ctx: { parsed: { y: number | null } }) => formatCurrency(ctx.parsed.y ?? 0),
        },
      },
    },
    scales: {
      ...baseChartOptions.scales,
      y: {
        ...baseChartOptions.scales.y,
        ticks: {
          ...baseChartOptions.scales.y.ticks,
          callback: (v: string | number) => formatCurrency(Number(v)),
        },
      },
    },
  };

  return type === "line" ? (
    <Line data={shared} options={options} plugins={[lineElevationPlugin]} />
  ) : (
    <Bar data={shared} options={options} plugins={[bar3dPlugin]} />
  );
}
