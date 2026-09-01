"""
NLP Feature Pipeline — Integration Point with preprocessing.py.

WHY THIS EXISTS
---------------
preprocessing.py explicitly drops "Work Description" before the Isolation Forest
("Work Description is high-cardinality free text. We will not feed raw text into
Isolation Forest.") — correct call, you can't hand raw text to that model.
But it means the model currently sees zero signal from what a work actually says,
only from amounts, dates, and counts.

This script reads the same raw completed_works CSV, runs entity extraction +
duplicate detection (both explainable, both numeric-output), and aggregates the
result to MP level using the EXACT SAME merge keys preprocessing.py already
uses: MP Name, Constituency, State, House.

Drop the two output CSVs this produces into preprocessing.py's merge step
(see bottom of this file for the one-line change) and the Isolation Forest
gets real NLP signal from the text column it currently can't touch.

OUTPUT
------
nlp_work_features.csv   — one row per Work ID (completed_works granularity)
nlp_mp_features.csv     — one row per (MP Name, Constituency, State, House)
                           — this is the one that merges into
                           preprocessing.py's expenditure_final / model_df

Column naming matches preprocessing.py's convention (Title_Case_With_Underscores,
e.g. MP_Transaction_Count) so the merged table reads as one pipeline.

BUG FIX (files 4 audit): Work ID dtype mismatch.
  entity features used int64 Work IDs, duplicate features used str Work IDs —
  the merge silently produced all-NaN rows at full scale (43k works).
  Fix: explicit astype(str) on all Work ID columns before every merge.

NOTE on blocking key for duplicate detection:
  Rajya Sabha MPs' Constituency field is a placeholder ("Sitting Rajya Sabha")
  shared by ~149 different MPs in this dataset — blocking on Constituency alone
  would incorrectly pool them all into one group. MP Name doesn't have that
  problem, so we block by MP Name.
"""

from __future__ import annotations
import os
import pandas as pd
import numpy as np

from entity_extraction import extract as extract_entities
from duplicate_detection import Work, find_duplicates

MERGE_KEYS = ["MP Name", "Constituency", "State", "House"]
OUTPUT_DIR = "mplads_outputs"


def run_entity_extraction(completed: pd.DataFrame) -> pd.DataFrame:
    """Per-work entity/quality features from raw completed_works dataframe."""
    rows = []
    for _, r in completed.iterrows():
        desc = r.get("Work Description")
        work_id = str(r["Work ID"])   # BUG FIX: explicit str cast
        if pd.isna(desc):
            rows.append({
                "Work ID": work_id,
                "NLP_Work_Type": None,
                "NLP_Amount_Mentions": 0,
                "NLP_Quality_Score": np.nan,
                "NLP_Vagueness_Score": np.nan,
                "NLP_Is_Vague": 0,
            })
            continue
        ent = extract_entities(work_id, str(desc))
        rows.append({
            "Work ID": work_id,
            "NLP_Work_Type": ent.work_types[0] if ent.work_types else None,
            "NLP_Amount_Mentions": len(ent.mentioned_amounts),
            "NLP_Quality_Score": ent.quality_score,
            "NLP_Vagueness_Score": ent.vagueness_score,
            "NLP_Is_Vague": int(ent.quality_score < 0.40),
        })
    return pd.DataFrame(rows)


def run_duplicate_detection(completed: pd.DataFrame) -> pd.DataFrame:
    """
    Per-work duplicate signal, blocked by MP Name.

    Tracks three counters per work:
    - NLP_Max_Duplicate_Score: highest composite score this work appeared in
    - NLP_Duplicate_Flag_Count: total flags this work appeared in
    - NLP_Unverifiable_Recipient_Flag_Count: flags where entity_overlap_confident=False
      (both descriptions lack a named recipient — can't confirm same or different
       beneficiary without manual review)
    """
    df = completed.dropna(subset=["Work Description"]).copy()
    df["Work ID"] = df["Work ID"].astype(str)   # BUG FIX: explicit str cast

    max_score_by_work: dict[str, float] = {}
    flag_count_by_work: dict[str, int] = {}
    unverifiable_count_by_work: dict[str, int] = {}

    for mp_name, group in df.groupby("MP Name"):
        if len(group) < 2:
            continue
        works = [
            Work(
                work_id=str(r["Work ID"]),
                description=str(r["Work Description"]),
                village_or_ward=str(r.get("Constituency", "")),
                implementing_agency=str(r.get("IDA", "")),
                sanctioned_amount=float(r.get("Final Amount (₹)", 0) or 0),
            )
            for _, r in group.iterrows()
        ]
        flags = find_duplicates(works)
        for f in flags:
            for wid in (f.work_id_a, f.work_id_b):
                max_score_by_work[wid] = max(max_score_by_work.get(wid, 0.0), f.composite_score)
                flag_count_by_work[wid] = flag_count_by_work.get(wid, 0) + 1
                if not f.entity_overlap_confident:
                    unverifiable_count_by_work[wid] = unverifiable_count_by_work.get(wid, 0) + 1

    rows = []
    for wid in completed["Work ID"].astype(str):   # BUG FIX: explicit str cast
        rows.append({
            "Work ID": wid,
            "NLP_Max_Duplicate_Score": max_score_by_work.get(wid, 0.0),
            "NLP_Duplicate_Flag_Count": flag_count_by_work.get(wid, 0),
            "NLP_Unverifiable_Recipient_Flag_Count": unverifiable_count_by_work.get(wid, 0),
        })
    return pd.DataFrame(rows).drop_duplicates(subset=["Work ID"])


def build_mp_level_features(work_features: pd.DataFrame, completed: pd.DataFrame) -> pd.DataFrame:
    """Aggregate work-level NLP features up to the MP grain for preprocessing.py merge."""
    merge_cols = ["Work ID"] + MERGE_KEYS
    available_keys = [k for k in MERGE_KEYS if k in completed.columns]
    merge_cols = ["Work ID"] + available_keys

    merged = (
        completed[merge_cols]
        .astype({"Work ID": str})   # BUG FIX: explicit str cast
        .merge(work_features, on="Work ID", how="left")
    )

    agg_dict = {
        "NLP_Avg_Vagueness_Score": ("NLP_Vagueness_Score", "mean"),
        "NLP_Vague_Work_Count": ("NLP_Is_Vague", "sum"),
        "NLP_Total_Works_Scored": ("Work ID", "count"),
        "NLP_Avg_Duplicate_Score": ("NLP_Max_Duplicate_Score", "mean"),
        "NLP_Max_Duplicate_Score": ("NLP_Max_Duplicate_Score", "max"),
        "NLP_Total_Duplicate_Flags": ("NLP_Duplicate_Flag_Count", "sum"),
        "NLP_Unverifiable_Recipient_Flags": ("NLP_Unverifiable_Recipient_Flag_Count", "sum"),
    }

    agg = merged.groupby(available_keys).agg(**agg_dict).reset_index()
    agg["NLP_Vague_Work_Rate"] = (
        agg["NLP_Vague_Work_Count"] / agg["NLP_Total_Works_Scored"].replace(0, np.nan)
    )
    return agg


def run_pipeline(completed_path: str, output_dir: str = OUTPUT_DIR) -> tuple:
    """
    Main entry point. Reads completed_works CSV, runs NLP, writes output CSVs.

    Args:
        completed_path: Path to mplads_completed_works_*.csv
        output_dir: Directory to write nlp_work_features.csv and nlp_mp_features.csv

    Returns:
        (work_features DataFrame, mp_features DataFrame)
    """
    os.makedirs(output_dir, exist_ok=True)

    print("=" * 70)
    print("NLP FEATURE PIPELINE")
    print("=" * 70)

    completed = pd.read_csv(completed_path)
    print(f"\nLoaded {len(completed):,} completed works from {completed_path}")

    required_cols = ["Work ID", "Work Description", "MP Name"]
    missing = [c for c in required_cols if c not in completed.columns]
    if missing:
        raise ValueError(f"CSV missing required columns: {missing}. "
                         f"Available columns: {list(completed.columns)}")

    print("\nRunning entity extraction...")
    entity_features = run_entity_extraction(completed)

    print("Running duplicate detection (blocked by MP Name)...")
    duplicate_features = run_duplicate_detection(completed)

    # BUG FIX: both sides cast to str before merge
    work_features = (
        entity_features.astype({"Work ID": str})
        .merge(duplicate_features.astype({"Work ID": str}), on="Work ID", how="left")
    )
    work_features.to_csv(os.path.join(output_dir, "nlp_work_features.csv"), index=False)
    print(f"\nSaved nlp_work_features.csv ({len(work_features):,} rows)")

    mp_features = build_mp_level_features(work_features, completed)
    mp_features.to_csv(os.path.join(output_dir, "nlp_mp_features.csv"), index=False)
    print(f"Saved nlp_mp_features.csv ({len(mp_features):,} rows, keyed on {[k for k in MERGE_KEYS if k in completed.columns]})")

    print("\nSample MP-level NLP features:")
    print(mp_features.head(5).to_string(index=False))

    return work_features, mp_features


if __name__ == "__main__":
    import sys
    completed_path = sys.argv[1] if len(sys.argv) > 1 else "mplads_completed_works_2026-08-26.csv"
    run_pipeline(completed_path)

    # --- Integration with preprocessing.py: ONE LINE to add ---
    #
    # After preprocessing.py builds `expenditure_final` (step 16, right
    # after the summary merge) and before it builds `model_df` (step 21):
    #
    #   nlp_mp = pd.read_csv("mplads_outputs/nlp_mp_features.csv")
    #   expenditure_final = expenditure_final.merge(nlp_mp, on=merge_keys, how="left")
    #
    # Every NLP_ column is already numeric — flows straight through
    # model_df's numeric_columns → SimpleImputer → StandardScaler →
    # Isolation Forest with zero other config changes. Nothing in
    # DROP_FOR_MODEL needs updating.
