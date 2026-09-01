export function Footer() {
  return (
    <footer className="border-t border-border bg-surface px-6 py-4 text-[11px] text-text-muted">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <p>
            <span className="font-semibold text-text-secondary">MPLADS AI</span> — Risk &amp; Monitoring Intelligence ·
            Prototype Dataset · Analysis based on accessible MPLADS records.
          </p>
          <p>This is a decision-support prototype. Risk signals require official verification before any action is taken.</p>
        </div>
        <div className="flex flex-none items-center gap-1.5 text-[10.5px]">
          <span className="h-1.5 w-1.5 rounded-full bg-risk-low" />
          <span>Data available · Not a live government integration</span>
        </div>
      </div>
    </footer>
  );
}
