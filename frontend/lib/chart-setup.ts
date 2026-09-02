import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import type { Plugin } from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

export const CHART_FONT = {
  family: "var(--font-inter)",
  size: 11,
};

export const CHART_COLORS = {
  primary: "#2563EB",
  primarySoft: "rgba(37, 99, 235, 0.12)",
  secondary: "#0B1F3A",
  high: "#DC2626",
  medium: "#D97706",
  low: "#16A34A",
  muted: "#94A3B8",
  grid: "#F1F5F9",
};

function shadeColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, Math.max(0, (num >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return `rgb(${r}, ${g}, ${b})`;
}

/** Restrained extruded top/side faces on each bar for a subtle 3D-block
 * look. Drawn as a canvas overlay from the bar's real geometry (via
 * getProps), so tooltips and hit-testing stay exactly as before. */
export const bar3dPlugin: Plugin<"bar"> = {
  id: "bar3d",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const depth = 6;
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      const color = typeof dataset.backgroundColor === "string" ? dataset.backgroundColor : CHART_COLORS.primary;
      meta.data.forEach((bar) => {
        const { x, y, base, width } = bar.getProps(["x", "y", "base", "width"], true);
        const left = x - width / 2;
        const right = x + width / 2;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(right, y);
        ctx.lineTo(right + depth, y - depth);
        ctx.lineTo(right + depth, base - depth);
        ctx.lineTo(right, base);
        ctx.closePath();
        ctx.fillStyle = shadeColor(color, -16);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(left + depth, y - depth);
        ctx.lineTo(right + depth, y - depth);
        ctx.lineTo(right, y);
        ctx.closePath();
        ctx.fillStyle = shadeColor(color, 14);
        ctx.fill();
        ctx.restore();
      });
    });
  },
};

/** Soft elevated shadow behind a line dataset — a subtle raised, tactile
 * depth cue instead of a flat stroke. */
export const lineElevationPlugin: Plugin<"line"> = {
  id: "lineElevation",
  beforeDatasetsDraw(chart) {
    chart.ctx.save();
    chart.ctx.shadowColor = "rgba(37, 99, 235, 0.35)";
    chart.ctx.shadowBlur = 10;
    chart.ctx.shadowOffsetY = 4;
  },
  afterDatasetsDraw(chart) {
    chart.ctx.restore();
  },
};

export const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#0F172A",
      titleFont: { family: CHART_FONT.family, weight: 600 as const },
      bodyFont: { family: CHART_FONT.family },
      padding: 10,
      cornerRadius: 8,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: "#64748B", font: CHART_FONT },
    },
    y: {
      grid: { color: CHART_COLORS.grid },
      ticks: { color: "#64748B", font: CHART_FONT },
    },
  },
};
