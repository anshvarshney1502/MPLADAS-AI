import { formatCurrency, formatPercent } from "@/lib/utils";
import type { RiskEvidence } from "@/lib/types";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[11px] text-text-muted">{label}</span>
      <span className="text-xs font-semibold text-text-primary">{value}</span>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
      <div className="text-[11px] font-bold uppercase tracking-wide text-text-muted">{title}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function EvidenceGrid({ evidence }: { evidence: RiskEvidence }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Block title="Financial">
        <Row label="Sanctioned (MP allocation)" value={formatCurrency(evidence.financial.allocated_amount)} />
        <Row label="Total expenditure" value={formatCurrency(evidence.financial.total_expenditure)} />
        <Row label="This transaction" value={formatCurrency(evidence.financial.transaction_amount)} />
        <Row label="Utilization" value={formatPercent(evidence.financial.utilization)} />
      </Block>
      <Block title="Peer comparison">
        <Row label="MP average transaction" value={formatCurrency(evidence.comparison.mp_average_transaction)} />
        <Row
          label="This vs. MP average"
          value={evidence.comparison.amount_vs_mp_average != null ? `${evidence.comparison.amount_vs_mp_average.toFixed(1)}x` : "—"}
        />
      </Block>
      <Block title="Payment">
        <Row label="Status" value={evidence.payment.status ?? "—"} />
        <Row label="Successful" value={evidence.payment.successful} />
        <Row label="Pending" value={evidence.payment.pending} />
      </Block>
      <Block title="Vendor">
        <Row label="Transactions with this vendor" value={evidence.vendor.transaction_count} />
      </Block>
    </div>
  );
}
