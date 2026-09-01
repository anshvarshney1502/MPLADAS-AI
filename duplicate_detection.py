"""
Duplicate & Near-Duplicate Work Detection Engine for MPLADS.

Composite scoring:
  composite_score = 0.35 * tfidf_similarity
                  + 0.20 * fuzzy_similarity
                  + 0.25 * entity_overlap
                  + 0.10 * location_agency_match
                  + 0.10 * amount_similarity

  The semantic_similarity signal (LSA/TruncatedSVD) has been removed from the
  batch scoring formula. On small per-MP blocks (dozens of works), TruncatedSVD
  collapses to 1-2 components and produces near-1.0 cosine similarity between
  almost any two texts sharing common template language — it was measuring a
  small-sample artifact, not meaning. Semantic similarity is still computed and
  returned by the FastAPI single-work check endpoint for demo purposes.

BUG FIX (files 4 audit, tested against real dataset):

  Bug — Entity-overlap guard never fired in practice.
    Old guard: fired only if entity_overlap < 0.40 AND loc_agency_match < 0.5.
    Problem: within a single MP block (which is exactly what this runs on),
    same location/agency is the norm, not the exception — so "AND loc_agency <
    0.5" almost never triggered. The guard existed to catch procurement templates
    ("To provide IT systems to <SCHOOL> as per specs") sent to different schools
    under the same MP, but those have same location/agency AND low entity_overlap,
    so the old AND condition permanently disabled it.

    Fix: guard fires on entity_overlap alone, and only when entity detection is
    actually confident (both descriptions had extractable named entities to compare).
    entity_overlap of exactly 0.5 means "couldn't tell" (no proper nouns found
    on one or both sides) — those are handled separately and flagged as
    unverifiable-recipient, not confirmed different.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Tuple
from itertools import combinations
from functools import lru_cache
import re
import numpy as np

try:
    from rapidfuzz import fuzz
    def _fuzzy_score(s1: str, s2: str) -> float:
        return fuzz.token_sort_ratio(s1, s2) / 100.0
except ImportError:
    import difflib
    def _fuzzy_score(s1: str, s2: str) -> float:
        return difflib.SequenceMatcher(None, s1.lower(), s2.lower()).ratio()

from embeddings import ACTIVE_HYBRID_BACKEND, ACTIVE_BACKEND

THRESHOLD = 0.62

_PROPER_NOUN_PATTERN = re.compile(r"\b[A-Z][A-Za-z.'&-]*(?:\s+[A-Z][A-Za-z.'&-]*)*\b")
_TEMPLATE_STOPWORDS = {
    "to", "the", "of", "and", "for", "at", "in", "a", "an", "as", "per",
    "high", "higher", "secondary", "primary", "school", "vidyalaya",
    "vidyamandir", "systems", "system", "it", "ro", "cc", "gp", "pwd",
    "goa", "constituency", "village", "gram", "panchayat", "block",
    "district", "provide", "following", "with", "near", "construction",
    "work", "works", "installation", "supply", "providing", "fitting",
    "govt", "government", "specifications", "indicated", "herewith",
}


@lru_cache(maxsize=50_000)
def _entity_tokens(description: str) -> frozenset:
    """
    Cached on description text: within a single find_duplicates() call this
    is looked up O(n) times per work across O(n^2) pairs (and the same
    description recurs across many work pairs in templated MPLADS data), so
    caching avoids redundant regex/tokenization work without touching the
    result value. frozenset (not set) so the cached object can't be mutated
    by a caller and corrupt the cache for later lookups.
    """
    spans = _PROPER_NOUN_PATTERN.findall(description)
    tokens = set()
    for span in spans:
        for word in span.split():
            w = word.strip(".,'").lower()
            if len(w) > 2 and w not in _TEMPLATE_STOPWORDS:
                tokens.add(w)
    return frozenset(tokens)


def _entity_overlap(a: str, b: str) -> Tuple[float, bool]:
    """
    Returns (score, confident).

    confident=True: both sides had named entities — score reflects real overlap
      (0 = confirmed different recipients, 1 = same recipient).
    confident=False (score=0.5): no proper nouns found on one/both sides —
      genuinely can't tell. Signal is neutral, not evidence either way.
      Flagged separately as NLP_Unverifiable_Recipient in pipeline output.
    """
    tokens_a, tokens_b = _entity_tokens(a), _entity_tokens(b)
    if not tokens_a or not tokens_b:
        return 0.5, False
    intersection = tokens_a & tokens_b
    union = tokens_a | tokens_b
    return (len(intersection) / len(union) if union else 0.5), True


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    return float(np.dot(a, b) / denom) if denom else 0.0


def _amount_sim(amt_a: float, amt_b: float) -> float:
    if amt_a <= 0 or amt_b <= 0:
        return 0.5
    return round(min(amt_a, amt_b) / max(amt_a, amt_b), 3)


@dataclass
class Work:
    work_id: str
    description: str
    village_or_ward: str = ""
    implementing_agency: str = ""
    sanctioned_amount: float = 0.0


@dataclass
class DuplicateFlag:
    work_id_a: str
    work_id_b: str
    composite_score: float
    tfidf_similarity: float
    semantic_similarity: float   # kept for FastAPI demo; NOT used in batch formula
    fuzzy_similarity: float
    location_agency_match: bool
    entity_overlap: float
    entity_overlap_confident: bool   # NEW: False = unverifiable-recipient case
    amount_similarity: float
    reasons: List[str]
    recommendation: str


def find_duplicates(works: List[Work], custom_threshold: float = THRESHOLD) -> List[DuplicateFlag]:
    if len(works) < 2:
        return []

    texts = [w.description for w in works]

    # Use hybrid backend for demo endpoints; for batch pipeline use ACTIVE_BACKEND
    try:
        tfidf_matrix, semantic_matrix = ACTIVE_HYBRID_BACKEND.fit_transform(texts)
    except Exception:
        tfidf_matrix = ACTIVE_BACKEND.fit_transform(texts)
        semantic_matrix = tfidf_matrix  # neutral fallback

    flags: List[DuplicateFlag] = []
    for i, j in combinations(range(len(works)), 2):
        a, b = works[i], works[j]

        tfidf_sim = _cosine(tfidf_matrix[i], tfidf_matrix[j])
        semantic_sim = _cosine(semantic_matrix[i], semantic_matrix[j])
        fuzzy_sim = _fuzzy_score(a.description, b.description)

        same_loc = bool(
            a.village_or_ward and b.village_or_ward
            and a.village_or_ward.strip().lower() == b.village_or_ward.strip().lower()
        )
        same_agency = bool(
            a.implementing_agency and b.implementing_agency
            and a.implementing_agency.strip().lower() == b.implementing_agency.strip().lower()
        )
        loc_agency_match_bool = same_loc and same_agency
        loc_agency_match_score = 1.0 if loc_agency_match_bool else (0.5 if (same_loc or same_agency) else 0.0)

        entity_ov, entity_confident = _entity_overlap(a.description, b.description)
        amount_sim = _amount_sim(a.sanctioned_amount, b.sanctioned_amount)

        # Calibrated formula (semantic removed from batch weights — see module docstring)
        composite = (
            0.35 * tfidf_sim
            + 0.20 * fuzzy_sim
            + 0.25 * entity_ov
            + 0.10 * loc_agency_match_score
            + 0.10 * amount_sim
        )

        # BUG FIX: Guard now fires on entity_overlap alone (not AND'd with
        # location mismatch). Only fires when confident — entity_overlap=0.5
        # means "couldn't detect entities", not "confirmed different".
        if entity_confident and entity_ov < 0.30:
            composite *= 0.50

        if composite >= custom_threshold:
            reasons = []
            if tfidf_sim > 0.50:
                reasons.append(f"High lexical match ({tfidf_sim:.0%} TF-IDF overlap)")
            if semantic_sim > 0.50:
                reasons.append(f"High semantic similarity ({semantic_sim:.0%} meaning match)")
            if fuzzy_sim > 0.50:
                reasons.append(f"Wording sequence match ({fuzzy_sim:.0%} fuzzy similarity)")
            if loc_agency_match_bool:
                reasons.append("Identical location (village/ward) and implementing agency")
            elif same_loc:
                reasons.append("Identical village/ward location")
            elif same_agency:
                reasons.append("Identical implementing agency")
            if entity_confident and entity_ov > 0.50:
                reasons.append(f"Identical named recipient/institution ({entity_ov:.0%} entity overlap)")
            elif not entity_confident:
                reasons.append(
                    "No named recipient in either description — cannot confirm same beneficiary, verify manually"
                )
            if amount_sim > 0.85 and (a.sanctioned_amount > 0 or b.sanctioned_amount > 0):
                reasons.append(f"Nearly identical expenditure (Amount similarity: {amount_sim:.0%})")
            if not reasons:
                reasons.append("Combined signal threshold crossed")

            recommendation = (
                "HIGH RISK: Candidate for administrative review and physical verification before approving sanction order."
                if composite >= 0.80 else
                "WARNING: Moderate similarity detected. Verify project proposals and beneficiary lists before sanctioning funds."
            )

            flags.append(DuplicateFlag(
                work_id_a=a.work_id,
                work_id_b=b.work_id,
                composite_score=round(composite, 3),
                tfidf_similarity=round(tfidf_sim, 3),
                semantic_similarity=round(semantic_sim, 3),
                fuzzy_similarity=round(fuzzy_sim, 3),
                location_agency_match=loc_agency_match_bool,
                entity_overlap=round(entity_ov, 3),
                entity_overlap_confident=entity_confident,
                amount_similarity=round(amount_sim, 3),
                reasons=reasons,
                recommendation=recommendation,
            ))

    flags.sort(key=lambda f: f.composite_score, reverse=True)
    return flags
