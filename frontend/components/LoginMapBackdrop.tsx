"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3geo from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
import { Locate } from "lucide-react";

/**
 * Interactive India network canvas for the login screen's brand panel —
 * the real state/UT boundaries (same topojson the risk map uses) drawn as
 * a clean white outline, with one draggable node per boundary feature
 * positioned at its real geographic centroid. Purely a visual identity
 * piece: no risk coloring, no counts, no invented statistics — node
 * connections are a fixed nearest-neighbor graph over the real centroids,
 * not a claim about any relationship in the data.
 */
interface Pos {
  x: number;
  y: number;
}
interface Transform {
  x: number;
  y: number;
  scale: number;
}

const VIEW_W = 360;
const VIEW_H = 430;
const MIN_SCALE = 0.7;
const MAX_SCALE = 3.5;
const NODE_R = 3.2;
const NEIGHBORS_PER_NODE = 2;
const PAN_MARGIN = 90;

/**
 * The plain area-weighted centroid of a MultiPolygon (several states have
 * small offshore/enclave parts) can land in an odd spot between disjoint
 * pieces rather than inside the state's main body. Using the centroid of
 * just the largest ring by real projected area keeps the node anchored to
 * where the state actually visually reads — still a genuine geometric
 * point derived from the real boundary, not an invented position.
 */
function getName(f: Feature<Geometry>, fallback = ""): string {
  return String((f.properties as Record<string, unknown> | null)?.NAME_1 ?? fallback);
}

function naturalCentroid(path: d3geo.GeoPath<unknown, d3geo.GeoPermissibleObjects>, f: Feature<Geometry>): [number, number] {
  const geom = f.geometry;
  if (geom.type !== "MultiPolygon") return path.centroid(f);
  let best: Feature<Geometry> | null = null;
  let bestArea = -1;
  for (const coords of geom.coordinates) {
    const sub = { type: "Feature", properties: null, geometry: { type: "Polygon", coordinates: coords } } as Feature<Geometry>;
    const area = Math.abs(path.area(sub));
    if (area > bestArea) {
      bestArea = area;
      best = sub;
    }
  }
  return best ? path.centroid(best) : path.centroid(f);
}

/**
 * The source boundary file is aggressively simplified for file size, which
 * leaves visibly jagged, "staircased" edges compared to a proper reference
 * map. Chaikin's corner-cutting algorithm smooths the real point sequence
 * into gentler curves — it reshapes how the existing points are connected,
 * it does not move the boundary or invent new geometry. Two iterations is
 * conservative enough to keep the true state shapes recognizable.
 */
function chaikinSmooth(points: Pos[], iterations: number): Pos[] {
  let pts = points;
  for (let iter = 0; iter < iterations; iter++) {
    if (pts.length < 3) break;
    const next: Pos[] = [];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p0 = pts[i];
      const p1 = pts[(i + 1) % n];
      next.push({ x: p0.x * 0.75 + p1.x * 0.25, y: p0.y * 0.75 + p1.y * 0.25 });
      next.push({ x: p0.x * 0.25 + p1.x * 0.75, y: p0.y * 0.25 + p1.y * 0.75 });
    }
    pts = next;
  }
  return pts;
}

function projectRings(geom: Geometry, project: d3geo.GeoProjection): Pos[][] {
  const rings: Pos[][] = [];
  function addRing(coords: [number, number][]) {
    const pts: Pos[] = [];
    for (const c of coords) {
      const p = project(c);
      if (p && Number.isFinite(p[0]) && Number.isFinite(p[1])) pts.push({ x: p[0], y: p[1] });
    }
    if (pts.length > 2) rings.push(chaikinSmooth(pts, 2));
  }
  if (geom.type === "Polygon") {
    for (const ring of geom.coordinates) addRing(ring as [number, number][]);
  } else if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates) for (const ring of poly) addRing(ring as [number, number][]);
  }
  return rings;
}

function strokeRings(ctx: CanvasRenderingContext2D, rings: Pos[][]) {
  for (const ring of rings) {
    if (ring.length === 0) continue;
    ctx.moveTo(ring[0].x, ring[0].y);
    for (let i = 1; i < ring.length; i++) ctx.lineTo(ring[i].x, ring[i].y);
    ctx.closePath();
  }
}

/**
 * Jammu and Kashmir and Ladakh are both drawn with the dashed
 * disputed-border convention (both carry a Line-of-Control / undemarcated
 * boundary in the real world), unlike every other state/UT which gets a
 * plain solid outline.
 */
const DASHED_REGIONS = new Set(["Jammu and Kashmir", "Ladakh"]);

function buildNearestNeighborLinks(names: string[], centroids: Map<string, Pos>): [string, string][] {
  const pairs = new Set<string>();
  const links: [string, string][] = [];
  for (const a of names) {
    const pa = centroids.get(a);
    if (!pa) continue;
    const distances = names
      .filter((b) => b !== a)
      .map((b) => {
        const pb = centroids.get(b)!;
        return { b, d: Math.hypot(pa.x - pb.x, pa.y - pb.y) };
      })
      .sort((x, y) => x.d - y.d)
      .slice(0, NEIGHBORS_PER_NODE);
    for (const { b } of distances) {
      const key = [a, b].sort().join("::");
      if (!pairs.has(key)) {
        pairs.add(key);
        links.push([a, b]);
      }
    }
  }
  return links;
}

export function LoginMapBackdrop() {
  const [topo, setTopo] = useState<Topology | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    fetch("/geo/india-states.topo.json")
      .then((r) => r.json())
      .then(setTopo)
      .catch(() => setTopo(null));
  }, []);

  const { features, projection } = useMemo(() => {
    if (!topo) return { features: [] as Feature<Geometry>[], projection: null as d3geo.GeoProjection | null };
    const objectKey = Object.keys(topo.objects)[0];
    const geo = feature(topo, topo.objects[objectKey] as GeometryCollection) as unknown as {
      features: Feature<Geometry>[];
    };
    const proj = d3geo.geoMercator().fitSize([VIEW_W, VIEW_H], geo as never);
    return { features: geo.features, projection: proj };
  }, [topo]);

  // One node per boundary feature (state/UT), positioned at its real
  // geographic centroid — computed once when the geometry loads.
  const { names, centroids, links } = useMemo(() => {
    if (!projection || features.length === 0) {
      return { names: [] as string[], centroids: new Map<string, Pos>(), links: [] as [string, string][] };
    }
    const path = d3geo.geoPath(projection);
    const nameList: string[] = [];
    const cMap = new Map<string, Pos>();
    features.forEach((f, i) => {
      const name = getName(f, `region-${i}`);
      const [x, y] = naturalCentroid(path, f);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        nameList.push(name);
        cMap.set(name, { x, y });
      }
    });
    return { names: nameList, centroids: cMap, links: buildNearestNeighborLinks(nameList, cMap) };
  }, [features, projection]);

  // Smoothed boundary rings, precomputed once from the real geometry so the
  // per-frame draw loop only ever walks plain point arrays.
  const { outerRings, jkRings } = useMemo(() => {
    if (!projection || features.length === 0) {
      return { outerRings: [] as Pos[][], jkRings: [] as Pos[][] };
    }
    const outer: Pos[][] = [];
    const jk: Pos[][] = [];
    for (const f of features) {
      const rings = projectRings(f.geometry, projection);
      if (DASHED_REGIONS.has(getName(f))) jk.push(...rings);
      else outer.push(...rings);
    }
    return { outerRings: outer, jkRings: jk };
  }, [features, projection]);

  const stateRef = useRef({
    positions: new Map<string, Pos>(),
    transform: { x: 0, y: 0, scale: 1 } as Transform,
    dragId: null as string | null,
    dragMoved: false,
    dragStart: { x: 0, y: 0 },
    panning: false,
    panStart: { x: 0, y: 0 },
    transformStart: { x: 0, y: 0 },
    hoverId: null as string | null,
    selectedId: null as string | null,
    fitted: false,
  });

  useEffect(() => {
    if (centroids.size > 0 && stateRef.current.positions.size === 0) {
      stateRef.current.positions = new Map(centroids);
    }
  }, [centroids]);

  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string } | null>(null);

  function clampTransform(t: Transform, rectW: number, rectH: number): Transform {
    const contentW = VIEW_W * t.scale;
    const contentH = VIEW_H * t.scale;
    const x = Math.min(Math.max(t.x, PAN_MARGIN - contentW), rectW - PAN_MARGIN);
    const y = Math.min(Math.max(t.y, PAN_MARGIN - contentH), rectH - PAN_MARGIN);
    return { ...t, x, y };
  }

  function fitToView() {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const scale = Math.min(rect.width / VIEW_W, rect.height / VIEW_H) * 0.92;
    stateRef.current.transform = {
      scale,
      x: (rect.width - VIEW_W * scale) / 2,
      y: (rect.height - VIEW_H * scale) / 2,
    };
  }

  function toWorld(clientX: number, clientY: number) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { x, y, scale } = stateRef.current.transform;
    return { x: (clientX - rect.left - x) / scale, y: (clientY - rect.top - y) / scale };
  }

  function hitTest(worldX: number, worldY: number): string | null {
    let best: string | null = null;
    let bestDist = Infinity;
    for (const [name, p] of stateRef.current.positions) {
      const d = Math.hypot(worldX - p.x, worldY - p.y);
      const hitR = 9;
      if (d <= hitR && d < bestDist) {
        best = name;
        bestDist = d;
      }
    }
    return best;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !projection || names.length === 0) return;

    function resize() {
      const rect = container!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      canvas!.style.width = `${rect.width}px`;
      canvas!.style.height = `${rect.height}px`;
      if (!stateRef.current.fitted) {
        fitToView();
        stateRef.current.fitted = true;
      }
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const ctx = canvas.getContext("2d")!;
    let t = 0;

    function draw() {
      try {
        t += 0.016;
        const dpr = window.devicePixelRatio || 1;
        const rect = container!.getBoundingClientRect();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, rect.width, rect.height);

        const { x: tx, y: ty, scale } = stateRef.current.transform;
        ctx.save();
        ctx.translate(tx, ty);
        ctx.scale(scale, scale);

        // Boundaries — a clean, uncolored outline only. Jammu and Kashmir
        // and Ladakh both carry a Line-of-Control / undemarcated boundary
        // in the real world, so they're drawn dashed rather than solid
        // like the other states/UTs.
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 1.15 / scale;
        ctx.lineJoin = "round";

        ctx.beginPath();
        strokeRings(ctx, outerRings);
        ctx.setLineDash([]);
        ctx.stroke();

        if (jkRings.length > 0) {
          ctx.beginPath();
          strokeRings(ctx, jkRings);
          ctx.setLineDash([3 / scale, 2.5 / scale]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        const focus = stateRef.current.hoverId ?? stateRef.current.selectedId;

        // Fixed nearest-neighbor network links — deliberately faint so the
        // map itself stays the hero; they only brighten on hover/selection.
        ctx.lineWidth = 0.45 / scale;
        for (const [a, b] of links) {
          const pa = stateRef.current.positions.get(a);
          const pb = stateRef.current.positions.get(b);
          if (!pa || !pb) continue;
          const related = focus ? a === focus || b === focus : false;
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb.x, pb.y);
          ctx.strokeStyle = related ? "rgba(143,177,255,0.55)" : "rgba(96,141,239,0.1)";
          ctx.stroke();
        }

        // Nodes.
        for (const name of names) {
          const p = stateRef.current.positions.get(name);
          if (!p) continue;
          const isFocus = focus === name;
          const isSelected = stateRef.current.selectedId === name;

          if (isFocus || isSelected) {
            const pulse = 1 + Math.sin(t * 2.4) * 0.12;
            const glowR = NODE_R * 3.4 * pulse;
            const glow = ctx.createRadialGradient(p.x, p.y, NODE_R * 0.5, p.x, p.y, glowR);
            glow.addColorStop(0, "rgba(143,177,255,0.55)");
            glow.addColorStop(1, "rgba(143,177,255,0)");
            ctx.beginPath();
            ctx.fillStyle = glow;
            ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
            ctx.fill();
          }

          const grad = ctx.createRadialGradient(p.x - NODE_R * 0.3, p.y - NODE_R * 0.3, NODE_R * 0.1, p.x, p.y, NODE_R);
          grad.addColorStop(0, "#E4ECFF");
          grad.addColorStop(1, isFocus || isSelected ? "#8FB1FF" : "#5B8DEF");
          ctx.beginPath();
          ctx.fillStyle = grad;
          ctx.arc(p.x, p.y, NODE_R, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = (isFocus || isSelected ? 1.6 : 0.8) / scale;
          ctx.strokeStyle = isFocus || isSelected ? "#FFFFFF" : "rgba(255,255,255,0.5)";
          ctx.stroke();
        }

        ctx.restore();
      } catch (err) {
        console.error("LoginMapBackdrop draw error:", err);
      }
      rafRef.current = requestAnimationFrame(draw);
    }
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features, projection, names, links, outerRings, jkRings]);

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const world = toWorld(e.clientX, e.clientY);
    const hit = hitTest(world.x, world.y);
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    if (hit) {
      stateRef.current.dragId = hit;
      stateRef.current.dragMoved = false;
      stateRef.current.dragStart = { x: e.clientX, y: e.clientY };
    } else {
      stateRef.current.panning = true;
      stateRef.current.panStart = { x: e.clientX, y: e.clientY };
      stateRef.current.transformStart = { ...stateRef.current.transform };
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (stateRef.current.dragId) {
      const dx = e.clientX - stateRef.current.dragStart.x;
      const dy = e.clientY - stateRef.current.dragStart.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) stateRef.current.dragMoved = true;
      const world = toWorld(e.clientX, e.clientY);
      stateRef.current.positions.set(stateRef.current.dragId, world);
      return;
    }
    if (stateRef.current.panning) {
      const rect = containerRef.current!.getBoundingClientRect();
      const dx = e.clientX - stateRef.current.panStart.x;
      const dy = e.clientY - stateRef.current.panStart.y;
      const next = {
        ...stateRef.current.transform,
        x: stateRef.current.transformStart.x + dx,
        y: stateRef.current.transformStart.y + dy,
      };
      stateRef.current.transform = clampTransform(next, rect.width, rect.height);
      return;
    }
    const world = toWorld(e.clientX, e.clientY);
    const hit = hitTest(world.x, world.y);
    stateRef.current.hoverId = hit;
    if (hit) {
      const p = stateRef.current.positions.get(hit);
      if (p) {
        const { x: tx, y: ty, scale } = stateRef.current.transform;
        setTooltip({ x: p.x * scale + tx, y: p.y * scale + ty - 14, name: hit });
      }
    } else {
      setTooltip(null);
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (stateRef.current.dragId && !stateRef.current.dragMoved) {
      stateRef.current.selectedId = stateRef.current.selectedId === stateRef.current.dragId ? null : stateRef.current.dragId;
    }
    stateRef.current.dragId = null;
    stateRef.current.panning = false;
    (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
  }

  function zoomAt(clientX: number, clientY: number, factor: number) {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const { x, y, scale } = stateRef.current.transform;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));
    const worldX = (clientX - rect.left - x) / scale;
    const worldY = (clientY - rect.top - y) / scale;
    const next = {
      scale: newScale,
      x: clientX - rect.left - worldX * newScale,
      y: clientY - rect.top - worldY * newScale,
    };
    stateRef.current.transform = clampTransform(next, rect.width, rect.height);
  }

  const zoomAtRef = useRef(zoomAt);
  zoomAtRef.current = zoomAt;

  // React's synthetic onWheel is registered as a passive listener, so
  // e.preventDefault() inside it silently fails — a real, non-passive
  // native listener is required to stop the page scrolling while zooming.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      zoomAtRef.current(e.clientX, e.clientY, factor);
    }
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  function handleRecenter() {
    stateRef.current.fitted = false;
    fitToView();
    stateRef.current.fitted = true;
  }

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className="h-full w-full touch-none cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          stateRef.current.hoverId = null;
          setTooltip(null);
        }}
      />

      {tooltip ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-[var(--radius-sm)] border border-white/10 bg-[#0B1F3A]/90 px-2.5 py-1 text-[11px] font-medium text-white shadow-lg backdrop-blur-sm"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.name}
        </div>
      ) : null}

      <button
        onClick={handleRecenter}
        aria-label="Recenter map"
        className="absolute bottom-4 right-4 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/50 opacity-60 backdrop-blur-sm transition-opacity hover:opacity-100"
      >
        <Locate size={12} />
      </button>
    </div>
  );
}
