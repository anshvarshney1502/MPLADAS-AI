import type {
  OverviewResponse,
  RiskIntelligenceResponse,
  RiskDetailResponse,
  WorksResponse,
  WorkDetailResponse,
  FundsResponse,
  InspectionQueueResponse,
  NetworkResponse,
  AnalyticsResponse,
  SearchResponse,
  GeoRiskResponse,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://mpladas.onrender.com/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(API_BASE + path);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }
  let res: Response;
  try {
    res = await fetch(url.toString(), { cache: "no-store" });
  } catch {
    throw new ApiError("Could not reach the backend API.", 0);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // ignore
    }
    throw new ApiError(detail, res.status);
  }
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Could not reach the backend API.", 0);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const b = await res.json();
      detail = b.detail ?? detail;
    } catch {
      // ignore
    }
    throw new ApiError(detail, res.status);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => get<{ status: string; model_ready: boolean; records: number }>("/health"),
  overview: () => get<OverviewResponse>("/overview"),
  riskIntelligence: (params: {
    state?: string;
    risk_type?: string;
    risk_level?: string;
    house?: string;
    min_score?: number;
    max_score?: number;
    page?: number;
    page_size?: number;
  }) => get<RiskIntelligenceResponse>("/risk-intelligence", params),
  riskDetail: (workKey: string) => get<RiskDetailResponse>(`/risk/${encodeURIComponent(workKey)}`),
  works: (params: {
    search?: string;
    state?: string;
    constituency?: string;
    mp?: string;
    vendor?: string;
    house?: string;
    risk?: string;
    status?: string;
    page?: number;
    page_size?: number;
  }) => get<WorksResponse>("/works", params),
  workDetail: (workKey: string) => get<WorkDetailResponse>(`/works/${encodeURIComponent(workKey)}`),
  funds: () => get<FundsResponse>("/funds"),
  inspectionQueue: (params: { min_score?: number; page?: number; page_size?: number }) =>
    get<InspectionQueueResponse>("/inspection/queue", params),
  inspectionAction: (workKey: string, action: string, note?: string) =>
    post(`/inspection/${encodeURIComponent(workKey)}/action`, { action, note }),
  network: () => get<NetworkResponse>("/network"),
  geoRiskByState: () => get<GeoRiskResponse>("/geo/risk-by-state"),
  analytics: (dimension: string) => get<AnalyticsResponse>("/analytics", { dimension }),
  search: (q: string, limit = 20) => get<SearchResponse>("/search", { q, limit }),
};
