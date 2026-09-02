"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { PageMeta } from "@/lib/types";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
}

export function DataTable<T extends { work_key?: string }>({
  columns,
  rows,
  onRowClick,
  meta,
  onPageChange,
  onPageSizeChange,
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  meta?: PageMeta;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  rowKey?: (row: T, index: number) => string;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  // Sorts the currently loaded page of rows — the backend doesn't expose an
  // arbitrary sort parameter, so this reorders what's on screen rather than
  // re-querying the full dataset in sorted order.
  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const getVal = col.sortValue ?? ((row: T) => (row as Record<string, unknown>)[col.key] as string | number);
    return [...rows].sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * sort.dir;
      return String(va).localeCompare(String(vb)) * sort.dir;
    });
  }, [rows, sort, columns]);

  function toggleSort(key: string) {
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: 1 };
      if (s.dir === 1) return { key, dir: -1 };
      return null;
    });
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-table-head-bg">
              {columns.map((c) => {
                const sortable = c.sortable !== false;
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    onClick={sortable ? () => toggleSort(c.key) : undefined}
                    className={
                      "whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-table-head-text " +
                      (sortable ? "cursor-pointer select-none hover:bg-black/5" : "")
                    }
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      {sortable ? (
                        active ? (
                          sort!.dir === 1 ? (
                            <ChevronUp size={12} />
                          ) : (
                            <ChevronDown size={12} />
                          )
                        ) : (
                          <ChevronsUpDown size={12} className="text-text-muted/60" />
                        )
                      ) : null}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => (
              <tr
                key={rowKey ? rowKey(row, i) : row.work_key ?? i}
                onClick={() => onRowClick?.(row)}
                className={
                  "border-b border-border-subtle last:border-0 " +
                  (onRowClick ? "cursor-pointer transition-colors hover:bg-surface-soft" : "")
                }
              >
                {columns.map((c) => (
                  <td key={c.key} className={"whitespace-nowrap px-4 py-2.5 text-text-secondary " + (c.className ?? "")}>
                    {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {meta ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-xs text-text-muted">
          <span>
            Page {meta.page} of {Math.max(meta.total_pages, 1)} · {meta.total.toLocaleString("en-IN")} records
          </span>
          <div className="flex items-center gap-3">
            {onPageSizeChange ? (
              <label className="flex items-center gap-1.5">
                Rows per page
                <select
                  value={meta.page_size}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className="rounded-[var(--radius-sm)] border border-border bg-surface px-1.5 py-1 text-xs text-text-secondary outline-none focus:border-accent"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="flex items-center gap-1">
              <button
                disabled={meta.page <= 1}
                onClick={() => onPageChange?.(meta.page - 1)}
                className="rounded-[var(--radius-sm)] border border-border p-1 disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                disabled={meta.page >= meta.total_pages}
                onClick={() => onPageChange?.(meta.page + 1)}
                className="rounded-[var(--radius-sm)] border border-border p-1 disabled:opacity-40"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
