"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { RiskBadge } from "./RiskBadge";

export function RiskScore({ score, level, size = "lg" }: { score: number; level: string; size?: "lg" | "md" }) {
  const numRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const el = numRef.current;
    const ring = ringRef.current;
    const counter = { n: 0 };
    const circumference = 2 * Math.PI * 42;
    const tween = gsap.to(counter, {
      n: score,
      duration: 0.45,
      ease: "power2.out",
      onUpdate: () => {
        if (el) el.textContent = Math.round(counter.n).toString();
        if (ring) {
          const offset = circumference - (counter.n / 100) * circumference;
          ring.style.strokeDashoffset = String(offset);
        }
      },
    });
    return () => {
      tween.kill();
    };
  }, [score]);

  const color =
    level === "CRITICAL" || level === "HIGH"
      ? "var(--risk-high)"
      : level === "MEDIUM"
        ? "var(--risk-medium)"
        : "var(--risk-low)";

  const dim = size === "lg" ? 108 : 76;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} viewBox="0 0 100 100" className="-rotate-90">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-subtle)" strokeWidth="8" />
          <circle
            ref={ringRef}
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="butt"
            strokeDasharray={2 * Math.PI * 42}
            strokeDashoffset={2 * Math.PI * 42}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span ref={numRef} className="font-heading text-2xl font-bold text-primary">
            0
          </span>
          <span className="text-[10px] text-text-muted">/ 100</span>
        </div>
      </div>
      <RiskBadge level={level} />
    </div>
  );
}
