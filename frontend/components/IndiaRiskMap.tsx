"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as d3geo from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
import { gsap } from "gsap";
import type { GeoStateRisk } from "@/lib/types";
import { useRole } from "@/lib/role-context";

const RISK_COLOR: Record<string, string> = {
  HIGH: "#DC2626",
  MEDIUM: "#D97706",
  LOW: "#16A34A",
};

// Backend "State" strings vs. the boundary dataset's NAME_1 field disagree
// on a handful of names/spellings — normalize both sides before matching.
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

const ALIASES: Record<string, string> = {
  odisha: "orissa",
  puducherry: "pondicherry",
  uttarakhand: "uttaranchal",
  delhi: "nctofdelhi",
  andamanandnicobarislands: "andamanandnicobar",
};

function keyFor(name: string): string {
  const n = normalize(name);
  return ALIASES[n] ?? n;
}

interface TooltipState {
  x: number;
  y: number;
  state: string;
  data?: GeoStateRisk;
}

export function IndiaRiskMap({ data }: { data: GeoStateRisk[] }) {
  const router = useRouter();
  const { setScope } = useRole();
  const [topo, setTopo] = useState<Topology | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const gRef = useRef<SVGGElement>(null);

  useEffect(() => {
    fetch("/geo/india-states.topo.json")
      .then((r) => r.json())
      .then(setTopo)
      .catch(() => setTopo(null));
  }, []);

  const byState = useMemo(() => {
    const m = new Map<string, GeoStateRisk>();
    for (const row of data) m.set(keyFor(row.state), row);
    return m;
  }, [data]);

  const { pathFor, features } = useMemo(() => {
    if (!topo) return { pathFor: null as ((f: Feature<Geometry>) => string | null) | null, features: [] as Feature<Geometry>[] };
    const objectKey = Object.keys(topo.objects)[0];
    const geo = feature(topo, topo.objects[objectKey] as GeometryCollection) as unknown as {
      features: Feature<Geometry>[];
    };
    const projection = d3geo.geoMercator().fitSize([360, 420], geo as never);
    const path = d3geo.geoPath(projection);
    return {
      pathFor: (f: Feature<Geometry>) => path(f),
      features: geo.features,
    };
  }, [topo]);

  useEffect(() => {
    if (gRef.current) {
      gsap.fromTo(
        gRef.current.querySelectorAll("path"),
        { opacity: 0 },
        { opacity: 1, duration: 0.5, stagger: 0.006, ease: "power1.out" }
      );
    }
  }, [features]);

  function handleClick(stateName: string) {
    const next = selected === stateName ? null : stateName;
    setSelected(next);
    if (next) {
      setScope({ state: next });
      router.push(`/works?state=${encodeURIComponent(next)}`);
    }
  }

  if (!topo) {
    return <div className="flex h-64 items-center justify-center text-xs text-text-muted">Loading map…</div>;
  }

  return (
    <div className="relative">
      <svg viewBox="0 0 360 420" className="h-72 w-full">
        <g ref={gRef}>
          {features.map((f, i) => {
            const name = String((f.properties as Record<string, unknown> | null)?.NAME_1 ?? `state-${i}`);
            const row = byState.get(keyFor(name));
            const fill = row ? RISK_COLOR[row.risk_level] : "#E2E8F0";
            const d = pathFor?.(f) ?? "";
            return (
              <path
                key={i}
                d={d}
                fill={fill}
                fillOpacity={selected && selected !== name ? 0.35 : 0.85}
                stroke="#FFFFFF"
                strokeWidth={0.6}
                className="cursor-pointer transition-[fill-opacity] duration-150"
                onMouseMove={(e) => {
                  const rect = (e.target as SVGPathElement).ownerSVGElement?.getBoundingClientRect();
                  setTooltip({
                    x: e.clientX - (rect?.left ?? 0),
                    y: e.clientY - (rect?.top ?? 0),
                    state: name,
                    data: row,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
                onClick={() => handleClick(name)}
              />
            );
          })}
        </g>
      </svg>

      {tooltip ? (
        <div
          className="pointer-events-none absolute z-10 rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-xs shadow-[var(--shadow-card-hover)]"
          style={{ left: Math.min(tooltip.x + 10, 260), top: Math.max(tooltip.y - 10, 0) }}
        >
          <div className="font-heading font-semibold text-text-primary">{tooltip.state}</div>
          {tooltip.data ? (
            <div className="mt-1 space-y-0.5 text-[11px] text-text-secondary">
              <div>Works: {tooltip.data.total_works.toLocaleString("en-IN")}</div>
              <div>High-risk: {tooltip.data.high_risk_works.toLocaleString("en-IN")}</div>
              <div>Avg. risk score: {tooltip.data.avg_risk_score}</div>
              {tooltip.data.avg_utilization != null ? <div>Utilization: {tooltip.data.avg_utilization}%</div> : null}
            </div>
          ) : (
            <div className="mt-1 text-[11px] text-text-muted">No matching data</div>
          )}
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-4 text-[11px] text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: RISK_COLOR.LOW }} /> Low
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: RISK_COLOR.MEDIUM }} /> Medium
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: RISK_COLOR.HIGH }} /> High
        </span>
        <span className="ml-auto">Click a state to scope the dashboard</span>
      </div>
    </div>
  );
}
