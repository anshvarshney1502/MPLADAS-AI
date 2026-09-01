# MPLADS AI — Risk & Monitoring Intelligence

An explainable, risk-based intelligence layer over MPLADS transaction and project
data. It turns accessible MPLADS records into prioritized, evidence-backed
verification actions — a decision-support tool for officials, not an automated
fraud-detection system.

This is an independent analysis prototype. It is not affiliated with, endorsed
by, or a replacement for MPLADS/eSAKSHI or any government system.

## Architecture

```
data/  ──►  cleaning + feature engineering  ──►  risk engine (Isolation Forest
             (main.py)                            + NLP-derived signals)
                                                          │
                                                          ▼
                                                 FastAPI backend (main.py)
                                                          │
                                                          ▼
                                              Next.js frontend (frontend/)
```

- **Backend** (`main.py` + supporting modules): FastAPI service that cleans the
  raw MPLADS CSVs, engineers financial/payment/vendor features, runs an
  explainable NLP pipeline (entity extraction, duplicate detection, category
  classification, vagueness scoring) over work descriptions, and scores every
  record with an Isolation Forest anomaly model. Risk types (Cost Anomaly,
  Payment Anomaly, Fund Utilization, Delay, Compliance, Potential Duplicate,
  Network) are derived from real computed signals, ranked by severity.
- **Frontend** (`frontend/`): Next.js 16 application consuming the backend API —
  national/state/district/MP-scoped dashboards, an interactive India risk map,
  risk drill-down with evidence and recommended actions, an inspection
  workflow, fund & payment intelligence, analytics, a vendor relationship
  view, and CSV report exports.

## Backend setup

```bash
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
```

Place the three source CSVs in `data/`:
- `mplads_expenditures.csv`
- `mplads_completed_works.csv`
- `mplads_summary.csv`

```bash
uvicorn main:app --reload --port 8000
```

Swagger docs: `http://127.0.0.1:8000/docs`
API base for the frontend: `http://127.0.0.1:8000/api`

### Backend API

- `/api/health` — backend/model health
- `/api/data/summary`, `/api/data/upload`, `/api/model/train` — data lifecycle
- `/api/overview` — dashboard KPIs, risk distribution, data coverage
- `/api/geo/risk-by-state` — state-level risk aggregate for the map
- `/api/risk-intelligence`, `/api/risk/{work_key}` — risk table and detail
- `/api/works`, `/api/works/{work_key}` — works register and full record
- `/api/funds` — fund utilization and payment overview
- `/api/inspection/queue`, `/api/inspection/{work_key}/action` — inspection workflow
- `/api/network` — vendor/state relationship data
- `/api/analytics` — state/district/agency/category/year-over-year aggregates
- `/api/search` — global work/vendor/MP/constituency search
- `/api/reports/risk.csv`, `/api/reports/works.csv` — CSV exports
- `/api/nlp/*` — entity extraction, duplicate detection, category classification,
  plain-language explanation, and dataset-level batch endpoints

### NLP → risk model integration

During `prepare()`, the backend loads `outputs/nlp_mp_features.csv` if present;
otherwise it runs `nlp_feature_pipeline.py` once against the completed-works
CSV and caches the result. The resulting numeric features
(`NLP_Avg_Vagueness_Score`, `NLP_Max_Duplicate_Score`, `NLP_Vague_Work_Rate`,
etc.) flow into the same Isolation Forest as the financial/payment/vendor
features — raw work descriptions are never fed to the model directly; the NLP
layer converts them into explainable numeric signals first.

Entity extraction and duplicate-detection are memoized on description text,
since MPLADS work descriptions are heavily templated across records.

## Frontend setup

```bash
cd frontend
npm install
cp .env.example .env.local   # point at your running backend if not localhost:8000
npm run dev
```

Open `http://localhost:3000`.

```bash
npm run build   # production build
npm run lint    # type-check + lint
```

## Data & credibility

- All datasets are real, accessible MPLADS records — never live-synced from a
  government system, and the UI always labels this as a prototype dataset.
- Risk scores are an investigation-prioritization signal, not a fraud verdict;
  every screen frames output as decision support requiring official
  verification.
