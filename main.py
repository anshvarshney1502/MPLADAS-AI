
from __future__ import annotations
import os, math, pickle, sqlite3
from pathlib import Path
from datetime import datetime
from typing import Optional
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest

BASE=Path(__file__).resolve().parent
DATA=BASE/"data"; MODELS=BASE/"models"; OUTPUT=BASE/"outputs"; DB=DATA/"mplads.db"
DATA.mkdir(exist_ok=True); MODELS.mkdir(exist_ok=True); OUTPUT.mkdir(exist_ok=True)

EXP=DATA/"mplads_expenditures.csv"
COMP=DATA/"mplads_completed_works.csv"
SUM=DATA/"mplads_summary.csv"
MODEL_FILE=MODELS/"mplads_model.pkl"

app=FastAPI(title="MPLADS AI",version="1.0.0",
 description="MPLADS Risk & Monitoring Intelligence API")

# Explicit origin allowlist (not "*") so credentialed requests work correctly
# from the deployed frontend. These required origins are always included
# regardless of environment config; ALLOWED_ORIGINS (comma-separated) only
# ever ADDS more origins on top — it can never accidentally disable these by
# being unset/empty/misconfigured in a deployment dashboard.
_REQUIRED_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000","https://mplads-topaz.vercel.app"]
_EXTRA_ORIGINS=[o.strip() for o in os.environ.get("ALLOWED_ORIGINS","").split(",") if o.strip()]
ALLOWED_ORIGINS=list(dict.fromkeys(_REQUIRED_ORIGINS+_EXTRA_ORIGINS))
app.add_middleware(CORSMiddleware,allow_origins=ALLOWED_ORIGINS,allow_credentials=True,
                   allow_methods=["*"],allow_headers=["*"])

class Action(BaseModel):
    action:str
    note:Optional[str]=None

def db():
    c=sqlite3.connect(DB); c.row_factory=sqlite3.Row
    c.execute("""CREATE TABLE IF NOT EXISTS inspection_actions(
        id INTEGER PRIMARY KEY AUTOINCREMENT, work_key TEXT, action TEXT,
        note TEXT, created_at TEXT)""")
    c.commit(); return c

def safe(v):
    if v is None: return None
    if isinstance(v,(np.integer,)): return int(v)
    if isinstance(v,(np.floating,)): return None if np.isnan(v) else float(v)
    if isinstance(v,(np.bool_,)): return bool(v)
    if pd.isna(v): return None
    return v

def rec(row):
    return {str(k):safe(v) for k,v in row.items()}

def read_csv(path):
    if not path.exists(): raise FileNotFoundError(str(path))
    for enc in ("utf-8-sig","utf-8","cp1252","latin1"):
        try:
            df=pd.read_csv(path,encoding=enc)
            break
        except UnicodeDecodeError: continue
    df=df.dropna(how="all").drop_duplicates()
    df.columns=[str(c).replace("â‚¹","₹").replace("\n"," ").strip() for c in df.columns]
    for c in df.select_dtypes(include="object").columns:
        df[c]=df[c].astype("string").str.strip()
        df[c]=df[c].mask(df[c].str.lower().isin(["","nan","none","null","na","-"]))
    return df

def money(df):
    for c in ["Expenditure Amount (₹)","Final Amount (₹)","Allocated Amount (₹)",
              "Total Expenditure (₹)","Unspent Amount (₹)"]:
        if c in df:
            df[c]=pd.to_numeric(df[c].astype("string").str.replace("₹","",regex=False)
                .str.replace("â‚¹","",regex=False).str.replace(",","",regex=False),errors="coerce")
    return df

def dates(df):
    for col,p in [("Expenditure Date","Expenditure"),("Completed Date","Completed")]:
        if col in df:
            d=pd.to_datetime(df[col],errors="coerce")
            df[f"{p}_Year"]=d.dt.year; df[f"{p}_Month"]=d.dt.month
            df[f"{p}_Quarter"]=d.dt.quarter; df[f"{p}_DayOfWeek"]=d.dt.dayofweek
    return df

def prepare(exp,comp,summ):
    exp,comp,summ=money(exp.copy()),money(comp.copy()),money(summ.copy())
    exp,comp,summ=dates(exp),dates(comp),dates(summ)
    if "Payment Status" in exp:
        s=exp["Payment Status"].astype("string").str.lower().fillna("")
        exp["Is_Payment_Successful"]=s.str.contains("success|paid|completed").astype(int)
        # BUG FIX: real data uses "Payment In-Progress", which "processing"
        # never matched — Is_Payment_Pending was silently always 0, zeroing
        # out every payment-pending-driven signal (Payment Anomaly risk type,
        # funds() pending counts) on the actual dataset.
        exp["Is_Payment_Pending"]=s.str.contains("pending|processing|in-progress|in progress").astype(int)
    else:
        exp["Is_Payment_Successful"]=0; exp["Is_Payment_Pending"]=0
    keys=[c for c in ["MP Name","Constituency","State","House"] if c in exp and c in summ]
    if keys:
        ss=summ.copy()
        if "Allocated Amount (₹)" in ss and "Total Expenditure (₹)" in ss:
            ss["Calculated_Utilization"]=ss["Total Expenditure (₹)"]/ss["Allocated Amount (₹)"].replace(0,np.nan)*100
        dup=[c for c in ss if c in exp and c not in keys]
        exp=exp.merge(ss.drop(columns=dup,errors="ignore"),on=keys,how="left")
    k=[c for c in ["MP Name","Constituency","State"] if c in exp]
    if k and "Expenditure Amount (₹)" in exp:
        g=exp.groupby(k,dropna=False)["Expenditure Amount (₹)"]
        exp["MP_Transaction_Count"]=g.transform("count")
        exp["MP_Total_Expenditure"]=g.transform("sum")
        exp["MP_Average_Expenditure"]=g.transform("mean")
        exp["MP_Max_Expenditure"]=g.transform("max")
    if "Vendor" in exp:
        exp["Vendor_Transaction_Count"]=exp.groupby("Vendor",dropna=False)["Vendor"].transform("count")
        if "Expenditure Amount (₹)" in exp:
            exp["Vendor_Total_Expenditure"]=exp.groupby("Vendor",dropna=False)["Expenditure Amount (₹)"].transform("sum")
    if "IDA" in exp:
        exp["IDA_Transaction_Count"]=exp.groupby("IDA",dropna=False)["IDA"].transform("count")
    if k and "Vendor" in exp:
        exp["Unique_Vendors_Per_MP"]=exp.groupby(k,dropna=False)["Vendor"].transform("nunique")
    if "Expenditure Amount (₹)" in exp:
        exp["Log_Expenditure"]=np.log1p(exp["Expenditure Amount (₹)"].clip(lower=0))
        if "MP_Average_Expenditure" in exp:
            exp["Amount_vs_MP_Average"]=exp["Expenditure Amount (₹)"]/exp["MP_Average_Expenditure"].replace(0,np.nan)
    ck=[c for c in ["MP Name","Constituency","State"] if c in comp and c in exp]
    if ck:
        cs=comp.groupby(ck,dropna=False).size().reset_index(name="Completed_Work_Count")
        exp=exp.merge(cs,on=ck,how="left")
    if "Completed_Work_Count" not in exp: exp["Completed_Work_Count"]=0
    if "MP_Transaction_Count" in exp:
        exp["Completion_to_Transaction_Ratio"]=exp["Completed_Work_Count"]/exp["MP_Transaction_Count"].replace(0,np.nan)

    # NLP enrichment: use the supplied, explainable feature pipeline.
    # Prefer cached NLP MP features when available; otherwise build them once
    # from the completed-works dataset. This keeps NLP numeric features in the
    # same model table without changing the existing backend architecture.
    nlp_cols = [
        "NLP_Avg_Vagueness_Score", "NLP_Vague_Work_Count",
        "NLP_Total_Works_Scored", "NLP_Avg_Duplicate_Score",
        "NLP_Max_Duplicate_Score", "NLP_Total_Duplicate_Flags",
        "NLP_Unverifiable_Recipient_Flags", "NLP_Vague_Work_Rate",
    ]
    try:
        nlp_path = OUTPUT / "nlp_mp_features.csv"
        if nlp_path.exists():
            nlp_mp = pd.read_csv(nlp_path)
        elif all(c in comp.columns for c in ["Work ID", "Work Description", "MP Name"]):
            from nlp_feature_pipeline import run_pipeline
            _, nlp_mp = run_pipeline(str(DATA / COMP.name), output_dir=str(OUTPUT))
        else:
            nlp_mp = pd.DataFrame()

        if not nlp_mp.empty:
            nlp_keys = [c for c in ["MP Name", "Constituency", "State", "House"]
                        if c in exp.columns and c in nlp_mp.columns]
            if nlp_keys:
                nlp_keep = nlp_keys + [c for c in nlp_cols if c in nlp_mp.columns]
                exp = exp.merge(nlp_mp[nlp_keep].drop_duplicates(nlp_keys),
                                on=nlp_keys, how="left")
    except Exception:
        # Core financial/risk pipeline must remain usable even if optional NLP
        # enrichment cannot run because a source file has an incompatible schema.
        pass

    for c in nlp_cols:
        if c not in exp.columns:
            exp[c] = np.nan

    return exp.replace([np.inf,-np.inf],np.nan)

DROP={"MP Name","Constituency","State","House","Vendor","IDA","Payment Status",
      "Work Description","Expenditure Date","Completed Date"}

class Model:
    def __init__(self):
        self.num=[]; self.cat=[]; self.maps={}; self.imp=SimpleImputer(strategy="median")
        self.scaler=StandardScaler()
        self.iso=IsolationForest(n_estimators=300,contamination="auto",random_state=42,n_jobs=-1)
        self.ready=False
    def matrix(self,df,fit=False):
        x=df.drop(columns=[c for c in DROP if c in df],errors="ignore").copy()
        for c in x:
            if x[c].dtype==bool: x[c]=x[c].astype(int)
        if fit:
            self.num=x.select_dtypes(include=np.number).columns.tolist()
            self.cat=x.select_dtypes(exclude=np.number).columns.tolist()
        for c in self.num:
            if c not in x: x[c]=np.nan
        n=x[self.num].apply(pd.to_numeric,errors="coerce") if self.num else pd.DataFrame(index=x.index)
        if self.num:
            n=self.imp.fit_transform(n) if fit else self.imp.transform(n)
            n=self.scaler.fit_transform(n) if fit else self.scaler.transform(n)
        else: n=np.empty((len(x),0))
        parts=[]
        for c in self.cat:
            s=x[c].astype("string").fillna("__MISSING__") if c in x else pd.Series("__MISSING__",index=x.index)
            if fit: self.maps[c]={str(k):float(v) for k,v in s.value_counts(normalize=True).items()}
            m=self.maps.get(c,{})
            parts.append(s.map(lambda v:m.get(str(v),0.0)).to_numpy(float).reshape(-1,1))
        ca=np.hstack(parts) if parts else np.empty((len(x),0))
        return np.hstack([n,ca]).astype(float)
    def fit(self,df):
        if len(df)<5: raise ValueError("At least 5 expenditure records are required.")
        X=self.matrix(df,True)
        if X.shape[1]==0: raise ValueError("No usable model features found.")
        self.iso.fit(X); self.ready=True; return self
    def predict(self,df):
        X=self.matrix(df)
        score=self.iso.decision_function(X); label=self.iso.predict(X)
        out=df.copy(); out["Anomaly_Label"]=label; out["Anomaly_Score"]=score
        out["Is_Anomaly"]=(label==-1).astype(int)
        lo,hi=float(score.min()),float(score.max())
        out["Risk_Score"]=0.0 if hi==lo else np.clip(100*(hi-score)/(hi-lo),0,100)
        out["Risk_Score"]=out["Risk_Score"].round(2)
        out["Risk_Category"]=out["Risk_Score"].map(lambda x:"CRITICAL" if x>=80 else "HIGH" if x>=60 else "MEDIUM" if x>=40 else "LOW")
        out["Risk_Type"]=out.apply(risk_type,axis=1)
        out["Risk_Status"]=out["Risk_Score"].map(lambda x:"Verification Required" if x>=80 else "Under Review" if x>=60 else "New")
        return out.sort_values("Risk_Score",ascending=False).reset_index(drop=True)

def _risk_signals(r):
    """
    Every triggered signal for a row, each as (risk_type, reason_type, level,
    strength, message). `strength` is a comparable-across-signals severity
    score (not a probability) used only to rank which signal is the row's
    *primary* Risk_Type when several fire at once.

    BUG FIX: the previous risk_type() was a fixed if/elif chain that always
    returned "Cost Anomaly" first when it matched, so a row that was BOTH a
    cost anomaly AND a pending payment could never be classified/counted as
    "Payment Anomaly" — this silently zeroed out the payment_alerts KPI.
    "Compliance" and "Delay" were listed in the product's own risk-type
    taxonomy but no rule ever produced them, so those KPIs and filters were
    dead on arrival. Fixed by scoring every applicable signal and picking the
    strongest, using only features already computed in prepare()/the NLP
    pipeline — no new/fabricated data.
    """
    out = []
    ratio = r.get("Amount_vs_MP_Average")
    if pd.notna(ratio) and float(ratio) >= 2:
        ratio = float(ratio)
        out.append(("Cost Anomaly", "COST ANOMALY", "HIGH" if ratio >= 3 else "MEDIUM", ratio,
            f"Expenditure is {ratio:.1f}x the MP transaction average."))
    if r.get("Is_Payment_Pending", 0) == 1:
        out.append(("Payment Anomaly", "PAYMENT PATTERN", "HIGH", 2.0,
            "Payment status is pending or processing."))
    u = r.get("Calculated_Utilization")
    if pd.notna(u) and float(u) > 100:
        u = float(u)
        out.append(("Fund Utilization", "FUND UTILIZATION", "HIGH", u / 100,
            f"Calculated utilization is {u:.1f}%, exceeding the sanctioned allocation."))
    vtc = r.get("Vendor_Transaction_Count", 0) or 0
    if vtc >= 20:
        out.append(("Network", "NETWORK", "MEDIUM", vtc / 20,
            "Vendor appears unusually frequently in the transaction data."))
    vague_rate = r.get("NLP_Vague_Work_Rate")
    if pd.notna(vague_rate) and float(vague_rate) >= 0.5:
        vague_rate = float(vague_rate)
        out.append(("Compliance", "COMPLIANCE", "HIGH" if vague_rate >= 0.7 else "MEDIUM", vague_rate * 2,
            f"{vague_rate:.0%} of this MP's scored work descriptions are vague/non-specific (CAG audit signal)."))
    dup = r.get("NLP_Max_Duplicate_Score")
    if pd.notna(dup) and float(dup) >= 0.62:
        dup = float(dup)
        out.append(("Potential Duplicate", "POTENTIAL DUPLICATE", "HIGH" if dup >= 0.80 else "MEDIUM", dup * 2,
            f"This MP's works include a potential near-duplicate pair (composite similarity {dup:.0%})."))
    comp_ratio = r.get("Completion_to_Transaction_Ratio")
    txn_count = r.get("MP_Transaction_Count", 0) or 0
    if pd.notna(comp_ratio) and txn_count >= 10 and float(comp_ratio) < 0.3:
        comp_ratio = float(comp_ratio)
        out.append(("Delay", "DELAY SIGNAL", "MEDIUM", 1.0 - comp_ratio,
            f"Completed-work count is only {comp_ratio:.0%} of this MP's transaction volume — completion pace lags spending."))
    return out

def risk_type(r):
    signals = _risk_signals(r)
    if not signals:
        return "Cost Anomaly"
    return max(signals, key=lambda s: s[3])[0]

def reasons(r):
    signals = sorted(_risk_signals(r), key=lambda s: s[3], reverse=True)
    out = [{"type": s[1], "level": s[2], "message": s[4]} for s in signals]
    if not out:
        out.append({"type": "MODEL SIGNAL", "level": "MEDIUM", "message": "Record is unusual relative to the learned distribution."})
    return out[:5]

def evidence(r):
    return {"financial":{"allocated_amount":safe(r.get("Allocated Amount (₹)")),
        "total_expenditure":safe(r.get("Total Expenditure (₹)")),
        "transaction_amount":safe(r.get("Expenditure Amount (₹)")),
        "utilization":safe(r.get("Calculated_Utilization"))},
        "comparison":{"mp_average_transaction":safe(r.get("MP_Average_Expenditure")),
        "amount_vs_mp_average":safe(r.get("Amount_vs_MP_Average"))},
        "payment":{"status":safe(r.get("Payment Status")),"successful":int(r.get("Is_Payment_Successful",0)),
        "pending":int(r.get("Is_Payment_Pending",0))},
        "vendor":{"transaction_count":int(r.get("Vendor_Transaction_Count",0) or 0)}}

class State:
    df=pd.DataFrame(); model=None
S=State()

def ensure():
    if S.df.empty:
        for p in (EXP,COMP,SUM):
            if not p.exists(): raise HTTPException(503,f"Missing source CSV: {p.name}. Upload it to /api/data/upload or place it in data/.")
        exp,comp,summ=read_csv(EXP),read_csv(COMP),read_csv(SUM)
        S.df=prepare(exp,comp,summ)
    if S.model is None:
        if MODEL_FILE.exists():
            with open(MODEL_FILE,"rb") as f:S.model=pickle.load(f)
            S.df=S.model.predict(S.df)
        else:
            S.model=Model().fit(S.df); S.df=S.model.predict(S.df)
            with open(MODEL_FILE,"wb") as f:pickle.dump(S.model,f)
    return S.df

def work_row(key):
    df=ensure()
    for c in ["Work ID","WorkID","ID","Work Description"]:
        if c in df:
            m=df[c].astype(str).str.casefold()==key.casefold()
            if m.any(): return df.loc[m].iloc[0]
    try:
        i=int(key)
        if 0<=i<len(df): return df.iloc[i]
    except: pass
    raise HTTPException(404,"Work not found")

@app.get("/api/health")
def health():
    return {"status":"ok","model_ready":S.model is not None,"records":len(S.df)}

@app.get("/api/data/summary")
def data_summary():
    try: df=ensure()
    except HTTPException: raise
    return {"processed_records":len(df),"anomalies":int(df.Is_Anomaly.sum()),
            "anomaly_rate":round(float(df.Is_Anomaly.mean()*100),2),
            "source_files":[p.name for p in (EXP,COMP,SUM) if p.exists()]}

@app.post("/api/data/upload")
async def upload(dataset_type:str=Query(...,pattern="^(expenditure|completed|summary)$"),file:UploadFile=File(...)):
    if not file.filename.lower().endswith(".csv"): raise HTTPException(400,"Only CSV files accepted.")
    target={"expenditure":EXP,"completed":COMP,"summary":SUM}[dataset_type]
    target.write_bytes(await file.read())
    S.df=pd.DataFrame(); S.model=None
    if MODEL_FILE.exists(): MODEL_FILE.unlink()
    return {"status":"uploaded","dataset_type":dataset_type,"filename":target.name}

@app.post("/api/model/train")
def train():
    try:
        exp,comp,summ=read_csv(EXP),read_csv(COMP),read_csv(SUM)
        S.df=prepare(exp,comp,summ); S.model=Model().fit(S.df); S.df=S.model.predict(S.df)
        with open(MODEL_FILE,"wb") as f:pickle.dump(S.model,f)
        S.df.to_csv(OUTPUT/"final_mplads_anomaly_dataset.csv",index=False)
        S.df[S.df.Is_Anomaly==1].to_csv(OUTPUT/"expenditure_anomalies.csv",index=False)
        n=int(S.df.Is_Anomaly.sum())
        return {"status":"trained","records":len(S.df),"anomalies":n,"anomaly_rate":round(n/len(S.df)*100,2)}
    except FileNotFoundError as e: raise HTTPException(400,str(e))
    except Exception as e: raise HTTPException(500,str(e))

def _mp_level(df):
    """
    BUG FIX: "Recommended Works", "Allocated Amount (₹)" and "Completed
    Works" are MP-level summary fields merged onto every expenditure
    transaction row for that MP (prepare()'s summary merge) — summing them
    directly over the transaction-grained dataframe counted each MP's
    allocation once per transaction instead of once per MP, inflating
    national "Sanctioned" to ~12 lakh crore. Dedupe to one row per MP before
    summing MP-level fields. `total_works`/risk KPIs intentionally keep the
    transaction grain — that's the granularity the rest of the product
    (Works, Risk Intelligence) already operates on.
    """
    keys=[c for c in ["MP Name","Constituency","State","House"] if c in df]
    return df.drop_duplicates(subset=keys) if keys else df

@app.get("/api/overview")
def overview():
    df=ensure(); mp_df=_mp_level(df)
    return {"basic_kpis":{"total_works":len(df),
        "recommended":safe(mp_df["Recommended Works"].sum()) if "Recommended Works" in mp_df else None,
        "sanctioned":safe(mp_df["Allocated Amount (₹)"].sum()) if "Allocated Amount (₹)" in mp_df else None,
        "completed":safe(mp_df["Completed Works"].sum()) if "Completed Works" in mp_df else int(mp_df.Completed_Work_Count.sum())},
        "intelligence_kpis":{"high_risk_works":int((df.Risk_Score>=60).sum()),
        "delayed_works":int((df.Risk_Type=="Delay").sum()),
        "payment_alerts":int((df.Risk_Type=="Payment Anomaly").sum()),
        "compliance_alerts":int((df.Risk_Type=="Compliance").sum())},
        "risk_distribution":{str(k):int(v) for k,v in df.Risk_Category.value_counts().items()},
        "data_coverage":{"financial":all(c in df for c in ["Allocated Amount (₹)","Total Expenditure (₹)"]),
        "timeline":"Expenditure Date" in df,"payments":"Payment Status" in df,
        "progress":"Completed_Work_Count" in df,"vendor":"Vendor" in df}}

def paginate(df,page,size):
    total=len(df); start=(page-1)*size
    return df.iloc[start:start+size],{"page":page,"page_size":size,"total":total,"total_pages":math.ceil(total/size) if total else 0}

@app.get("/api/risk-intelligence")
def risk_intelligence(state_name:Optional[str]=Query(None,alias="state"),risk_type:Optional[str]=None,
    risk_level:Optional[str]=None,house:Optional[str]=None,min_score:Optional[float]=Query(None,ge=0,le=100),
    max_score:Optional[float]=Query(None,ge=0,le=100),page:int=Query(1,ge=1),page_size:int=Query(25,ge=1,le=200)):
    df=ensure().copy()
    if state_name and "State" in df:df=df[df.State.astype(str).str.casefold()==state_name.casefold()]
    if house and "House" in df:df=df[df.House.astype(str).str.casefold()==house.casefold()]
    if risk_type:df=df[df.Risk_Type.str.casefold()==risk_type.casefold()]
    if risk_level:df=df[df.Risk_Category.str.casefold()==risk_level.casefold()]
    if min_score is not None:df=df[df.Risk_Score>=min_score]
    if max_score is not None:df=df[df.Risk_Score<=max_score]
    d,m=paginate(df,page,page_size)
    rows=[]
    for i,r in d.iterrows():
        key=str(r.get("Work ID",r.get("WorkID",i)))
        x=rec(r); x.update({"work_key":key,
                            "score":float(r.Risk_Score),"priority":str(r.Risk_Category).title(),
                            "status":latest_action_status(key) or str(r.Risk_Status),"risk_type":str(r.Risk_Type),
                            "reasons":[rr["message"] for rr in reasons(r)[:2]]})
        rows.append(x)
    return {"data":rows,"meta":m}

@app.get("/api/risk/{work_key}")
def risk_detail(work_key:str):
    r=work_row(work_key)
    status=latest_action_status(work_key) or str(r.Risk_Status)
    work=rec(r); work["Risk_Status"]=status
    return {"work":work,"risk":{"score":float(r.Risk_Score),"category":str(r.Risk_Category),
        "type":str(r.Risk_Type),"status":status,"anomaly_score":float(r.Anomaly_Score)},
        "reasons":reasons(r),"evidence":evidence(r),
        "recommended_verification":["Review payment milestones","Verify recorded progress",
        "Review sanctioned estimate","Review vendor history"],
        "disclaimer":"Risk signal only; final verification and decision remain with the authority."}

@app.get("/api/works")
def works(search:Optional[str]=None,state_name:Optional[str]=Query(None,alias="state"),
    constituency:Optional[str]=None,mp:Optional[str]=None,vendor:Optional[str]=None,house:Optional[str]=None,
    risk:Optional[str]=None,status:Optional[str]=None,page:int=Query(1,ge=1),page_size:int=Query(25,ge=1,le=200)):
    df=ensure().copy()
    for c,q in [("Work Description",search),("State",state_name),("Constituency",constituency),("MP Name",mp),("Vendor",vendor)]:
        if q and c in df:df=df[df[c].astype(str).str.casefold().str.contains(q.casefold(),na=False)]
    if house and "House" in df:df=df[df.House.astype(str).str.casefold()==house.casefold()]
    if risk:df=df[df.Risk_Category.str.casefold()==risk.casefold()]
    if status:df=df[df.Risk_Status.str.casefold()==status.casefold()]
    d,m=paginate(df,page,page_size)
    return {"data":[dict(rec(r),work_key=str(r.get("Work ID",r.get("WorkID",i))),risk_score=float(r.Risk_Score)) for i,r in d.iterrows()],"meta":m}

@app.get("/api/works/{work_key}")
def work_detail(work_key:str):
    r=work_row(work_key); c=db()
    actions=[dict(x) for x in c.execute("SELECT * FROM inspection_actions WHERE work_key=? ORDER BY id DESC",(work_key,)).fetchall()]
    c.close()
    status=latest_action_status(work_key) or str(r.Risk_Status)
    work=rec(r); work["Risk_Status"]=status
    return {"work":work,"tabs":{"overview":work,
        "financial":{"allocated":safe(r.get("Allocated Amount (₹)")),"total_expenditure":safe(r.get("Total Expenditure (₹)")),
        "unspent":safe(r.get("Unspent Amount (₹)")),"utilization":safe(r.get("Calculated_Utilization"))},
        "timeline":{"expenditure_date":safe(r.get("Expenditure Date")),"completed_date":safe(r.get("Completed Date"))},
        "progress":{"completed_work_count":safe(r.get("Completed_Work_Count")),"completion_rate":safe(r.get("Completion Rate %"))},
        "risk_analysis":{"score":float(r.Risk_Score),"category":str(r.Risk_Category),"type":str(r.Risk_Type),
        "reasons":reasons(r),"evidence":evidence(r)},
        "payments":{"status":safe(r.get("Payment Status")),"successful":int(r.get("Is_Payment_Successful",0)),
        "pending":int(r.get("Is_Payment_Pending",0))},"documents":[],"activity":actions}}

@app.get("/api/funds")
def funds():
    # BUG FIX: same MP-level double-counting as /api/overview — "Allocated
    # Amount (₹)", "Total Expenditure (₹)" and "Unspent Amount (₹)" are
    # per-MP fields duplicated onto every transaction row, so summing/
    # counting them over `df` inflated national totals by the transaction
    # count. MP-level rollups use `mp_df` (one row per MP); genuinely
    # per-transaction signals (payment status, Risk_Type) keep using `df`.
    df=ensure(); mp_df=_mp_level(df)
    alloc=float(mp_df["Allocated Amount (₹)"].sum()) if "Allocated Amount (₹)" in mp_df else None
    exp=float(mp_df["Total Expenditure (₹)"].sum()) if "Total Expenditure (₹)" in mp_df else None
    uns=float(mp_df["Unspent Amount (₹)"].sum()) if "Unspent Amount (₹)" in mp_df else None
    return {"funnel":{"sanctioned":alloc,"released":None,"paid":None,"expended":exp,"balance":uns},
        "utilization_percent":None if not alloc else exp/alloc*100,
        "payment_counts":{"successful":int(df.Is_Payment_Successful.sum()),"pending":int(df.Is_Payment_Pending.sum())},
        "alerts":{"low_utilization":int((mp_df.Calculated_Utilization<40).sum()) if "Calculated_Utilization" in mp_df else 0,
        "high_unused_balance":int((mp_df["Unspent Amount (₹)"]>0).sum()) if "Unspent Amount (₹)" in mp_df else 0,
        "payment_pending":int(df.Is_Payment_Pending.sum()),"rapid_expenditure":int((df.Risk_Type=="Cost Anomaly").sum())}}

@app.get("/api/inspection/queue")
def queue(min_score:float=Query(60,ge=0,le=100),page:int=Query(1,ge=1),page_size:int=Query(25,ge=1,le=200)):
    df=ensure(); d=df[df.Risk_Score>=min_score].sort_values("Risk_Score",ascending=False)
    d,m=paginate(d,page,page_size); rows=[]
    for rank,(i,r) in enumerate(d.iterrows(),start=(page-1)*page_size+1):
        rows.append({"rank":rank,"work_key":str(r.get("Work ID",r.get("WorkID",i))),
        "work":safe(r.get("Work Description")),"score":float(r.Risk_Score),
        "reason":"; ".join(x["message"] for x in reasons(r)),
        "location":safe(r.get("Constituency")),"state":safe(r.get("State")),
        "priority":str(r.Risk_Category).title()})
    return {"data":rows,"meta":m}

@app.post("/api/inspection/{work_key}/action")
def action(work_key:str,payload:Action):
    work_row(work_key)
    allowed={"initiate_verification","escalate","routine_review","close"}
    if payload.action not in allowed:raise HTTPException(400,f"Allowed actions: {sorted(allowed)}")
    c=db(); cur=c.execute("INSERT INTO inspection_actions(work_key,action,note,created_at) VALUES(?,?,?,?)",
        (work_key,payload.action,payload.note,datetime.utcnow().isoformat())); c.commit(); i=cur.lastrowid;c.close()
    return {"status":"recorded","action_id":i,"work_key":work_key,"action":payload.action}

ACTION_STATUS_MAP={"initiate_verification":"Verification Required","escalate":"Escalated",
    "routine_review":"Under Review","close":"Closed"}

def latest_action_status(work_key):
    """
    BUG FIX: recording an inspection action (Initiate Verification / Escalate
    / Mark for Routine Review) previously only ever wrote to the
    inspection_actions table — every Status badge across the app kept
    showing the original score-derived status (New/Under Review/Verification
    Required) forever, so the "Inspect button must actually work" demo
    moment had no visible effect anywhere except the Activity tab. This
    looks up the most recent recorded action for a work and maps it onto
    the same controlled status vocabulary the rest of the UI already uses.
    """
    c=db()
    row=c.execute("SELECT action FROM inspection_actions WHERE work_key=? ORDER BY id DESC LIMIT 1",(work_key,)).fetchone()
    c.close()
    return ACTION_STATUS_MAP.get(row["action"]) if row else None

@app.get("/api/geo/risk-by-state")
def geo_risk_by_state():
    """
    State-level risk aggregate for the India risk map. Additive endpoint —
    no existing route's behavior changes. Not covered by /api/analytics
    (that endpoint aggregates Expenditure Amount, not risk), so the map
    needs its own small, real aggregation rather than fabricated per-state
    numbers on the frontend.
    """
    df = ensure()
    if "State" not in df:
        return {"data": []}
    out = []
    for state, g in df.groupby("State", dropna=False):
        if pd.isna(state):
            continue
        avg_risk = float(g.Risk_Score.mean())
        util = float(g.Calculated_Utilization.mean()) if "Calculated_Utilization" in g else None
        level = "HIGH" if avg_risk >= 60 else "MEDIUM" if avg_risk >= 40 else "LOW"
        out.append({"state": str(state), "total_works": int(len(g)),
            "high_risk_works": int((g.Risk_Score >= 60).sum()),
            "delayed_works": int((g.Risk_Type == "Delay").sum()),
            "avg_risk_score": round(avg_risk, 2),
            "avg_utilization": None if util is None or math.isnan(util) else round(util, 2),
            "risk_level": level})
    out.sort(key=lambda x: x["avg_risk_score"], reverse=True)
    return {"data": out}

@app.get("/api/network")
def network():
    df=ensure(); nodes={}; edges={}
    def node(i,t,l):nodes[i]={"id":i,"type":t,"label":str(l)}
    if "Vendor" in df:
        for v,n in df.Vendor.value_counts().head(50).items():
            vi=f"vendor::{v}";node(vi,"vendor",v)
            if "State" in df:
                for s in df[df.Vendor==v].State.dropna().astype(str).unique()[:10]:
                    si=f"state::{s}";node(si,"state",s);edges[(vi,si)]={"source":vi,"target":si,"weight":int(n)}
    return {"nodes":list(nodes.values()),"edges":list(edges.values()),
            "language_rule":"High-risk relationship pattern detected; not a claim of vendor fraud."}

@app.get("/api/analytics")
def analytics(dimension:str=Query("state",pattern="^(state|district|agency|category|year_over_year)$")):
    df=ensure()
    if dimension=="year_over_year":
        if "Expenditure_Year" not in df:return {"dimension":dimension,"data":[]}
        g=df.groupby("Expenditure_Year").agg(expenditure=("Expenditure Amount (₹)","sum") if "Expenditure Amount (₹)" in df else ("Risk_Score","mean"),average_risk=("Risk_Score","mean"),works=("Risk_Score","count")).reset_index()
    else:
        col={"state":"State","district":"Constituency","agency":"IDA","category":"Work Description"}[dimension]
        val="Expenditure Amount (₹)" if "Expenditure Amount (₹)" in df else "Risk_Score"
        if col not in df:return {"dimension":dimension,"data":[]}
        g=df.groupby(col,dropna=False)[val].agg(["sum","mean","count"]).reset_index().sort_values("sum",ascending=False).head(50)
    return {"dimension":dimension,"data":[rec(r) for _,r in g.iterrows()]}

@app.get("/api/search")
def search(q:str=Query(...,min_length=1),limit:int=Query(20,ge=1,le=100)):
    df=ensure(); cols=[c for c in ["Work ID","WorkID","ID","Work Description","Vendor","IDA","MP Name","Constituency","State"] if c in df]
    mask=pd.Series(False,index=df.index)
    for c in cols:mask|=df[c].astype(str).str.casefold().str.contains(q.casefold(),na=False)
    return {"data":[{"work_key":str(r.get("Work ID",r.get("WorkID",i))),"work":safe(r.get("Work Description")),
        "vendor":safe(r.get("Vendor")),"mp":safe(r.get("MP Name")),"constituency":safe(r.get("Constituency")),
        "state":safe(r.get("State")),"risk_score":safe(r.get("Risk_Score"))} for i,r in df[mask].head(limit).iterrows()]}

@app.get("/api/reports/risk.csv")
def risk_csv():
    df=ensure(); p=OUTPUT/"mplads_risk_report.csv";df[df.Risk_Score>=60].to_csv(p,index=False)
    return FileResponse(p,media_type="text/csv",filename=p.name)

@app.get("/api/reports/works.csv")
def works_csv():
    df=ensure();p=OUTPUT/"mplads_works_report.csv";df.to_csv(p,index=False)
    return FileResponse(p,media_type="text/csv",filename=p.name)

# ============================================================
# NLP ENGINE ROUTES — integrated from supplied NLP package
# ============================================================
from schemas import (
    DuplicateRequest, DuplicateResponse, DuplicateFlagSchema,
    EntityRequest, EntityResponse, CategoryRequest, CategoryResponse,
    ExplainRequest, ExplainResponse, TrainRequest, TrainResponse,
    DatasetDuplicateRequest, DatasetDuplicateResponse,
    SyntheticDatasetRequest, SyntheticDatasetResponse,
)
from duplicate_detection import find_duplicates, Work, DuplicateFlag
from entity_extraction import extract as extract_entities
from category_classification import classify_work_category
from explain import generate_explanation
from classifier import DuplicatePairClassifier, generate_sample_labeled_dataset
from dataset_processor import process_dataset_duplicates as nlp_process_dataset_duplicates
from dataset_processor import generate_synthetic_mplads_dataset
import io

_NLP_CLASSIFIER = DuplicatePairClassifier()

def _nlp_flags_to_schema(flags):
    return [DuplicateFlagSchema(
        work_id_a=f.work_id_a, work_id_b=f.work_id_b,
        composite_score=f.composite_score,
        tfidf_similarity=f.tfidf_similarity,
        semantic_similarity=f.semantic_similarity,
        fuzzy_similarity=f.fuzzy_similarity,
        location_agency_match=f.location_agency_match,
        entity_overlap=f.entity_overlap,
        entity_overlap_confident=f.entity_overlap_confident,
        amount_similarity=f.amount_similarity,
        reasons=f.reasons, recommendation=f.recommendation,
    ) for f in flags]

@app.get("/api/nlp/health")
def nlp_health():
    return {
        "status": "online",
        "engine": "Hybrid Context-Aware NLP (TF-IDF + Fuzzy + Entity + Location/Agency)",
        "classifier_trained": _NLP_CLASSIFIER.is_trained,
    }

@app.post("/api/nlp/duplicates", response_model=DuplicateResponse)
def nlp_duplicates(req: DuplicateRequest):
    works = [Work(work_id=w.work_id, description=w.description,
                   village_or_ward=w.village_or_ward or "",
                   implementing_agency=w.implementing_agency or "",
                   sanctioned_amount=w.sanctioned_amount or 0.0) for w in req.works]
    flags = find_duplicates(works, custom_threshold=req.threshold)
    return DuplicateResponse(flags_count=len(flags), flags=_nlp_flags_to_schema(flags))

@app.post("/api/nlp/entities", response_model=EntityResponse)
def nlp_entities(req: EntityRequest):
    e = extract_entities(req.work_id, req.description)
    return EntityResponse(work_id=e.work_id, work_types=e.work_types,
        locations=e.locations, beneficiaries_and_objects=e.beneficiaries_and_objects,
        agencies_vendors=e.agencies_vendors, mentioned_amounts=e.mentioned_amounts,
        vague_terms_found=e.vague_terms_found, quality_score=e.quality_score,
        vagueness_score=e.vagueness_score, specificity_level=e.specificity_level,
        quality_risk_signal=e.quality_risk_signal, word_count=e.word_count)

@app.post("/api/nlp/classify", response_model=CategoryResponse)
def nlp_classify(req: CategoryRequest):
    r = classify_work_category(req.work_id, req.description)
    return CategoryResponse(work_id=r.work_id, primary_category=r.primary_category,
        confidence=r.confidence, keyword_category=r.keyword_category,
        semantic_category=r.semantic_category, matched_keywords=r.matched_keywords,
        category_scores=r.category_scores)

@app.post("/api/nlp/explain", response_model=ExplainResponse)
def nlp_explain(req: ExplainRequest):
    r = generate_explanation(work_id=req.work_id, description=req.description,
        duplicate_reasons=req.duplicate_reasons, quality_score=req.quality_score,
        vague_terms=req.vague_terms, primary_category=req.primary_category,
        duplicate_score=req.duplicate_score)
    return ExplainResponse(work_id=r.work_id, headline=r.headline,
        risk_level=r.risk_level, summary=r.summary,
        evidence_checklist=r.evidence_checklist,
        recommended_action=r.recommended_action,
        cag_audit_flag=r.cag_audit_flag)

@app.post("/api/nlp/train", response_model=TrainResponse)
def nlp_train(req: TrainRequest):
    global _NLP_CLASSIFIER
    _NLP_CLASSIFIER = DuplicatePairClassifier(model_type=req.model_type)
    metrics = _NLP_CLASSIFIER.fit(generate_sample_labeled_dataset())
    return TrainResponse(status="successfully_calibrated", model_type=req.model_type,
        accuracy=metrics.accuracy, precision=metrics.precision,
        recall=metrics.recall, f1=metrics.f1, n_samples=metrics.n_samples)

@app.post("/api/nlp/dataset/upload", response_model=DatasetDuplicateResponse)
async def nlp_dataset_upload(file: UploadFile = File(...), threshold: float = 0.62,
                             block_by_constituency: bool = True, max_rows: int = 0):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Only .csv files are supported.")
    try:
        df = pd.read_csv(io.BytesIO(await file.read()))
    except Exception as e:
        raise HTTPException(400, f"Could not read CSV: {e}")
    if df.empty:
        raise HTTPException(400, "Uploaded CSV is empty.")
    if max_rows > 0:
        df = df.head(max_rows)
    flags, summary = nlp_process_dataset_duplicates(df, custom_threshold=threshold,
                                                     block_by_constituency=block_by_constituency)
    return DatasetDuplicateResponse(summary=summary, flags_count=len(flags),
                                    flags=_nlp_flags_to_schema(flags))

@app.post("/api/nlp/dataset/duplicates", response_model=DatasetDuplicateResponse)
def nlp_dataset_duplicates(req: DatasetDuplicateRequest):
    try:
        df = pd.read_csv(io.StringIO(req.csv_content))
    except Exception as e:
        raise HTTPException(400, f"Invalid CSV content: {e}")
    flags, summary = nlp_process_dataset_duplicates(
        df, custom_threshold=req.threshold,
        block_by_constituency=req.block_by_constituency)
    return DatasetDuplicateResponse(summary=summary, flags_count=len(flags),
                                    flags=_nlp_flags_to_schema(flags))

@app.post("/api/nlp/dataset/generate-synthetic", response_model=SyntheticDatasetResponse)
def nlp_synthetic(req: SyntheticDatasetRequest):
    df = generate_synthetic_mplads_dataset(num_records=req.num_records)
    return SyntheticDatasetResponse(num_records=len(df), records=df.to_dict(orient="records"))
