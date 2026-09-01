"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useRole } from "@/lib/role-context";
import { FilterBar, type FilterField } from "@/components/FilterBar";
import { HouseToggle } from "@/components/HouseToggle";
import { DataTable, type Column } from "@/components/DataTable";
import { RiskBadge } from "@/components/RiskBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { TableSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import type { WorkRow } from "@/lib/types";

const FIELDS: FilterField[] = [
  { key: "state", label: "State", type: "text" },
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
  {
    key: "risk_level",
    label: "Risk Level",
    type: "select",
    options: [
      { value: "CRITICAL", label: "Critical" },
      { value: "HIGH", label: "High" },
      { value: "MEDIUM", label: "Medium" },
      { value: "LOW", label: "Low" },
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

export default function RiskIntelligencePage() {
  const router = useRouter();
  const { scope } = useRole();
  const [filters, setFilters] = useState<Record<string, string>>({ state: scope.state ?? "" });
  const [house, setHouse] = useState("");
  const [page, setPage] = useState(1);

  const result = useApi(
    () =>
      api.riskIntelligence({
        state: filters.state || undefined,
        risk_type: filters.risk_type || undefined,
        risk_level: filters.risk_level || undefined,
        house: house || undefined,
        page,
        page_size: 15,
      }),
    [filters, house, page]
  );

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

      <FilterBar
        fields={FIELDS}
        values={filters}
        onApply={(v) => {
          setFilters(v);
          setPage(1);
        }}
        onReset={() => {
          setFilters({});
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
          onRowClick={(row) => router.push(`/risk-intelligence/${encodeURIComponent(row.work_key)}`)}
        />
      ) : (
        <EmptyState title="No works match these filters." />
      )}
    </div>
  );
}
