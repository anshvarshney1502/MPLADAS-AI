"use client";

import { Download, Lock } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://mpladas.onrender.com/api";

const AVAILABLE = [
  {
    title: "Risk Report",
    description: "All works with a risk score of 60 or above, with the full computed feature set.",
    href: `${API_BASE}/reports/risk.csv`,
  },
  {
    title: "Works Report",
    description: "The complete processed works/expenditure dataset, including risk scores.",
    href: `${API_BASE}/reports/works.csv`,
  },
];

const UNAVAILABLE = [
  { title: "Fund Summary", description: "Not yet exposed as a backend export endpoint." },
  { title: "District Analysis", description: "Not yet exposed as a backend export endpoint." },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="font-heading text-2xl font-bold text-primary">Reports</h1>
        <p className="mt-1 text-[13px] text-text-secondary">
          Kept deliberately simple relative to the core risk → evidence → inspection workflow.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {AVAILABLE.map((r) => (
          <div key={r.title} className="rounded-[var(--radius-md)] border border-border bg-surface p-5">
            <div className="font-heading text-[13px] font-bold text-text-primary">{r.title}</div>
            <p className="mt-1 text-[12px] text-text-secondary">{r.description}</p>
            <a
              href={r.href}
              className="mt-4 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-accent px-4 py-2 text-xs font-bold text-white shadow-[var(--shadow-card)] transition-colors hover:bg-accent/90"
            >
              <Download size={13} /> CSV
            </a>
          </div>
        ))}
        {UNAVAILABLE.map((r) => (
          <div key={r.title} className="rounded-[var(--radius-md)] border border-dashed border-border bg-surface-soft p-5 opacity-70">
            <div className="font-heading text-[13px] font-bold text-text-primary">{r.title}</div>
            <p className="mt-1 text-[12px] text-text-secondary">{r.description}</p>
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-border bg-surface px-3.5 py-1.5 text-xs font-semibold text-text-muted">
              <Lock size={13} /> Not available
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
