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
