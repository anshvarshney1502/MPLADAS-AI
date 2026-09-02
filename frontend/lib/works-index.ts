import { api } from "@/lib/api";

export type WorksIndexField = "constituencies" | "mps" | "vendors";

export interface WorksIndex {
  constituencies: string[];
  mps: string[];
  vendors: string[];
}

const CACHE_KEY = "mplads_works_index_v1";
const PAGE_SIZE = 200; // the API's own max (page_size ≤ 200)
const CONCURRENCY = 16;

let inflight: Promise<WorksIndex> | null = null;
const progressListeners = new Set<(loaded: number, total: number) => void>();

/** Subscribe to page-load progress while the full dataset scan is running.
 * Returns an unsubscribe function. */
export function onWorksIndexProgress(cb: (loaded: number, total: number) => void): () => void {
  progressListeners.add(cb);
  return () => {
    progressListeners.delete(cb);
  };
}

function emitProgress(loaded: number, total: number) {
  for (const cb of progressListeners) cb(loaded, total);
}

function readCache(): WorksIndex | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as WorksIndex) : null;
  } catch {
    return null;
  }
}

function writeCache(index: WorksIndex) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(index));
  } catch {
    // Storage full/unavailable — the in-memory singleton still avoids
    // refetching for the rest of this page session.
  }
}

/**
 * Builds the COMPLETE, real distinct list of Constituencies, MPs, and
 * Vendors from the existing dataset. There is no dedicated "distinct
 * values" endpoint and none may be added, so this walks every page of the
 * existing /api/works endpoint (the same one the table itself uses, at its
 * own max page_size of 200) exactly once, extracts the three fields from
 * every real row, and discards the rest — no slicing, no top-N, no
 * fabricated names. The result is cached for the rest of this browser tab
 * session (sessionStorage + an in-memory singleton) so the full scan runs
 * at most once per session, not once per dropdown open or keystroke.
 */
export function getWorksIndex(): Promise<WorksIndex> {
  if (inflight) return inflight;

  const cached = readCache();
  if (cached) {
    inflight = Promise.resolve(cached);
    return inflight;
  }

  inflight = (async () => {
    const constituencies = new Set<string>();
    const mps = new Set<string>();
    const vendors = new Set<string>();

    function collect(rows: Awaited<ReturnType<typeof api.works>>["data"]) {
      for (const row of rows) {
        const c = row.Constituency;
        const m = row["MP Name"];
        const v = row.Vendor;
        if (c) constituencies.add(String(c));
        if (m) mps.add(String(m));
        if (v) vendors.add(String(v));
      }
    }

    const first = await api.works({ page: 1, page_size: PAGE_SIZE });
    collect(first.data);
    const totalPages = first.meta.total_pages;
    let completed = 1;
    emitProgress(completed, totalPages);

    const remaining = Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) => i + 2);
    let cursor = 0;
    async function worker() {
      while (cursor < remaining.length) {
        const page = remaining[cursor++];
        const res = await api.works({ page, page_size: PAGE_SIZE });
        collect(res.data);
        completed++;
        emitProgress(completed, totalPages);
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, remaining.length || 1) }, worker));

    const index: WorksIndex = {
      constituencies: [...constituencies].sort((a, b) => a.localeCompare(b)),
      mps: [...mps].sort((a, b) => a.localeCompare(b)),
      vendors: [...vendors].sort((a, b) => a.localeCompare(b)),
    };
    writeCache(index);
    return index;
  })();

  return inflight;
}
