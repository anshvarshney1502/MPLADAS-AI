"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { cn, formatNumber } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "risk";
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  // A brief, purposeful entrance — not a number count-up. Reads as a data
  // panel settling into place, not a demo-mode "watch the digits spin" trick.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const tween = gsap.fromTo(el, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.25, ease: "power1.out" });
    return () => {
      tween.kill();
    };
  }, [value]);

  const display = typeof value === "number" ? formatNumber(value) : value;

  return (
    <div
      ref={cardRef}
      className="rounded-[var(--radius-md)] border border-border bg-surface p-4 text-center shadow-[var(--shadow-card)]"
    >
      <div className="flex items-center justify-center gap-1.5">
        <span className="text-[12.5px] text-text-secondary">{label}</span>
        {Icon ? <Icon size={13} className="text-text-muted" /> : null}
      </div>
      <div className={cn("mt-1.5 font-heading text-2xl font-bold tracking-tight", tone === "risk" ? "text-risk-high" : "text-primary")}>
        {display}
      </div>
      {hint ? <div className="mt-0.5 text-[11px] text-text-muted">{hint}</div> : null}
    </div>
  );
}
