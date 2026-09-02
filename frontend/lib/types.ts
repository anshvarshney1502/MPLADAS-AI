// Types mirror the actual FastAPI response shapes in main.py — kept loose
// (Record<string, unknown> for raw row passthrough) because the backend
// forwards full dataframe rows verbatim in several endpoints.

export type RiskLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface PageMeta {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface OverviewResponse {
  basic_kpis: {
    total_works: number;
    recommended: number | null;
    sanctioned: number | null;
    completed: number | null;
  };
  intelligence_kpis: {
    high_risk_works: number;
    delayed_works: number;
    payment_alerts: number;
    compliance_alerts: number;
  };
  risk_distribution: Record<string, number>;
  data_coverage: {
    financial: boolean;
    timeline: boolean;
    payments: boolean;
    progress: boolean;
    vendor: boolean;
  };
}

export interface WorkRow extends Record<string, unknown> {
  work_key: string;
  score?: number;
  risk_score?: number;
  priority?: string;
  status?: string;
  risk_type?: string;
  reasons?: string[];
  "MP Name"?: string;
  Constituency?: string;
  State?: string;
  Vendor?: string;
  "Work Description"?: string;
  Risk_Score?: number;
  Risk_Category?: RiskLevel;
  Risk_Type?: string;
  Risk_Status?: string;
}

export interface RiskIntelligenceResponse {
  data: WorkRow[];
  meta: PageMeta;
}

export interface RiskReason {
  type: string;
  level: "HIGH" | "MEDIUM" | "LOW";
  message: string;
}

export interface RiskEvidence {
  financial: {
    allocated_amount: number | null;
    total_expenditure: number | null;
    transaction_amount: number | null;
    utilization: number | null;
  };
  comparison: {
    mp_average_transaction: number | null;
    amount_vs_mp_average: number | null;
  };
  payment: {
    status: string | null;
    successful: number;
    pending: number;
  };
  vendor: {
    transaction_count: number;
  };
}

export interface RiskDetailResponse {
  work: Record<string, unknown>;
  risk: {
    score: number;
    category: RiskLevel;
    type: string;
    status: string;
    anomaly_score: number;
  };
  reasons: RiskReason[];
  evidence: RiskEvidence;
  recommended_verification: string[];
  disclaimer: string;
}

export interface WorksResponse {
  data: WorkRow[];
  meta: PageMeta;
}

export interface WorkDetailResponse {
  work: Record<string, unknown>;
  tabs: {
    overview: Record<string, unknown>;
    financial: {
      allocated: number | null;
      total_expenditure: number | null;
      unspent: number | null;
      utilization: number | null;
    };
    timeline: {
      expenditure_date: string | null;
      completed_date: string | null;
    };
    progress: {
      completed_work_count: number | null;
      completion_rate: number | null;
    };
    risk_analysis: {
      score: number;
      category: RiskLevel;
      type: string;
      reasons: RiskReason[];
      evidence: RiskEvidence;
    };
    payments: {
      status: string | null;
      successful: number;
      pending: number;
    };
    documents: unknown[];
    activity: InspectionAction[];
  };
}

export interface InspectionAction {
  id: number;
  work_key: string;
  action: string;
  note: string | null;
  created_at: string;
}

export interface FundsResponse {
  funnel: {
    sanctioned: number | null;
    released: number | null;
    paid: number | null;
    expended: number | null;
    balance: number | null;
  };
  utilization_percent: number | null;
  payment_counts: { successful: number; pending: number };
  alerts: {
    low_utilization: number;
    high_unused_balance: number;
    payment_pending: number;
    rapid_expenditure: number;
  };
}

export interface InspectionQueueItem {
  rank: number;
  work_key: string;
  work: string | null;
  score: number;
  reason: string;
  location: string | null;
  state: string | null;
  priority: string;
}

export interface InspectionQueueResponse {
  data: InspectionQueueItem[];
  meta: PageMeta;
}

export interface NetworkNode {
  id: string;
  type: string;
  label: string;
}
export interface NetworkEdge {
  source: string;
  target: string;
  weight: number;
}
export interface NetworkResponse {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  language_rule: string;
}

export interface AnalyticsResponse {
  dimension: string;
  data: Record<string, unknown>[];
}

export interface SearchResultItem {
  work_key: string;
  work: string | null;
  vendor: string | null;
  mp: string | null;
  constituency: string | null;
  state: string | null;
  risk_score: number | null;
}
export interface SearchResponse {
  data: SearchResultItem[];
}

export interface GeoStateRisk {
  state: string;
  total_works: number;
  high_risk_works: number;
  delayed_works: number;
  avg_risk_score: number;
  avg_utilization: number | null;
  risk_level: RiskLevel;
}
export interface GeoRiskResponse {
  data: GeoStateRisk[];
}

export type Role = "ministry" | "state" | "district" | "mp";
