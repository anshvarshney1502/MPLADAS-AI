"use client";

import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "", label: "All" },
  { value: "Lok Sabha", label: "Lok Sabha" },
  { value: "Rajya Sabha", label: "Rajya Sabha" },
];

export function HouseToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface p-1">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors",
            value === o.value ? "bg-accent text-white" : "text-text-secondary hover:bg-surface-soft"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
