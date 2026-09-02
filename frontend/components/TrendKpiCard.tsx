"use client";

import { useEffect, useRef } from "react";
import { countUp, staggerReveal } from "@/lib/animations";
import { MiniSparkline } from "@/components/MiniSparkline";
import { CHART_COLORS } from "@/lib/chart-setup";
import { cn } from "@/lib/utils";

export function TrendKpiCard({
  label,
  value,
  format,
  hint,
  sparkline,
  sparklineType = "line",
  bare = false,
}: {
  label: string;
  value: number;
  format: (n: number) => string;
  hint?: string;
  sparkline: number[];
  sparklineType?: "line" | "bar";
  /** See KpiCard — renders as a plain cell for use inside <CardGrid>. */
  bare?: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cardRef.current) staggerReveal([cardRef.current]);
  }, []);

  useEffect(() => {
    const el = valueRef.current;
    if (!el) return;
    const tween = countUp(el, value, format);
    return () => {
      tween.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div
      ref={cardRef}
      className={cn(
        "flex h-full flex-col p-5",
        bare ? "bg-surface" : "rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-card)]"
      )}
    >
      <div className="text-[12px] font-semibold uppercase tracking-wide text-text-muted">{label}</div>
      <div ref={valueRef} className="mt-1.5 font-heading text-[28px] font-bold leading-none text-primary">
        0
      </div>
      {hint ? <div className="mt-1 text-[12px] text-text-muted">{hint}</div> : null}
      <div className="mt-auto pt-3">
        {sparkline.length > 1 ? (
          <MiniSparkline values={sparkline} type={sparklineType} color={CHART_COLORS.primary} />
        ) : (
          <div className="h-10" />
        )}
      </div>
    </div>
  );
}
