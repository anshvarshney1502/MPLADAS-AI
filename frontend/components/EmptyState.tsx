import { Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  title = "No results match these filters.",
  description,
  icon: Icon = Inbox,
}: {
  title?: string;
  description?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-border bg-surface-soft px-6 py-14 text-center">
      <Icon size={28} className="text-text-muted" />
      <p className="font-heading text-sm font-semibold text-text-primary">{title}</p>
      {description ? <p className="max-w-sm text-xs text-text-muted">{description}</p> : null}
    </div>
  );
}
