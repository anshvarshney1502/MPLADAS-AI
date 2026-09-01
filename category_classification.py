"""
Hybrid Project Category Classifier for MPLADS Work Descriptions.

Combines Rule-Based Keyword Matching with Semantic Vector Similarity to
categorize projects and provide confidence scores (HIGH vs LOW).
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Any
import numpy as np
from embeddings import ACTIVE_HYBRID_BACKEND
from entity_extraction import WORK_TYPE_KEYWORDS

STANDARD_CATEGORIES: Dict[str, str] = {
    "road": "Roads & Bridges",
    "water_supply": "Water Supply & Sanitation",
    "sanitation": "Water Supply & Sanitation",
    "education": "Education Infrastructure",
    "health": "Health & Family Welfare",
    "community_infra": "Community Infrastructure",
    "lighting": "Public Lighting & Energy",
}

CATEGORY_PROTOTYPES: Dict[str, str] = {
    "Roads & Bridges": "Construction of CC road pavement WBM road bridge culvert sadak tar road asphalt rasta",
    "Water Supply & Sanitation": "Installation of reverse osmosis RO water purification plant borewell handpump overhead tank pipeline drinking water supply toilet sanitation drainage",
    "Education Infrastructure": "Construction of school building classroom computer lab library books anganwadi smart board furniture for school college hostel vidyalaya",
    "Health & Family Welfare": "Construction of health centre hospital dispensary medical equipment ambulance primary health PHC CHC oxygen plant ICU health sub-centre",
    "Community Infrastructure": "Construction of community hall samudayik bhawan panchayat bhawan crematorium shamshan park bus shelter tin shed stadium playground auditorium boundary wall",
    "Public Lighting & Energy": "Installation of high mast solar street light LED light flood light electrification transformer lighting",
}

def _cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    denom = (np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


@dataclass
class ClassificationResult:
    work_id: str
    description: str
    primary_category: str
    confidence: str  # HIGH, MEDIUM, LOW
    keyword_category: str | None
    semantic_category: str | None
    matched_keywords: List[str]
    category_scores: Dict[str, float]


class HybridCategoryClassifier:
    def __init__(self):
        self.categories = list(CATEGORY_PROTOTYPES.keys())
        self.proto_texts = [CATEGORY_PROTOTYPES[c] for c in self.categories]
        self._fitted = False
        self.proto_tfidf_vecs = None
        self.proto_semantic_vecs = None

    def _fit_prototypes(self):
        if not self._fitted:
            self.proto_tfidf_vecs, self.proto_semantic_vecs = ACTIVE_HYBRID_BACKEND.fit_transform(self.proto_texts)
            self._fitted = True

    def classify_rule_based(self, description: str) -> Tuple[str | None, List[str]]:
        text_lower = description.lower()
        matched_kw = []
        matched_cats = []

        for internal_cat, kws in WORK_TYPE_KEYWORDS.items():
            for kw in kws:
                if kw in text_lower:
                    matched_kw.append(kw)
                    std_cat = STANDARD_CATEGORIES.get(internal_cat, "Community Infrastructure")
                    if std_cat not in matched_cats:
                        matched_cats.append(std_cat)

        primary_rule_cat = matched_cats[0] if matched_cats else None
        return primary_rule_cat, matched_kw

    def classify_semantic(self, description: str) -> Tuple[str, Dict[str, float]]:
        self._fit_prototypes()
        # Embed single description along with prototypes
        all_texts = self.proto_texts + [description]
        tfidf_vecs, semantic_vecs = ACTIVE_HYBRID_BACKEND.fit_transform(all_texts)
        desc_tfidf = tfidf_vecs[-1]
        desc_semantic = semantic_vecs[-1]

        scores = {}
        for i, cat in enumerate(self.categories):
            sim_tfidf = _cosine_sim(desc_tfidf, tfidf_vecs[i])
            sim_sem = _cosine_sim(desc_semantic, semantic_vecs[i])
            combined_score = 0.4 * sim_tfidf + 0.6 * sim_sem
            scores[cat] = round(combined_score, 3)

        best_cat = max(scores, key=scores.get)
        return best_cat, scores

    def classify(self, work_id: str, description: str) -> ClassificationResult:
        rule_cat, matched_kws = self.classify_rule_based(description)
        semantic_cat, scores = self.classify_semantic(description)

        if rule_cat and rule_cat == semantic_cat:
            primary_category = rule_cat
            confidence = "HIGH"
        elif rule_cat and rule_cat != semantic_cat:
            primary_category = rule_cat  # rule-based takes priority for explicit keywords
            confidence = "MEDIUM"
        else:
            primary_category = semantic_cat
            confidence = "MEDIUM" if scores[semantic_cat] > 0.35 else "LOW"

        return ClassificationResult(
            work_id=work_id,
            description=description,
            primary_category=primary_category,
            confidence=confidence,
            keyword_category=rule_cat,
            semantic_category=semantic_cat,
            matched_keywords=matched_kws,
            category_scores=scores,
        )


_CLASSIFIER_INSTANCE = HybridCategoryClassifier()

def classify_work_category(work_id: str, description: str) -> ClassificationResult:
    return _CLASSIFIER_INSTANCE.classify(work_id, description)
