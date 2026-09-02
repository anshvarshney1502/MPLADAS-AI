"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";
import { countUp, staggerReveal } from "@/lib/animations";
import type { LucideIcon } from "lucide-react";

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  bare = false,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "risk";
  /** When true, renders as a plain cell with no border/shadow/radius of its
   * own — for use inside a <CardGrid>, which draws one shared border and
   * separates cells with thin divider lines instead of each cell floating
   * as its own bordered card. */
  bare?: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (card) staggerReveal([card]);
  }, []);

  useEffect(() => {
    const el = valueRef.current;
    if (!el) return;
    if (typeof value === "number") {
      const tween = countUp(el, value, (n) => Math.round(n).toLocaleString("en-IN"));
      return () => {
        tween.kill();
      };
    }
    el.textContent = value;
  }, [value]);

  function onEnter() {
    if (cardRef.current) gsap.to(cardRef.current, { y: -3, duration: 0.18, ease: "power2.out" });
  }
  function onLeave() {
    if (cardRef.current) gsap.to(cardRef.current, { y: 0, duration: 0.18, ease: "power2.out" });
  }

  return (
    <div
      ref={cardRef}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className={cn(
        "p-4",
        bare ? "bg-surface" : "rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]"
      )}
    >
      <div className="flex items-center gap-2.5">
        {Icon ? (
          <div
            className={cn(
              "flex h-8 w-8 flex-none items-center justify-center rounded-[var(--radius-sm)]",
              tone === "risk" ? "bg-risk-high-bg text-risk-high" : "bg-accent-soft text-accent"
            )}
          >
            <Icon size={15} strokeWidth={2.2} />
          </div>
        ) : null}
        <span className="text-[12px] font-semibold uppercase tracking-wide text-text-muted">{label}</span>
      </div>
      <div
        ref={valueRef}
        className={cn("mt-3 font-heading text-[28px] font-bold leading-none tracking-tight", tone === "risk" ? "text-risk-high" : "text-primary")}
      >
        0
      </div>
      {hint ? <div className="mt-1.5 text-[12px] text-text-muted">{hint}</div> : null}
    </div>
  );
}
