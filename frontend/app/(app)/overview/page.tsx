"use client";

import Link from "next/link";
import { useMemo } from "react";
import dynamic from "next/dynamic";
import { CheckCircle2, TrendingUp, AlertOctagon, Wallet, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useRole } from "@/lib/role-context";
import { KpiCard } from "@/components/KpiCard";
import { RiskBadge } from "@/components/RiskBadge";
import { RiskDistributionDonut } from "@/components/RiskDistributionDonut";
import { KpiSkeletonRow, CardSkeleton, Skeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { SectionHead } from "@/components/SectionHead";
import { formatCurrency, formatNumber } from "@/lib/utils";

const IndiaRiskMap = dynamic(() => import("@/components/IndiaRiskMap").then((m) => m.IndiaRiskMap), {
  ssr: false,
  loading: () => <div className="flex h-72 items-center justify-center text-xs text-text-muted">Loading map…</div>,
});

const ROLE_HEADER: Record<string, { title: string; subtitle: string }> = {
  ministry: { title: "National Monitoring Overview", subtitle: "AI identifies where to look first — officials verify and decide." },
  state: { title: "State Monitoring Overview", subtitle: "Which district needs attention first?" },
  district: { title: "District Monitoring Overview", subtitle: "What should be inspected first?" },
  mp: { title: "Constituency Overview", subtitle: "Status of works recommended in your constituency." },
};

export default function OverviewPage() {
  const { role, scope, setScope } = useRole();
  const overview = useApi(() => api.overview(), []);
  const geo = useApi(() => api.geoRiskByState(), []);
  const attention = useApi(
    () => api.riskIntelligence({ min_score: 60, page: 1, page_size: 3, state: scope.state }),
    [scope.state]
  );

  const header = ROLE_HEADER[role ?? "ministry"];

  const coverageEntries = useMemo(() => {
    const c = overview.data?.data_coverage;
    if (!c) return [];
    return [
      ["Financial", c.financial],
      ["Timeline", c.timeline],
      ["Payments", c.payments],
      ["Progress", c.progress],
      ["Vendor", c.vendor],
    ] as [string, boolean][];
  }, [overview.data]);

  const coveragePercent = coverageEntries.length
    ? Math.round((coverageEntries.filter(([, v]) => v).length / coverageEntries.length) * 100)
    : null;

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="font-heading text-2xl font-bold text-primary">{header.title}</h1>
        <p className="mt-1 text-[13px] italic text-text-secondary">&ldquo;{header.subtitle}&rdquo;</p>
        {scope.state ? (
          <p className="mt-1 flex items-center gap-2 text-[11px] text-accent">
            Scoped to {scope.state} (from the India Risk Map)
            <button onClick={() => setScope({})} className="font-semibold underline hover:no-underline">
              Clear scope
            </button>
          </p>
        ) : null}
      </div>

      <section>
        <SectionHead title="Basic KPIs" />
        {overview.loading ? (
          <KpiSkeletonRow />
        ) : overview.error ? (
          <ErrorState message={overview.error} onRetry={overview.reload} />
        ) : overview.data ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Total Works" value={overview.data.basic_kpis.total_works} icon={ShieldCheck} />
            <KpiCard
              label="Recommended"
              value={overview.data.basic_kpis.recommended ?? "—"}
              hint={overview.data.basic_kpis.recommended == null ? "Not present in source data" : undefined}
              icon={TrendingUp}
            />
            <KpiCard
              label="Sanctioned"
              value={overview.data.basic_kpis.sanctioned != null ? formatCurrency(overview.data.basic_kpis.sanctioned) : "—"}
              icon={Wallet}
            />
            <KpiCard label="Completed" value={overview.data.basic_kpis.completed ?? 0} icon={CheckCircle2} />
          </div>
        ) : null}
      </section>

      <section>
        <SectionHead title="Intelligence KPIs" tag="computed from data — never hardcoded" />
        {overview.loading ? (
          <KpiSkeletonRow />
        ) : overview.data ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="High-Risk Works" value={overview.data.intelligence_kpis.high_risk_works} icon={AlertOctagon} tone="risk" />
            <KpiCard label="Delayed Works" value={overview.data.intelligence_kpis.delayed_works} icon={AlertOctagon} />
            <KpiCard label="Payment Alerts" value={overview.data.intelligence_kpis.payment_alerts} icon={AlertOctagon} />
            <KpiCard label="Compliance Alerts" value={overview.data.intelligence_kpis.compliance_alerts} icon={AlertOctagon} />
          </div>
        ) : null}
      </section>

      <section>
        <SectionHead title="Data Coverage" />
        {overview.loading ? (
          <CardSkeleton />
        ) : (
          <div className="flex flex-wrap items-center gap-5 rounded-[var(--radius-md)] border border-border bg-surface p-4">
            {coverageEntries.map(([label, ok]) => (
              <span key={label} className={`text-xs font-semibold ${ok ? "text-risk-low" : "text-text-muted"}`}>
                {ok ? "✓" : "✕"} {label}
              </span>
            ))}
            <span className="ml-auto border border-risk-low/30 bg-risk-low-bg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-risk-low">
              Coverage {coveragePercent ?? "—"}%
            </span>
          </div>
        )}
        <p className="mt-2 text-[11px] text-text-muted">Prototype dataset · analysis based on accessible MPLADS records.</p>
      </section>

      <section>
        <SectionHead title="India Risk Map" />
        <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
          {geo.loading ? (
            <Skeleton className="h-72 w-full" />
          ) : geo.error ? (
            <ErrorState message={geo.error} onRetry={geo.reload} />
          ) : geo.data && geo.data.data.length > 0 ? (
            <IndiaRiskMap data={geo.data.data} />
          ) : (
            <EmptyState title="No state-level risk data available." />
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div>
          <SectionHead title="Risk Distribution" />
          <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
            {overview.loading ? <Skeleton className="h-56 w-full" /> : overview.data ? (
              <RiskDistributionDonut distribution={overview.data.risk_distribution} />
            ) : null}
          </div>
        </div>
        <div>
          <SectionHead title="Highest Attention" />
          <div className="flex h-[calc(100%-2rem)] flex-col justify-center rounded-[var(--radius-md)] border border-border bg-surface p-5">
            <p className="text-2xl font-heading font-bold text-risk-high">
              {overview.data ? formatNumber(overview.data.intelligence_kpis.high_risk_works) : "—"} high-risk works
            </p>
            <p className="mt-1 text-xs text-text-secondary">Requires priority verification before further sanction.</p>
            <Link
              href="/risk-intelligence"
              className="mt-4 inline-flex w-fit rounded-[var(--radius-sm)] bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-secondary"
            >
              View High-Risk Works
            </Link>
          </div>
        </div>
      </section>

      <section>
        <SectionHead title="Works Requiring Attention" tag="primary product differentiator" />
        {attention.loading ? (
          <div className="grid gap-4 md:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : attention.error ? (
          <ErrorState message={attention.error} onRetry={attention.reload} />
        ) : attention.data && attention.data.data.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-3">
            {attention.data.data.map((w) => (
              <div key={w.work_key} className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
                <div className="text-[10.5px] font-mono text-text-muted">MPLADS/{w.work_key}</div>
                <div className="mt-1 line-clamp-2 font-heading text-[13px] font-semibold text-text-primary">
                  {w["Work Description"] ?? "Untitled work"}
                </div>
                <div className="mt-0.5 text-[11px] text-text-muted">
                  {String(w.Constituency ?? "—")}, {String(w.State ?? "—")}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="font-heading text-lg font-bold text-primary">{w.score?.toFixed(0)}/100</span>
                  <RiskBadge level={String(w.priority ?? w.Risk_Category ?? "")} />
                </div>
                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/risk-intelligence/${encodeURIComponent(w.work_key)}`}
                    className="flex-1 rounded-[var(--radius-sm)] border border-border py-1.5 text-center text-xs font-semibold text-text-primary hover:bg-surface-soft"
                  >
                    View Risk
                  </Link>
                  <Link
                    href={`/works/${encodeURIComponent(w.work_key)}`}
                    className="flex-1 rounded-[var(--radius-sm)] bg-primary py-1.5 text-center text-xs font-semibold text-white hover:bg-primary-secondary"
                  >
                    Inspect
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No high-risk works found for the selected scope." />
        )}
      </section>
    </div>
  );
}
