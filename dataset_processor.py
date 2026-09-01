"""
Dataset Processing, CSV Ingestion & Synthetic Benchmark Generator for MPLADS NLP.

Provides seamless CSV/Excel dataset loading, column mapping, blocking by constituency,
batch duplicate scanning, entity quality enrichment, and synthetic MPLADS dataset generation.
"""

from __future__ import annotations
from typing import List, Dict, Any, Optional, Tuple
import io
import pandas as pd
import numpy as np

from duplicate_detection import Work, find_duplicates, DuplicateFlag
from entity_extraction import extract as extract_entities, ExtractedEntities
from category_classification import classify_work_category

# Column Mapping Heuristics
COLUMN_ALIASES: Dict[str, List[str]] = {
    "work_id": ["work_id", "work_code", "id", "project_id", "sl_no", "workid", "code"],
    "description": ["description", "work_description", "project_name", "work_name", "remarks", "work_name_desc", "details"],
    "village_or_ward": ["village_or_ward", "village", "ward", "panchayat", "location", "constituency", "block", "district"],
    "implementing_agency": ["implementing_agency", "agency", "ida", "dept", "department", "contractor", "executing_agency"],
    "sanctioned_amount": ["sanctioned_amount", "amount", "cost", "cost_lakh", "expenditure", "sanction_amount", "recommended_amount"],
    "mp_name": ["mp_name", "mp", "honble_mp", "member_of_parliament", "constituency_mp"]
}


def normalize_dataframe_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Standardizes column names of an uploaded dataset matching MPLADS data schemas.
    """
    df_clean = df.copy()
    columns_lower = {col: str(col).strip().lower().replace(" ", "_").replace("-", "_") for col in df_clean.columns}
    df_clean.rename(columns=columns_lower, inplace=True)

    mapped_cols = {}
    for target_col, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if alias in df_clean.columns and target_col not in mapped_cols:
                mapped_cols[alias] = target_col
                break

    df_clean.rename(columns=mapped_cols, inplace=True)

    # Ensure required columns exist with defaults if missing
    if "work_id" not in df_clean.columns:
        df_clean["work_id"] = [f"W_{i+1:04d}" for i in range(len(df_clean))]
    if "description" not in df_clean.columns:
        # Fallback to first text column
        text_cols = df_clean.select_dtypes(include=["object", "string"]).columns
        if len(text_cols) > 0:
            df_clean["description"] = df_clean[text_cols[0]]
        else:
            df_clean["description"] = "Unspecified Work Description"

    if "village_or_ward" not in df_clean.columns:
        df_clean["village_or_ward"] = ""
    if "implementing_agency" not in df_clean.columns:
        df_clean["implementing_agency"] = ""
    if "sanctioned_amount" not in df_clean.columns:
        df_clean["sanctioned_amount"] = 0.0
    else:
        df_clean["sanctioned_amount"] = pd.to_numeric(df_clean["sanctioned_amount"], errors="coerce").fillna(0.0)

    return df_clean


def convert_df_to_works(df: pd.DataFrame) -> List[Work]:
    df_norm = normalize_dataframe_columns(df)
    works = []
    for _, row in df_norm.iterrows():
        works.append(Work(
            work_id=str(row["work_id"]),
            description=str(row["description"]),
            village_or_ward=str(row["village_or_ward"]),
            implementing_agency=str(row["implementing_agency"]),
            sanctioned_amount=float(row["sanctioned_amount"])
        ))
    return works


def process_dataset_duplicates(df: pd.DataFrame, custom_threshold: float = 0.62, block_by_constituency: bool = True) -> Tuple[List[DuplicateFlag], Dict[str, Any]]:
    df_norm = normalize_dataframe_columns(df)
    works = convert_df_to_works(df_norm)

    all_flags: List[DuplicateFlag] = []

    if block_by_constituency and "mp_name" in df_norm.columns:
        # Block duplicate detection by (MP Name, Constituency) to prevent pooling unrelated works together
        groups = df_norm.groupby("mp_name")
        for _, group in groups:
            group_works = convert_df_to_works(group)
            if len(group_works) >= 2:
                flags = find_duplicates(group_works, custom_threshold=custom_threshold)
                all_flags.extend(flags)
    else:
        all_flags = find_duplicates(works, custom_threshold=custom_threshold)

    # Remove duplicate pair flags across blocks if any
    unique_pairs = {}
    for f in all_flags:
        pair_key = tuple(sorted([f.work_id_a, f.work_id_b]))
        if pair_key not in unique_pairs or f.composite_score > unique_pairs[pair_key].composite_score:
            unique_pairs[pair_key] = f

    final_flags = sorted(list(unique_pairs.values()), key=lambda x: x.composite_score, reverse=True)

    flagged_work_ids = set()
    for f in final_flags:
        flagged_work_ids.add(f.work_id_a)
        flagged_work_ids.add(f.work_id_b)

    summary = {
        "total_works_processed": len(works),
        "total_duplicate_flags": len(final_flags),
        "flagged_works_count": len(flagged_work_ids),
        "critical_risk_flags": sum(1 for f in final_flags if f.composite_score >= 0.80),
        "warning_risk_flags": sum(1 for f in final_flags if 0.62 <= f.composite_score < 0.80),
        "duplicate_flag_rate": round(len(flagged_work_ids) / len(works), 3) if len(works) > 0 else 0.0
    }

    return final_flags, summary


def process_dataset_entities(df: pd.DataFrame) -> pd.DataFrame:
    """
    Enriches dataset rows with extracted entities, locations, beneficiaries, and quality risk scores.
    """
    df_norm = normalize_dataframe_columns(df)
    results = []

    for _, row in df_norm.iterrows():
        w_id = str(row["work_id"])
        desc = str(row["description"])
        ent: ExtractedEntities = extract_entities(w_id, desc)

        row_dict = row.to_dict()
        row_dict.update({
            "nlp_work_types": ", ".join(ent.work_types),
            "nlp_extracted_locations": ", ".join(ent.locations),
            "nlp_extracted_beneficiaries": ", ".join(ent.beneficiaries_and_objects),
            "nlp_extracted_agencies": ", ".join(ent.agencies_vendors),
            "nlp_mentioned_amounts": ", ".join([str(a) for a in ent.mentioned_amounts]),
            "nlp_vague_terms": ", ".join(ent.vague_terms_found),
            "nlp_quality_score": ent.quality_score,
            "nlp_vagueness_score": ent.vagueness_score,
            "nlp_specificity_level": ent.specificity_level,
            "nlp_quality_risk_signal": ent.quality_risk_signal,
            "nlp_word_count": ent.word_count
        })
        results.append(row_dict)

    return pd.DataFrame(results)


def generate_synthetic_mplads_dataset(num_records: int = 50) -> pd.DataFrame:
    """
    Generates a realistic synthetic MPLADS dataset containing real-world archetype patterns:
    - Specific genuine works
    - Exact duplicate sanction entries
    - Paraphrased duplicate works (same village, same institution, different wording)
    - Template non-duplicates (same procurement template, different recipients)
    - Vague boilerplate descriptions (CAG audit red flags)
    """
    rng = np.random.default_state(42) if hasattr(np.random, 'default_state') else np.random.RandomState(42)

    agencies = ["PWD", "DRDA", "Zila Parishad", "Municipal Corporation", "Irrigation Department"]
    locations = ["Village Rampur", "Ward 12 Panaji", "Village Keri", "GP Borim", "Block Margao", "Village Mapusa"]
    mp_names = ["Shri Rajesh Kumar (South Goa)", "Smt. Sunita Sharma (North Goa)", "Shri Amit Verma (Lucknow)"]

    base_records = [
        # Archetype 1: Genuine Specific Work
        {"description": "Construction of CC road from Rampur Village main road to Panchayat Bhavan, length 1.5 km", "village_or_ward": "Village Rampur", "implementing_agency": "PWD", "sanctioned_amount": 850000.0, "archetype": "genuine_specific"},
        # Archetype 2: Paraphrased Duplicate Pair (Work A & Work B)
        {"description": "Installation of RO drinking water purification plant at Govt High School Keri", "village_or_ward": "Village Keri", "implementing_agency": "PWD", "sanctioned_amount": 500000.0, "archetype": "paraphrased_duplicate"},
        {"description": "Providing reverse osmosis water supply unit in Keri village school", "village_or_ward": "Village Keri", "implementing_agency": "PWD", "sanctioned_amount": 500000.0, "archetype": "paraphrased_duplicate"},
        # Archetype 3: Template Reuse Non-Duplicate (School A vs School B)
        {"description": "To provide IT systems to Govt High School Rampur as per specifications indicated herewith", "village_or_ward": "Village Rampur", "implementing_agency": "DRDA", "sanctioned_amount": 450000.0, "archetype": "template_non_duplicate"},
        {"description": "To provide IT systems to St Mary High School Panaji as per specifications indicated herewith", "village_or_ward": "Ward 12 Panaji", "implementing_agency": "Zila Parishad", "sanctioned_amount": 450000.0, "archetype": "template_non_duplicate"},
        # Archetype 4: CAG Vague Description Red Flag
        {"description": "Development works as required and general improvement in constituency", "village_or_ward": "Block Margao", "implementing_agency": "Municipal Corporation", "sanctioned_amount": 1000000.0, "archetype": "cag_vague_red_flag"},
        {"description": "Miscellaneous works and sundry items as per need", "village_or_ward": "Village Mapusa", "implementing_agency": "PWD", "sanctioned_amount": 300000.0, "archetype": "cag_vague_red_flag"},
    ]

    records = []
    for i in range(num_records):
        base = base_records[i % len(base_records)]
        w_id = f"MPLADS_{2026}_{i+1:04d}"
        # Synthetic dataset uses single MP block to validate dataset duplicate detection in tests
        mp = mp_names[0]
        
        records.append({
            "work_id": w_id,
            "description": base["description"],
            "village_or_ward": base["village_or_ward"],
            "implementing_agency": base["implementing_agency"],
            "sanctioned_amount": base["sanctioned_amount"] + float(rng.randint(-10, 10) * 1000),
            "mp_name": mp,
            "archetype_label": base["archetype"]
        })

    return pd.DataFrame(records)
