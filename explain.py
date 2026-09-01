"""
Explainability & Evidence Generation Engine for MPLADS Audit Microservice.

Translates complex hybrid NLP signals, entity extractions, and duplicate scores
into clear, concise executive explanations suitable for UI dashboard risk cards.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any


@dataclass
class ExplanationResult:
    work_id: str
    headline: str
    risk_level: str  # CRITICAL, HIGH, MEDIUM, LOW
    summary: str
    evidence_checklist: List[str]
    recommended_action: str
    cag_audit_flag: str


def generate_explanation(
    work_id: str,
    description: str,
    duplicate_reasons: Optional[List[str]] = None,
    quality_score: float = 1.0,
    vague_terms: Optional[List[str]] = None,
    primary_category: str = "General Infrastructure",
    duplicate_score: float = 0.0
) -> ExplanationResult:
    vague_terms = vague_terms or []
    duplicate_reasons = duplicate_reasons or []

    evidence = []
    
    # 1. Duplicate Risk Signals
    if duplicate_score >= 0.80:
        headline = "CRITICAL: Potential Duplicate Work / Double Sanction Detected"
        risk_level = "CRITICAL"
        evidence.append(f"Composite similarity score: {duplicate_score:.0%}")
        for r in duplicate_reasons:
            evidence.append(r)
    elif duplicate_score >= 0.62:
        headline = "WARNING: Near-Duplicate Work Description Detected"
        risk_level = "HIGH"
        evidence.append(f"Composite similarity score: {duplicate_score:.0%}")
        for r in duplicate_reasons:
            evidence.append(r)
    # 2. Quality / Vagueness Signals
    elif quality_score < 0.40:
        headline = "DATA QUALITY AUDIT FLAG: Non-Specific / Vague Work Description"
        risk_level = "MEDIUM"
        evidence.append(f"Description specificity score: {quality_score:.0%} (Below CAG 40% threshold)")
        if vague_terms:
            evidence.append(f"Non-specific boilerplate terms found: {', '.join(vague_terms)}")
        evidence.append("Missing core parameters (Location / Beneficiary / Scope of Work)")
    else:
        headline = "NORMAL: Work Description Validated"
        risk_level = "LOW"
        evidence.append(f"Description specificity score: {quality_score:.0%}")
        evidence.append(f"Categorized under: {primary_category}")

    # Summary Generation
    if risk_level in ["CRITICAL", "HIGH"]:
        summary = (
            f"Work ID '{work_id}' matches another project proposal with {duplicate_score:.0%} similarity. "
            f"Matched reasons include: {'; '.join(duplicate_reasons[:2])}. "
            "This suggests potential double-billing or redundant re-sanctioning."
        )
        recommended_action = "Flag for administrative review and site verification before further action."
        cag_audit_flag = "High-Risk Similarity: Candidate for Administrative Review"

    elif risk_level == "MEDIUM":
        summary = (
            f"Work ID '{work_id}' contains a vague or non-specific description ('{description[:50]}...'). "
            "It lacks essential details regarding exact location boundaries or recipient institution."
        )
        recommended_action = "Request detailed itemized estimate and site map from implementing agency before approving sanction order."
        cag_audit_flag = "Project Specificity & Data Quality Risk Flag"

    else:
        summary = f"Work ID '{work_id}' has a specific, well-defined work description in category '{primary_category}'."
        recommended_action = "Proceed with routine processing and milestone tracking."
        cag_audit_flag = "COMPLIANT"

    return ExplanationResult(
        work_id=work_id,
        headline=headline,
        risk_level=risk_level,
        summary=summary,
        evidence_checklist=evidence,
        recommended_action=recommended_action,
        cag_audit_flag=cag_audit_flag
    )
