"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { FilterBar, type FilterField } from "@/components/FilterBar";
import { HouseToggle } from "@/components/HouseToggle";
import { DataTable, type Column } from "@/components/DataTable";
import { RiskBadge } from "@/components/RiskBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { TableSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { formatCurrency } from "@/lib/utils";
import type { WorkRow } from "@/lib/types";

const FIELDS: FilterField[] = [
  { key: "search", label: "Search description", type: "text" },
  { key: "state", label: "State", type: "text" },
  { key: "constituency", label: "Constituency", type: "text" },
  { key: "mp", label: "MP", type: "text" },
  { key: "vendor", label: "Vendor", type: "text" },
  {
    key: "risk",
    label: "Risk Level",
    type: "select",
    options: [
      { value: "CRITICAL", label: "Critical" },
      { value: "HIGH", label: "High" },
      { value: "MEDIUM", label: "Medium" },
      { value: "LOW", label: "Low" },
    ],
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "New", label: "New" },
      { value: "Under Review", label: "Under Review" },
      { value: "Verification Required", label: "Verification Required" },
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
  { key: "State", label: "State" },
  { key: "Constituency", label: "Constituency" },
  { key: "MP Name", label: "MP" },
  {
    key: "Allocated Amount (₹)",
    label: "Allocated (MP)",
    render: (r) => formatCurrency(r["Allocated Amount (₹)"] as number | undefined),
  },
  {
    key: "Expenditure Amount (₹)",
    label: "This txn.",
    render: (r) => formatCurrency(r["Expenditure Amount (₹)"] as number | undefined),
  },
  { key: "risk_score", label: "Risk", render: (r) => <RiskBadge level={String(r.Risk_Category ?? "")} /> },
  { key: "status", label: "Status", render: (r) => <StatusBadge status={String(r.Risk_Status ?? "New")} /> },
];

function WorksPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [house, setHouse] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    // Seeds the filter from a deep link (e.g. the India Risk Map's
    // click-to-scope navigation to /works?state=...) — syncing from the URL,
    // an external source, is exactly what this effect is for.
    const state = searchParams.get("state");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state) setFilters((f) => ({ ...f, state }));
  }, [searchParams]);

  const result = useApi(
    () =>
      api.works({
        search: filters.search || undefined,
        state: filters.state || undefined,
        constituency: filters.constituency || undefined,
        mp: filters.mp || undefined,
        vendor: filters.vendor || undefined,
        house: house || undefined,
        risk: filters.risk || undefined,
        status: filters.status || undefined,
        page,
        page_size: 15,
      }),
    [filters, house, page]
  );

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary">Works</h1>
          <p className="mt-1 text-[13px] text-text-secondary">Full searchable register of MPLADS works.</p>
        </div>
        <div className="flex flex-none flex-col items-end gap-1.5">
          <HouseToggle
            value={house}
            onChange={(v) => {
              setHouse(v);
              setPage(1);
            }}
          />
          {result.data ? (
            <span className="text-xs text-text-muted">{result.data.meta.total.toLocaleString("en-IN")} total records</span>
          ) : null}
        </div>
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
        <TableSkeleton cols={8} />
      ) : result.error ? (
        <ErrorState message={result.error} onRetry={result.reload} />
      ) : result.data && result.data.data.length > 0 ? (
        <DataTable
          columns={COLUMNS}
          rows={result.data.data}
          meta={result.data.meta}
          onPageChange={setPage}
          onRowClick={(row) => router.push(`/works/${encodeURIComponent(row.work_key)}`)}
        />
      ) : (
        <EmptyState title="No works match these filters." />
      )}
    </div>
  );
}

export default function WorksPage() {
  return (
    <Suspense fallback={<TableSkeleton cols={8} />}>
      <WorksPageInner />
    </Suspense>
  );
}
