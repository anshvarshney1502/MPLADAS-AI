import { AlertTriangle } from "lucide-react";

export function ErrorState({
  message = "We couldn't load this data.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-md)] border border-risk-high/20 bg-risk-high-bg px-6 py-14 text-center">
      <AlertTriangle size={28} className="text-risk-high" />
      <p className="font-heading text-sm font-semibold text-risk-high">{message}</p>
      {onRetry ? (
        <button
          onClick={onRetry}
          className="mt-1 rounded-[var(--radius-sm)] border border-risk-high/30 bg-surface px-4 py-1.5 text-xs font-semibold text-risk-high transition-colors hover:bg-risk-high hover:text-white"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
