import { Search, ListOrdered, ClipboardCheck, ShieldCheck, ArrowUpCircle, CheckCircle2 } from "lucide-react";

const STEPS = [
  { label: "Detection", icon: Search },
  { label: "Prioritization", icon: ListOrdered },
  { label: "Inspection", icon: ClipboardCheck },
  { label: "Verification", icon: ShieldCheck },
  { label: "Escalation", icon: ArrowUpCircle },
  { label: "Resolution", icon: CheckCircle2 },
];

export function WorkflowStepper({ activeIndex = 2 }: { activeIndex?: number }) {
  return (
    <div className="flex items-center overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface px-5 py-4 shadow-[var(--shadow-card)]">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <div key={step.label} className="flex flex-none items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                  active
                    ? "border-accent bg-accent-soft text-accent"
                    : done
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-surface text-text-muted"
                }`}
              >
                <Icon size={15} />
              </div>
              <span className={`whitespace-nowrap text-[10.5px] font-semibold ${active ? "text-accent" : done ? "text-primary" : "text-text-muted"}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 ? (
              <div className={`mx-2 h-[2px] w-8 sm:w-14 ${i < activeIndex ? "bg-primary" : "bg-border"}`} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
