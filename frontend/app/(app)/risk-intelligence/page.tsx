"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useRole } from "@/lib/role-context";
import { FilterBar, type FilterField } from "@/components/FilterBar";
import { HouseToggle } from "@/components/HouseToggle";
import { DataTable, type Column } from "@/components/DataTable";
import { RiskBadge } from "@/components/RiskBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { TableSkeleton, Skeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { staggerReveal } from "@/lib/animations";
import { cn } from "@/lib/utils";
import type { WorkRow } from "@/lib/types";

const FIELDS: FilterField[] = [
  { key: "state", label: "State", type: "state" },
  {
    key: "risk_type",
    label: "Risk Type",
    type: "select",
    options: [
      { value: "Cost Anomaly", label: "Cost Anomaly" },
      { value: "Payment Anomaly", label: "Payment Anomaly" },
      { value: "Fund Utilization", label: "Fund Utilization" },
      { value: "Delay", label: "Delay" },
      { value: "Compliance", label: "Compliance" },
      { value: "Potential Duplicate", label: "Potential Duplicate" },
      { value: "Network", label: "Network" },
    ],
  },
];

const COLUMNS: Column<WorkRow>[] = [
  { key: "work_key", label: "Work ID", render: (r) => <span className="font-mono text-[11.5px]">{r.work_key}</span> },
  {
    key: "Work Description",
    label: "Work",
    className: "max-w-xs truncate",
    render: (r) => <span className="line-clamp-1">{String(r["Work Description"] ?? "—")}</span>,
  },
  { key: "risk_type", label: "Risk Type" },
  { key: "score", label: "Score", render: (r) => <span className="font-semibold text-text-primary">{r.score?.toFixed(1)}</span> },
  { key: "status", label: "Status", render: (r) => <StatusBadge status={String(r.status ?? "New")} /> },
  { key: "priority", label: "Priority", render: (r) => <RiskBadge level={String(r.priority ?? "")} /> },
];

const LEVELS = [
  { key: "CRITICAL", label: "Critical", color: "var(--color-risk-high)", bg: "var(--color-risk-high-bg)" },
  { key: "HIGH", label: "High", color: "var(--color-risk-high)", bg: "var(--color-risk-high-bg)" },
  { key: "MEDIUM", label: "Medium", color: "var(--color-risk-medium)", bg: "var(--color-risk-medium-bg)" },
  { key: "LOW", label: "Low", color: "var(--color-risk-low)", bg: "var(--color-risk-low-bg)" },
];

export default function RiskIntelligencePage() {
  const router = useRouter();
  const { scope } = useRole();
  const [filters, setFilters] = useState<Record<string, string>>({ state: scope.state ?? "" });
  const [riskLevel, setRiskLevel] = useState("");
  const [house, setHouse] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const summaryRef = useRef<HTMLDivElement>(null);

  const baseParams = { state: filters.state || undefined, risk_type: filters.risk_type || undefined, house: house || undefined };

  const result = useApi(
    () => api.riskIntelligence({ ...baseParams, risk_level: riskLevel || undefined, page, page_size: pageSize }),
    [filters, house, riskLevel, page, pageSize]
  );

  const critical = useApi(() => api.riskIntelligence({ ...baseParams, risk_level: "CRITICAL", page_size: 1 }), [filters, house]);
  const high = useApi(() => api.riskIntelligence({ ...baseParams, risk_level: "HIGH", page_size: 1 }), [filters, house]);
  const medium = useApi(() => api.riskIntelligence({ ...baseParams, risk_level: "MEDIUM", page_size: 1 }), [filters, house]);
  const low = useApi(() => api.riskIntelligence({ ...baseParams, risk_level: "LOW", page_size: 1 }), [filters, house]);
  const counts: Record<string, number | undefined> = {
    CRITICAL: critical.data?.meta.total,
    HIGH: high.data?.meta.total,
    MEDIUM: medium.data?.meta.total,
    LOW: low.data?.meta.total,
  };
  const summaryLoading = critical.loading || high.loading || medium.loading || low.loading;

  useEffect(() => {
    if (summaryRef.current && !summaryLoading) staggerReveal(summaryRef.current.querySelectorAll(":scope > button"));
  }, [summaryLoading]);

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary">Risk Intelligence</h1>
          <p className="mt-1 text-[13px] text-text-secondary">Filterable, ranked feed of every open risk alert.</p>
        </div>
        <HouseToggle
          value={house}
          onChange={(v) => {
            setHouse(v);
            setPage(1);
          }}
        />
      </div>

      {summaryLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <div ref={summaryRef} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {LEVELS.map((lvl) => (
            <button
              key={lvl.key}
              onClick={() => {
                setRiskLevel((cur) => (cur === lvl.key ? "" : lvl.key));
                setPage(1);
              }}
              className={cn(
                "rounded-[var(--radius-md)] border p-3.5 text-left shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-card-hover)]",
                riskLevel === lvl.key ? "border-current" : "border-border"
              )}
              style={{ color: riskLevel === lvl.key ? lvl.color : undefined, background: riskLevel === lvl.key ? lvl.bg : undefined }}
            >
              <div className={cn("text-[11px] font-semibold uppercase tracking-wide", riskLevel === lvl.key ? "" : "text-text-muted")}>
                {lvl.label}
              </div>
              <div
                className="mt-1 font-heading text-xl font-bold"
                style={{ color: riskLevel === lvl.key ? lvl.color : "var(--color-primary)" }}
              >
                {(counts[lvl.key] ?? 0).toLocaleString("en-IN")}
              </div>
            </button>
          ))}
        </div>
      )}

      <FilterBar
        fields={FIELDS}
        values={filters}
        onChange={(v) => {
          setFilters(v);
          setPage(1);
        }}
        onReset={() => {
          setFilters({});
          setRiskLevel("");
          setPage(1);
        }}
      />

      {result.loading ? (
        <TableSkeleton cols={6} />
      ) : result.error ? (
        <ErrorState message={result.error} onRetry={result.reload} />
      ) : result.data && result.data.data.length > 0 ? (
        <DataTable
          columns={COLUMNS}
          rows={result.data.data}
          meta={result.data.meta}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          onRowClick={(row) => router.push(`/risk-intelligence/${encodeURIComponent(row.work_key)}`)}
        />
      ) : (
        <EmptyState title="No works match these filters." />
      )}
    </div>
  );
}
