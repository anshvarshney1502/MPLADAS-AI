import { cn } from "@/lib/utils";

/**
 * Groups related metric cells (rendered with `bare`) into one shared
 * container — a single border/shadow with thin divider lines between
 * cells, instead of each cell being its own separate bordered card. Matches
 * how grouped stats sit together in premium dashboard references (e.g. two
 * related KPIs side by side, split by one hairline rather than a gap).
 */
export function CardGrid({
  children,
  cols = 2,
  className,
  ref,
}: {
  children: React.ReactNode;
  cols?: 1 | 2 | 3 | 4;
  className?: string;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const colsClass = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" }[cols];
  return (
    <div
      ref={ref}
      className={cn(
        "grid grid-cols-1 divide-y divide-border-subtle overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-card)]",
        cols > 1 && "sm:divide-x sm:divide-y-0",
        colsClass,
        className
      )}
    >
      {children}
    </div>
  );
}
