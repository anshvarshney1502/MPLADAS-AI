"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Maximize } from "lucide-react";
import type { NetworkNode, NetworkEdge } from "@/lib/types";

interface Pos {
  x: number;
  y: number;
  r: number;
  weight: number;
}

interface Transform {
  x: number;
  y: number;
  scale: number;
}

const VENDOR_COLOR = "#2563EB";
const STATE_COLOR = "#0B1F3A";
const MIN_SCALE = 0.25;
const MAX_SCALE = 3;

function isVendor(id: string) {
  return id.startsWith("vendor::");
}

/**
 * A small, deterministic force-directed layout — real edges pull connected
 * nodes together, all nodes repel each other, everything is pulled gently
 * toward the center. Runs once per dataset (synchronously, ~85 nodes is
 * trivial) so the graph starts in an organic, clustered arrangement instead
 * of a rigid grid; users can drag nodes anywhere afterward.
 */
function computeLayout(nodes: NetworkNode[], edges: NetworkEdge[]): Map<string, Pos> {
  const weight = new Map<string, number>();
  for (const e of edges) {
    weight.set(e.source, (weight.get(e.source) ?? 0) + e.weight);
    weight.set(e.target, (weight.get(e.target) ?? 0) + e.weight);
  }

  const W = 1000;
  const H = 700;
  const pos = new Map<string, { x: number; y: number; vx: number; vy: number }>();
  nodes.forEach((n, i) => {
    const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2;
    const radius = isVendor(n.id) ? 260 : 140;
    pos.set(n.id, {
      x: W / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 40,
      y: H / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 40,
      vx: 0,
      vy: 0,
    });
  });

  const iterations = 220;
  for (let it = 0; it < iterations; it++) {
    const damping = 0.85;
    const repulsion = 1800;
    // Repulsion between every pair — fine at this node count (≈100).
    for (let i = 0; i < nodes.length; i++) {
      const a = pos.get(nodes[i].id)!;
      for (let j = i + 1; j < nodes.length; j++) {
        const b = pos.get(nodes[j].id)!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let dist2 = dx * dx + dy * dy;
        if (dist2 < 1) dist2 = 1;
        const force = repulsion / dist2;
        const dist = Math.sqrt(dist2);
        dx /= dist;
        dy /= dist;
        a.vx += dx * force;
        a.vy += dy * force;
        b.vx -= dx * force;
        b.vy -= dy * force;
      }
    }
    // Spring attraction along real edges only.
    for (const e of edges) {
      const a = pos.get(e.source);
      const b = pos.get(e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const target = 150;
      const k = 0.02;
      const f = (dist - target) * k;
      const fx = (dx / dist) * f;
      const fy = (dy / dist) * f;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }
    // Gentle centering pull.
    for (const n of nodes) {
      const p = pos.get(n.id)!;
      p.vx += (W / 2 - p.x) * 0.002;
      p.vy += (H / 2 - p.y) * 0.002;
      p.vx *= damping;
      p.vy *= damping;
      p.x += p.vx;
      p.y += p.vy;
    }
  }

  const out = new Map<string, Pos>();
  const maxWeight = Math.max(1, ...weight.values());
  for (const n of nodes) {
    const p = pos.get(n.id)!;
    const w = weight.get(n.id) ?? 0;
    const r = isVendor(n.id) ? 7 + Math.sqrt(w / maxWeight) * 16 : 10 + Math.sqrt(w / maxWeight) * 20;
    out.set(n.id, { x: p.x, y: p.y, r, weight: w });
  }
  return out;
}

function shade(hex: string, amt: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const clamp = (v: number) => Math.min(255, Math.max(0, v));
  const r = clamp((num >> 16) + amt);
  const g = clamp(((num >> 8) & 0xff) + amt);
  const b = clamp((num & 0xff) + amt);
  return `rgb(${r}, ${g}, ${b})`;
}

export function NetworkCanvas({
  nodes,
  edges,
  selectedId,
  onSelect,
}: {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of edges) {
      if (!m.has(e.source)) m.set(e.source, new Set());
      if (!m.has(e.target)) m.set(e.target, new Set());
      m.get(e.source)!.add(e.target);
      m.get(e.target)!.add(e.source);
    }
    return m;
  }, [edges]);

  const layout = useMemo(() => computeLayout(nodes, edges), [nodes, edges]);

  const stateRef = useRef({
    positions: layout,
    transform: { x: 0, y: 0, scale: 1 } as Transform,
    dragId: null as string | null,
    dragMoved: false,
    dragStart: { x: 0, y: 0 },
    panning: false,
    panStart: { x: 0, y: 0 },
    transformStart: { x: 0, y: 0 },
    hoverId: null as string | null,
    fitted: false,
  });
  stateRef.current.positions = layout;

  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: NetworkNode; count: number; weight: number } | null>(null);

  function fitToView() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const positions = [...stateRef.current.positions.values()];
    if (positions.length === 0) return;
    const minX = Math.min(...positions.map((p) => p.x - p.r));
    const maxX = Math.max(...positions.map((p) => p.x + p.r));
    const minY = Math.min(...positions.map((p) => p.y - p.r));
    const maxY = Math.max(...positions.map((p) => p.y + p.r));
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min((rect.width - 60) / w, (rect.height - 60) / h)));
    stateRef.current.transform = {
      scale,
      x: rect.width / 2 - ((minX + maxX) / 2) * scale,
      y: rect.height / 2 - ((minY + maxY) / 2) * scale,
    };
  }

  function toWorld(clientX: number, clientY: number) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { x, y, scale } = stateRef.current.transform;
    return { x: (clientX - rect.left - x) / scale, y: (clientY - rect.top - y) / scale };
  }

  function hitTest(worldX: number, worldY: number): string | null {
    const { positions } = stateRef.current;
    let best: string | null = null;
    let bestDist = Infinity;
    for (const [id, p] of positions) {
      const dx = worldX - p.x;
      const dy = worldY - p.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const hitR = Math.max(p.r, 10);
      if (d <= hitR && d < bestDist) {
        best = id;
        bestDist = d;
      }
    }
    return best;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

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
      t += 0.02;
      const dpr = window.devicePixelRatio || 1;
      const rect = container!.getBoundingClientRect();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);

      const { x: tx, y: ty, scale } = stateRef.current.transform;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.scale(scale, scale);

      const sel = selectedRef.current;
      const hover = stateRef.current.hoverId;
      const focus = hover ?? sel;
      const focusNeighbors = focus ? neighbors.get(focus) : null;

      // Edges
      for (const e of edges) {
        const a = stateRef.current.positions.get(e.source);
        const b = stateRef.current.positions.get(e.target);
        if (!a || !b) continue;
        const isRelated = focus ? e.source === focus || e.target === focus : false;
        const dim = focus ? !isRelated : false;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        const c1 = isVendor(e.source) ? VENDOR_COLOR : STATE_COLOR;
        const c2 = isVendor(e.target) ? VENDOR_COLOR : STATE_COLOR;
        grad.addColorStop(0, c1);
        grad.addColorStop(1, c2);
        ctx.strokeStyle = grad;
        ctx.globalAlpha = dim ? 0.06 : isRelated ? 0.85 : 0.22;
        ctx.lineWidth = (isRelated ? 1.6 : 0.9) / Math.sqrt(scale);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Nodes
      for (const n of nodes) {
        const p = stateRef.current.positions.get(n.id);
        if (!p) continue;
        const vendor = isVendor(n.id);
        const base = vendor ? VENDOR_COLOR : STATE_COLOR;
        const isFocus = focus === n.id;
        const isRelated = focus ? focusNeighbors?.has(n.id) : false;
        const dim = focus ? !isFocus && !isRelated : false;

        ctx.save();
        ctx.globalAlpha = dim ? 0.32 : 1;

        // Selection glow — a soft pulsing halo behind the active node.
        if (isFocus) {
          const pulse = 1 + Math.sin(t * 2.4) * 0.08;
          const glowR = p.r * 2.1 * pulse;
          const glow = ctx.createRadialGradient(p.x, p.y, p.r * 0.4, p.x, p.y, glowR);
          glow.addColorStop(0, `${base}55`);
          glow.addColorStop(1, `${base}00`);
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
          ctx.fill();
        }

        // Floating depth: soft drop shadow beneath a glossy gradient sphere.
        ctx.shadowColor = "rgba(11, 31, 58, 0.35)";
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 3;
        const grad = ctx.createRadialGradient(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.1, p.x, p.y, p.r);
        grad.addColorStop(0, shade(base, 60));
        grad.addColorStop(1, base);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        ctx.lineWidth = (isFocus ? 2 : 1) / Math.sqrt(scale);
        ctx.strokeStyle = isFocus ? "#FFFFFF" : "rgba(255,255,255,0.55)";
        ctx.stroke();

        // Label — only when zoomed in enough or the node is in focus, to
        // keep a large graph legible instead of a wall of text.
        if (scale > 0.55 || isFocus || isRelated) {
          ctx.fillStyle = "#0F172A";
          ctx.font = `${vendor ? 500 : 600} ${11 / Math.sqrt(scale)}px Inter, sans-serif`;
          ctx.textAlign = "center";
          const label = n.label.length > 22 ? n.label.slice(0, 22) + "…" : n.label;
          ctx.fillText(label, p.x, p.y + p.r + 12 / Math.sqrt(scale));
        }
        ctx.restore();
      }

      ctx.restore();
      } catch (err) {
        console.error("NetworkCanvas draw error:", err);
      }
      rafRef.current = requestAnimationFrame(draw);
    }
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, neighbors]);

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
      const p = stateRef.current.positions.get(stateRef.current.dragId);
      if (p) {
        p.x = world.x;
        p.y = world.y;
      }
      return;
    }
    if (stateRef.current.panning) {
      const dx = e.clientX - stateRef.current.panStart.x;
      const dy = e.clientY - stateRef.current.panStart.y;
      stateRef.current.transform = {
        ...stateRef.current.transform,
        x: stateRef.current.transformStart.x + dx,
        y: stateRef.current.transformStart.y + dy,
      };
      return;
    }
    const world = toWorld(e.clientX, e.clientY);
    const hit = hitTest(world.x, world.y);
    stateRef.current.hoverId = hit;
    if (hit) {
      const node = nodesById.get(hit);
      const p = stateRef.current.positions.get(hit);
      if (node && p) {
        const rect = containerRef.current!.getBoundingClientRect();
        const { x: tx, y: ty, scale } = stateRef.current.transform;
        setTooltip({
          x: p.x * scale + tx,
          y: p.y * scale + ty - (p.r + 8) * scale,
          node,
          count: neighbors.get(hit)?.size ?? 0,
          weight: p.weight,
        });
        void rect;
      }
    } else {
      setTooltip(null);
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (stateRef.current.dragId && !stateRef.current.dragMoved) {
      onSelect(stateRef.current.dragId);
    }
    stateRef.current.dragId = null;
    stateRef.current.panning = false;
    (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
  }

  function zoomAt(clientX: number, clientY: number, factor: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const { x, y, scale } = stateRef.current.transform;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));
    const worldX = (clientX - rect.left - x) / scale;
    const worldY = (clientY - rect.top - y) / scale;
    stateRef.current.transform = {
      scale: newScale,
      x: clientX - rect.left - worldX * newScale,
      y: clientY - rect.top - worldY * newScale,
    };
  }

  const zoomAtRef = useRef(zoomAt);
  zoomAtRef.current = zoomAt;

  // React's synthetic onWheel is registered as a passive listener, so
  // e.preventDefault() inside it silently fails (and logs a warning) —
  // attaching a real, non-passive native listener is the only way to stop
  // the page from scrolling while zooming the canvas.
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

  function handleZoomButton(factor: number) {
    const rect = containerRef.current!.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  }

  function handleReset() {
    stateRef.current.fitted = false;
    fitToView();
    stateRef.current.fitted = true;
  }

  return (
    <div ref={containerRef} className="relative h-[520px] w-full min-w-0 overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface">
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
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 py-1.5 text-[11px] shadow-[var(--shadow-card-hover)]"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="font-semibold text-text-primary">{tooltip.node.label}</div>
          <div className="mt-0.5 text-[10.5px] text-text-muted">
            {isVendor(tooltip.node.id) ? "Vendor" : "State"} · {tooltip.count} connection{tooltip.count === 1 ? "" : "s"} · weight {tooltip.weight}
          </div>
        </div>
      ) : null}

      <div className="absolute right-3 top-3 flex flex-col gap-1.5">
        <button
          onClick={() => handleZoomButton(1.25)}
          className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border border-border bg-surface text-text-secondary shadow-[var(--shadow-card)] transition-colors hover:bg-surface-soft"
          aria-label="Zoom in"
        >
          <Plus size={13} />
        </button>
        <button
          onClick={() => handleZoomButton(0.8)}
          className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border border-border bg-surface text-text-secondary shadow-[var(--shadow-card)] transition-colors hover:bg-surface-soft"
          aria-label="Zoom out"
        >
          <Minus size={13} />
        </button>
        <button
          onClick={handleReset}
          className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border border-border bg-surface text-text-secondary shadow-[var(--shadow-card)] transition-colors hover:bg-surface-soft"
          aria-label="Reset view"
        >
          <Maximize size={12} />
        </button>
      </div>

      <div className="absolute bottom-3 left-3 flex items-center gap-3 rounded-[var(--radius-sm)] border border-border bg-surface/90 px-2.5 py-1.5 text-[10.5px] text-text-muted backdrop-blur-sm">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: VENDOR_COLOR }} /> Vendor
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: STATE_COLOR }} /> State
        </span>
        <span className="hidden sm:inline">Drag to reposition · scroll to zoom · drag background to pan</span>
      </div>
    </div>
  );
}
