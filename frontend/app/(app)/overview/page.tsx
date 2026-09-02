"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { CheckCircle2, TrendingUp, Wallet, ShieldCheck, ArrowRight, AlertOctagon, Timer, CreditCard, FileWarning } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useRole } from "@/lib/role-context";
import { KpiCard } from "@/components/KpiCard";
import { CardGrid } from "@/components/CardGrid";
import { RiskBadge } from "@/components/RiskBadge";
import { RiskDistributionDonut } from "@/components/RiskDistributionDonut";
import { TrendChart } from "@/components/TrendChart";
import { TrendKpiCard } from "@/components/TrendKpiCard";
import { SnapshotCard } from "@/components/SnapshotCard";
import { PriorityAlertsRail } from "@/components/PriorityAlertsRail";
import { InspectionQueuePreview } from "@/components/InspectionQueuePreview";
import { KpiSkeletonRow, CardSkeleton, Skeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { SectionHead } from "@/components/SectionHead";
import { staggerReveal, sectionReveal } from "@/lib/animations";
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

const RISK_LABEL: Record<string, { color: string; bg: string }> = {
  CRITICAL: { color: "var(--color-risk-high)", bg: "var(--color-risk-high-bg)" },
  HIGH: { color: "var(--color-risk-high)", bg: "var(--color-risk-high-bg)" },
  MEDIUM: { color: "var(--color-risk-medium)", bg: "var(--color-risk-medium-bg)" },
  LOW: { color: "var(--color-risk-low)", bg: "var(--color-risk-low-bg)" },
};
const PRIORITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export default function OverviewPage() {
  const { role, scope, setScope } = useRole();
  const overview = useApi(() => api.overview(), []);
  const geo = useApi(() => api.geoRiskByState(), []);
  const attention = useApi(
    () => api.riskIntelligence({ min_score: 60, page: 1, page_size: 3, state: scope.state }),
    [scope.state]
  );
  const stateAnalytics = useApi(() => api.analytics("state"), []);
  const yoyAnalytics = useApi(() => api.analytics("year_over_year"), []);

  const header = ROLE_HEADER[role ?? "ministry"];
  const attentionRef = useRef<HTMLDivElement>(null);
  const trendSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (attentionRef.current) staggerReveal(attentionRef.current.querySelectorAll(":scope > div"));
  }, [attention.data]);

  useEffect(() => {
    if (!trendSectionRef.current) return;
    return sectionReveal(trendSectionRef.current);
  }, []);

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

  const priorityBreakdown = useMemo(() => {
    const dist = overview.data?.risk_distribution;
    if (!dist) return [];
    const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
    return PRIORITY_ORDER.filter((k) => dist[k] !== undefined).map((k) => ({
      key: k,
      count: dist[k],
      pct: (dist[k] / total) * 100,
    }));
  }, [overview.data]);

  const yoyRows = yoyAnalytics.data?.data ?? [];
  const yoyLabels = yoyRows.map((r) => String(r.Expenditure_Year));
  const yoyValues = yoyRows.map((r) => Number(r.expenditure ?? 0));
  const yoyWorksValues = yoyRows.map((r) => Number(r.works ?? 0));
  const stateLabels = (stateAnalytics.data?.data ?? []).slice(0, 8).map((r) => String(r.State ?? "—"));
  const stateValues = (stateAnalytics.data?.data ?? []).slice(0, 8).map((r) => Number(r.sum ?? 0));

  return (
    <div className="space-y-5 pb-8">
      <div>
        <h1 className="font-heading text-[30px] font-bold text-primary">{header.title}</h1>
        <p className="mt-1 text-[14px] italic text-text-secondary">&ldquo;{header.subtitle}&rdquo;</p>
        {scope.state ? (
          <p className="mt-1.5 flex items-center gap-2 text-[12px] text-accent">
            Scoped to {scope.state} (from the India Risk Map)
            <button onClick={() => setScope({})} className="font-semibold underline hover:no-underline">
              Clear scope
            </button>
          </p>
        ) : null}
      </div>

      {/* Hero row — one shared-border grid: snapshot cell | two stacked trend cells */}
      <section className="overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-card)]">
        {overview.loading ? (
          <div className="grid grid-cols-1 divide-y divide-border-subtle lg:grid-cols-[1fr_1fr] lg:divide-x lg:divide-y-0">
            <div className="p-5">
              <Skeleton className="h-48 w-full" />
            </div>
            <div className="grid grid-rows-2 divide-y divide-border-subtle">
              <div className="p-5">
                <Skeleton className="h-20 w-full" />
              </div>
              <div className="p-5">
                <Skeleton className="h-20 w-full" />
              </div>
            </div>
          </div>
        ) : overview.data ? (
          <div className="grid grid-cols-1 divide-y divide-border-subtle lg:grid-cols-[1fr_1fr] lg:divide-x lg:divide-y-0">
            <SnapshotCard
              bare
              title="Intelligence Snapshot"
              subtitle="Computed from data — never hardcoded"
              rows={[
                { label: "High-Risk Works", value: overview.data.intelligence_kpis.high_risk_works, icon: AlertOctagon, tone: "risk" },
                { label: "Delayed Works", value: overview.data.intelligence_kpis.delayed_works, icon: Timer },
                { label: "Payment Alerts", value: overview.data.intelligence_kpis.payment_alerts, icon: CreditCard },
                { label: "Compliance Alerts", value: overview.data.intelligence_kpis.compliance_alerts, icon: FileWarning },
              ]}
            />
            <div className="grid grid-rows-2 divide-y divide-border-subtle">
              <TrendKpiCard
                bare
                label="Sanctioned"
                value={overview.data.basic_kpis.sanctioned ?? 0}
                format={(n) => formatCurrency(n)}
                hint="Year-over-year expenditure trend"
                sparkline={yoyValues}
              />
              <TrendKpiCard
                bare
                label="Total Works Scored"
                value={overview.data.basic_kpis.total_works}
                format={(n) => Math.round(n).toLocaleString("en-IN")}
                hint="Year-over-year works volume"
                sparkline={yoyWorksValues}
                sparklineType="bar"
              />
            </div>
          </div>
        ) : (
          <div className="p-5">
            <ErrorState message={overview.error ?? "Could not load overview."} onRetry={overview.reload} />
          </div>
        )}
      </section>

      {/* Main / rail split — dense left column, condensed action rail on the right */}
      <section className="grid items-start gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div>
            <SectionHead title="Basic KPIs" />
            {overview.loading ? (
              <KpiSkeletonRow />
            ) : overview.error ? (
              <ErrorState message={overview.error} onRetry={overview.reload} />
            ) : overview.data ? (
              <CardGrid cols={4}>
                <KpiCard bare label="Total Works" value={overview.data.basic_kpis.total_works} icon={ShieldCheck} />
                <KpiCard
                  bare
                  label="Recommended"
                  value={overview.data.basic_kpis.recommended ?? "—"}
                  hint={overview.data.basic_kpis.recommended == null ? "Not present in source data" : undefined}
                  icon={TrendingUp}
                />
                <KpiCard
                  bare
                  label="Sanctioned"
                  value={overview.data.basic_kpis.sanctioned != null ? formatCurrency(overview.data.basic_kpis.sanctioned) : "—"}
                  icon={Wallet}
                />
                <KpiCard bare label="Completed" value={overview.data.basic_kpis.completed ?? 0} icon={CheckCircle2} />
              </CardGrid>
            ) : null}
          </div>

          <div>
            <SectionHead title="India Risk Map" tag="State-level risk overview" />
            <div className="rounded-[var(--radius-md)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
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
          </div>

          <CardGrid cols={2}>
            <div className="p-4">
              <SectionHead title="Risk Distribution" />
              {overview.loading ? <Skeleton className="h-56 w-full" /> : overview.data ? (
                <RiskDistributionDonut distribution={overview.data.risk_distribution} />
              ) : null}
            </div>
            <div className="flex flex-col p-5">
              <SectionHead title="Priority Breakdown" />
              <div className="flex flex-1 flex-col justify-center gap-3">
                {overview.loading ? (
                  <Skeleton className="h-40 w-full" />
                ) : priorityBreakdown.length > 0 ? (
                  priorityBreakdown.map((p) => (
                    <div key={p.key}>
                      <div className="mb-1 flex items-center justify-between text-[12.5px]">
                        <span className="font-semibold" style={{ color: RISK_LABEL[p.key]?.color }}>
                          {p.key}
                        </span>
                        <span className="text-text-muted">{formatNumber(p.count)} works</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-border-subtle">
                        <div
                          className="h-full rounded-full transition-[width] duration-700"
                          style={{ width: `${p.pct}%`, background: RISK_LABEL[p.key]?.color }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState title="No risk distribution available." />
                )}
                <Link
                  href="/risk-intelligence"
                  className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-[var(--radius-sm)] bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-secondary"
                >
                  View High-Risk Works <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </CardGrid>

          <CardGrid cols={2} ref={trendSectionRef}>
            <div className="p-4">
              <SectionHead title="Expenditure Trend" tag="year-over-year" />
              <div className="h-56">
                {yoyAnalytics.loading ? (
                  <Skeleton className="h-full w-full" />
                ) : yoyAnalytics.error ? (
                  <ErrorState message={yoyAnalytics.error} onRetry={yoyAnalytics.reload} />
                ) : yoyLabels.length > 0 ? (
                  <TrendChart type="line" labels={yoyLabels} values={yoyValues} />
                ) : (
                  <EmptyState title="No year-over-year data available." />
                )}
              </div>
            </div>
            <div className="p-4">
              <SectionHead title="State Comparison" tag="top states by expenditure" />
              <div className="h-56">
                {stateAnalytics.loading ? (
                  <Skeleton className="h-full w-full" />
                ) : stateAnalytics.error ? (
                  <ErrorState message={stateAnalytics.error} onRetry={stateAnalytics.reload} />
                ) : stateLabels.length > 0 ? (
                  <TrendChart type="bar" labels={stateLabels} values={stateValues} />
                ) : (
                  <EmptyState title="No state comparison data available." />
                )}
              </div>
            </div>
          </CardGrid>
        </div>

        {/* Right rail — condensed action-oriented widgets, one shared-border stack */}
        <CardGrid cols={1}>
          <PriorityAlertsRail bare state={scope.state} />
          <InspectionQueuePreview bare />
          <div className="p-5">
            <div className="text-[15px] font-semibold text-primary">Data Coverage</div>
            {overview.loading ? (
              <Skeleton className="mt-3 h-24 w-full" />
            ) : (
              <div className="mt-3 space-y-1.5 border-t border-border-subtle pt-3">
                {coverageEntries.map(([label, ok]) => (
                  <div key={label} className="flex items-center justify-between text-[13px]">
                    <span className="text-text-secondary">{label}</span>
                    <span className={ok ? "font-semibold text-risk-low" : "font-semibold text-text-muted"}>{ok ? "✓" : "✕"}</span>
                  </div>
                ))}
                <div className="mt-2 flex items-center justify-between border-t border-border-subtle pt-2 text-[12px] font-bold uppercase tracking-wide text-risk-low">
                  <span>Coverage</span>
                  <span>{coveragePercent ?? "—"}%</span>
                </div>
              </div>
            )}
          </div>
        </CardGrid>
      </section>

      <section>
        <SectionHead title="Works Requiring Attention" tag="Highest-priority works requiring verification" />
        {attention.loading ? (
          <div className="grid gap-4 md:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : attention.error ? (
          <ErrorState message={attention.error} onRetry={attention.reload} />
        ) : attention.data && attention.data.data.length > 0 ? (
          <CardGrid cols={3} ref={attentionRef}>
            {attention.data.data.map((w) => (
              <div key={w.work_key} className="group p-4 transition-colors hover:bg-surface-soft">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[12px] font-mono text-text-muted">MPLADS/{w.work_key}</div>
                  <RiskBadge level={String(w.priority ?? w.Risk_Category ?? "")} />
                </div>
                <div className="mt-1.5 line-clamp-2 text-[15px] font-semibold text-text-primary">
                  {w["Work Description"] ?? "Untitled work"}
                </div>
                <div className="mt-0.5 text-[12px] text-text-muted">
                  {String(w.Constituency ?? "—")}, {String(w.State ?? "—")}
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="font-heading text-2xl font-bold text-primary">{w.score?.toFixed(0)}</span>
                  <span className="text-[12px] text-text-muted">/ 100</span>
                </div>
                {w.reasons && w.reasons.length > 0 ? (
                  <ul className="mt-2 space-y-1 border-t border-border-subtle pt-2">
                    {w.reasons.map((reason, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[12px] leading-snug text-text-secondary">
                        <span className="mt-1 h-1 w-1 flex-none rounded-full bg-risk-high" />
                        {reason}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/risk-intelligence/${encodeURIComponent(w.work_key)}`}
                    className="flex-1 rounded-[var(--radius-sm)] border border-border py-1.5 text-center text-xs font-semibold text-text-primary transition-colors hover:bg-surface-soft"
                  >
                    View Risk
                  </Link>
                  <Link
                    href={`/works/${encodeURIComponent(w.work_key)}`}
                    className="flex-1 rounded-[var(--radius-sm)] bg-primary py-1.5 text-center text-xs font-semibold text-white transition-colors hover:bg-primary-secondary"
                  >
                    Inspect
                  </Link>
                </div>
              </div>
            ))}
          </CardGrid>
        ) : (
          <EmptyState title="No high-risk works found for the selected scope." />
        )}
      </section>
    </div>
  );
}
