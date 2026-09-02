"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as d3geo from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
import { gsap } from "gsap";
import { ArrowRight, MapPin } from "lucide-react";
import type { GeoStateRisk } from "@/lib/types";
import { useRole } from "@/lib/role-context";
import { useApi } from "@/lib/use-api";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import { stateKeyFor } from "@/lib/states";

type MapRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const RISK_COLOR: Record<MapRiskLevel, string> = {
  CRITICAL: "#DC2626",
  HIGH: "#F87171",
  MEDIUM: "#D97706",
  LOW: "#16A34A",
};
const RISK_BG: Record<MapRiskLevel, string> = {
  CRITICAL: "#FEF2F2",
  HIGH: "#FEF2F2",
  MEDIUM: "#FFFBEB",
  LOW: "#F0FDF4",
};

/**
 * The backend's own `risk_level` buckets a state by its *average* Risk_Score,
 * which washes out concentration: a state with a small share of extreme
 * high-risk works still averages into "LOW" alongside states with almost
 * none — which is why nearly the whole map rendered green. For the map's
 * color coding we reclassify using the proportion of a state's own works
 * that are high-risk (high_risk_works / total_works) — both real counts
 * already returned by /api/geo/risk-by-state. No new data, no backend
 * change, no invented numbers — just a ratio of two real fields.
 */
function classifyStateRisk(row: GeoStateRisk): MapRiskLevel {
  if (row.total_works <= 0) return "LOW";
  const pct = row.high_risk_works / row.total_works;
  if (pct >= 0.2) return "CRITICAL";
  if (pct >= 0.08) return "HIGH";
  if (pct >= 0.02) return "MEDIUM";
  return "LOW";
}

/**
 * Single canonical identity for a state, resolved through the same alias
 * table used for map matching. The topojson boundary file's NAME_1 field
 * ("Orissa") and the backend's real State column ("Odisha") can disagree —
 * without this, hover/select would store the topojson spelling, which then
 * gets sent straight to /api/works and /api/risk-intelligence and matches
 * nothing there (those endpoints filter on the backend's actual State
 * strings). Resolving to the backend row's own `state` value here means the
 * map, the detail panel, "View Works", and the Works page filter all agree
 * on one identity. Falls back to the raw topojson name only when there's no
 * backend row for it at all (nothing to canonicalize to).
 */
function canonicalStateName(topoName: string, byState: Map<string, GeoStateRisk>): string {
  return byState.get(stateKeyFor(topoName))?.state ?? topoName;
}

interface TooltipState {
  x: number;
  y: number;
  state: string;
}

export function IndiaRiskMap({ data }: { data: GeoStateRisk[] }) {
  const router = useRouter();
  const { setScope } = useRole();
  const [topo, setTopo] = useState<Topology | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const gRef = useRef<SVGGElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/geo/india-states.topo.json")
      .then((r) => r.json())
      .then(setTopo)
      .catch(() => setTopo(null));
  }, []);

  const byState = useMemo(() => {
    const m = new Map<string, GeoStateRisk>();
    for (const row of data) m.set(stateKeyFor(row.state), row);
    return m;
  }, [data]);

  const { pathFor, features } = useMemo(() => {
    if (!topo) return { pathFor: null as ((f: Feature<Geometry>) => string | null) | null, features: [] as Feature<Geometry>[] };
    const objectKey = Object.keys(topo.objects)[0];
    const geo = feature(topo, topo.objects[objectKey] as GeometryCollection) as unknown as {
      features: Feature<Geometry>[];
    };
    const projection = d3geo.geoMercator().fitSize([360, 430], geo as never);
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
        { opacity: 0, scale: 0.985, transformOrigin: "center" },
        { opacity: 1, scale: 1, duration: 0.5, stagger: 0.006, ease: "power1.out" }
      );
    }
  }, [features]);

  const activeName = hovered ?? selected;
  const activeRow = activeName ? byState.get(stateKeyFor(activeName)) : undefined;
  const activeLevel = activeRow ? classifyStateRisk(activeRow) : null;

  // Top risk reasons for the selected state — sourced from the same
  // /api/risk-intelligence endpoint already used elsewhere in the app
  // (e.g. the Priority Alerts rail), just scoped to this state. Fetched
  // only on click (not on hover) to avoid firing a request per mouse move.
  const stateReasons = useApi(
    () => (selected ? api.riskIntelligence({ state: selected, min_score: 60, page: 1, page_size: 10 }) : Promise.resolve(null)),
    [selected]
  );

  const topReasons = useMemo(() => {
    if (!stateReasons.data) return [];
    const counts = new Map<string, number>();
    for (const row of stateReasons.data.data) {
      for (const reason of row.reasons ?? []) {
        counts.set(reason, (counts.get(reason) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [stateReasons.data]);

  useEffect(() => {
    if (panelRef.current) {
      gsap.fromTo(panelRef.current, { opacity: 0.4, y: 4 }, { opacity: 1, y: 0, duration: 0.2, ease: "power1.out" });
    }
  }, [activeName]);

  function goToState(stateName: string) {
    setScope({ state: stateName });
    router.push(`/works?state=${encodeURIComponent(stateName)}`);
  }

  function handleClick(stateName: string) {
    setSelected((cur) => (cur === stateName ? null : stateName));
  }

  if (!topo) {
    return <div className="flex h-72 items-center justify-center text-xs text-text-muted">Loading map…</div>;
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <div className="relative">
        <svg viewBox="0 0 360 430" className="h-80 w-full lg:h-96">
          <g ref={gRef}>
            {features.map((f, i) => {
              const rawName = String((f.properties as Record<string, unknown> | null)?.NAME_1 ?? `state-${i}`);
              const canonicalName = canonicalStateName(rawName, byState);
              const row = byState.get(stateKeyFor(rawName));
              const level = row ? classifyStateRisk(row) : null;
              const fill = level ? RISK_COLOR[level] : "#E2E8F0";
              const d = pathFor?.(f) ?? "";
              const isSelected = selected === canonicalName;
              const isHovered = hovered === canonicalName;
              const dimmed = hovered != null && !isHovered;
              return (
                <path
                  key={i}
                  d={d}
                  fill={fill}
                  fillOpacity={dimmed ? 0.3 : isSelected || isHovered ? 0.95 : 0.85}
                  stroke={isSelected ? "var(--color-primary)" : "#FFFFFF"}
                  strokeWidth={isSelected ? 1.8 : isHovered ? 1.2 : 0.6}
                  className="cursor-pointer transition-[fill-opacity,stroke,stroke-width] duration-150"
                  onMouseEnter={() => setHovered(canonicalName)}
                  onMouseMove={(e) => {
                    const rect = (e.target as SVGPathElement).ownerSVGElement?.getBoundingClientRect();
                    setTooltip({ x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0), state: canonicalName });
                  }}
                  onMouseLeave={() => {
                    setHovered(null);
                    setTooltip(null);
                  }}
                  onClick={() => handleClick(canonicalName)}
                />
              );
            })}
          </g>
        </svg>

        {tooltip
          ? (() => {
              const row = byState.get(stateKeyFor(tooltip.state));
              const level = row ? classifyStateRisk(row) : null;
              return (
                <div
                  className="pointer-events-none absolute z-10 rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 py-1.5 text-[11px] shadow-[var(--shadow-card-hover)]"
                  style={{ left: Math.min(tooltip.x + 10, 250), top: Math.max(tooltip.y - 10, 0) }}
                >
                  <div className="font-semibold text-text-primary">{tooltip.state}</div>
                  {row ? (
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-text-muted">
                      <span className="font-bold" style={{ color: RISK_COLOR[level!] }}>
                        {level}
                      </span>
                      · {formatNumber(row.high_risk_works)} high-risk of {formatNumber(row.total_works)} works
                    </div>
                  ) : (
                    <div className="mt-0.5 text-[10.5px] text-text-muted">No risk data available</div>
                  )}
                </div>
              );
            })()
          : null}

        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: RISK_COLOR.LOW }} /> Low
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: RISK_COLOR.MEDIUM }} /> Medium
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: RISK_COLOR.HIGH }} /> High
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: RISK_COLOR.CRITICAL }} /> Critical
          </span>
          <span className="ml-auto hidden sm:inline">Click a state for details</span>
        </div>
      </div>

      <div ref={panelRef} className="rounded-[var(--radius-md)] border border-border bg-surface-soft p-5">
        {activeName ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[15px] font-semibold text-primary">
                <MapPin size={15} className="text-accent" />
                {activeName}
              </div>
              {activeLevel ? (
                <span
                  className="rounded-[var(--radius-sm)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={{ color: RISK_COLOR[activeLevel], background: RISK_BG[activeLevel] }}
                >
                  {activeLevel}
                </span>
              ) : null}
            </div>
            {activeRow ? (
              <>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <Stat label="Total works" value={formatNumber(activeRow.total_works)} />
                  <Stat label="High-risk works" value={formatNumber(activeRow.high_risk_works)} tone="risk" />
                  <Stat label="Delayed works" value={formatNumber(activeRow.delayed_works)} />
                  <Stat label="Avg. risk score" value={activeRow.avg_risk_score.toFixed(1)} />
                </div>
                {activeRow.avg_utilization != null ? (
                  <div className="mt-4">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-text-muted">
                      <span>Avg. utilization</span>
                      <span className="font-semibold text-text-primary">{activeRow.avg_utilization.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border-subtle">
                      <div
                        className="h-full rounded-full bg-accent transition-[width] duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, activeRow.avg_utilization))}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                {selected === activeName ? (
                  <div className="mt-4 border-t border-border-subtle pt-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Top risk reasons</div>
                    {stateReasons.loading ? (
                      <div className="mt-2 space-y-1.5">
                        <div className="h-3 w-full animate-pulse rounded bg-border-subtle" />
                        <div className="h-3 w-4/5 animate-pulse rounded bg-border-subtle" />
                      </div>
                    ) : topReasons.length > 0 ? (
                      <ul className="mt-2 space-y-1.5">
                        {topReasons.map(([reason, count]) => (
                          <li key={reason} className="flex items-start gap-1.5 text-[11.5px] leading-snug text-text-secondary">
                            <span className="mt-1 h-1 w-1 flex-none rounded-full bg-risk-high" />
                            <span>
                              {reason} <span className="text-text-muted">({count})</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : stateReasons.error || activeRow.high_risk_works > 0 ? (
                      <p className="mt-2 text-[11px] text-text-muted">Risk reasons unavailable for this state.</p>
                    ) : (
                      <p className="mt-2 text-[11px] text-text-muted">No high-risk works recorded for this state.</p>
                    )}
                  </div>
                ) : null}

                <button
                  onClick={() => goToState(activeName)}
                  className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-primary py-2 text-[12px] font-semibold text-white transition-colors hover:bg-primary-secondary"
                >
                  View works in {activeName} <ArrowRight size={13} />
                </button>
              </>
            ) : (
              <p className="mt-3 text-[11.5px] text-text-muted">No risk data available for this state.</p>
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center py-10 text-center">
            <MapPin size={22} className="text-text-muted" />
            <p className="mt-2 text-[12.5px] font-medium text-text-secondary">Hover or click a state</p>
            <p className="mt-1 text-[11px] text-text-muted">See its risk profile and jump to the works register.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "risk" }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-text-muted">{label}</div>
      <div className={`mt-0.5 font-heading text-base font-bold ${tone === "risk" ? "text-risk-high" : "text-primary"}`}>{value}</div>
    </div>
  );
}
