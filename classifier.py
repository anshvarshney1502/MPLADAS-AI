"""
ML Duplicate Pair Classifier for MPLADS NLP Engine (Phase 3 Proof-of-Concept).

Note: The classifier architecture is implemented as a proof-of-concept module. 
Current model training uses synthetic archetype pairs and is designed to be 
calibrated with expert-reviewed historical MPLADS project pairs in production.

Extracts pair features (TF-IDF, Semantic, Fuzzy, Entity, Location, Agency, Amount)
and fits a Logistic Regression model to output predicted duplicate probabilities.
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import List, Tuple, Dict, Any
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

from duplicate_detection import Work, _entity_overlap, _fuzzy_score, _cosine, _amount_sim
from embeddings import ACTIVE_HYBRID_BACKEND
from category_classification import classify_work_category


@dataclass
class LabeledPair:
    work_a: Work
    work_b: Work
    label: int  # 0 = Distinct, 1 = Duplicate / High Risk


@dataclass
class ClassifierMetrics:
    accuracy: float
    precision: float
    recall: float
    f1: float
    n_samples: int


class DuplicatePairClassifier:
    """
    ML Pair Classifier utilizing Logistic Regression or Random Forest.
    """

    def __init__(self, model_type: str = "logistic"):
        self.model_type = model_type
        if model_type == "random_forest":
            self.model = RandomForestClassifier(n_estimators=50, max_depth=5, random_state=42)
        else:
            self.model = LogisticRegression(C=1.0, max_iter=200, random_state=42)
        self.is_trained = False
        self.feature_names = [
            "tfidf_similarity",
            "semantic_similarity",
            "fuzzy_similarity",
            "location_agency_match",
            "entity_overlap",
            "amount_similarity",
            "category_match"
        ]

    def extract_pair_features(self, work_a: Work, work_b: Work, tfidf_vecs: Tuple[np.ndarray, np.ndarray], sem_vecs: Tuple[np.ndarray, np.ndarray]) -> np.ndarray:
        tfidf_sim = _cosine(tfidf_vecs[0], tfidf_vecs[1])
        semantic_sim = _cosine(sem_vecs[0], sem_vecs[1])
        fuzzy_sim = _fuzzy_score(work_a.description, work_b.description)

        same_loc = bool(work_a.village_or_ward and work_b.village_or_ward and work_a.village_or_ward.strip().lower() == work_b.village_or_ward.strip().lower())
        same_agency = bool(work_a.implementing_agency and work_b.implementing_agency and work_a.implementing_agency.strip().lower() == work_b.implementing_agency.strip().lower())
        loc_agency_match = 1.0 if (same_loc and same_agency) else (0.5 if (same_loc or same_agency) else 0.0)

        entity_overlap_val, _ = _entity_overlap(work_a.description, work_b.description)
        amount_sim = _amount_sim(work_a.sanctioned_amount, work_b.sanctioned_amount)

        cat_a = classify_work_category(work_a.work_id, work_a.description).primary_category
        cat_b = classify_work_category(work_b.work_id, work_b.description).primary_category
        category_match = 1.0 if cat_a == cat_b else 0.0

        return np.array([
            float(tfidf_sim),
            float(semantic_sim),
            float(fuzzy_sim),
            float(loc_agency_match),
            float(entity_overlap_val),
            float(amount_sim),
            float(category_match)
        ])

    def fit(self, dataset: List[LabeledPair]) -> ClassifierMetrics:
        if len(dataset) < 4:
            raise ValueError("Training dataset must contain at least 4 labeled pairs.")

        X_list = []
        y_list = []

        for pair in dataset:
            texts = [pair.work_a.description, pair.work_b.description]
            tfidf_matrix, sem_matrix = ACTIVE_HYBRID_BACKEND.fit_transform(texts)
            feats = self.extract_pair_features(
                pair.work_a, pair.work_b,
                (tfidf_matrix[0], tfidf_matrix[1]),
                (sem_matrix[0], sem_matrix[1])
            )
            X_list.append(feats)
            y_list.append(pair.label)

        X = np.array(X_list)
        y = np.array(y_list)

        self.model.fit(X, y)
        self.is_trained = True

        y_pred = self.model.predict(X)
        metrics = ClassifierMetrics(
            accuracy=round(float(accuracy_score(y, y_pred)), 3),
            precision=round(float(precision_score(y, y_pred, zero_division=0)), 3),
            recall=round(float(recall_score(y, y_pred, zero_division=0)), 3),
            f1=round(float(f1_score(y, y_pred, zero_division=0)), 3),
            n_samples=len(dataset)
        )
        return metrics

    def predict_pair(self, work_a: Work, work_b: Work) -> Dict[str, Any]:
        texts = [work_a.description, work_b.description]
        tfidf_matrix, sem_matrix = ACTIVE_HYBRID_BACKEND.fit_transform(texts)
        feats = self.extract_pair_features(
            work_a, work_b,
            (tfidf_matrix[0], tfidf_matrix[1]),
            (sem_matrix[0], sem_matrix[1])
        )

        if not self.is_trained:
            # Fallback heuristic prediction if untrained
            heuristic_prob = float(0.35 * feats[0] + 0.35 * feats[1] + 0.15 * feats[2] + 0.15 * feats[4])
            return {
                "duplicate_probability": round(heuristic_prob, 3),
                "is_duplicate_predicted": heuristic_prob >= 0.65,
                "model_status": "heuristic_uncalibrated",
                "feature_contributions": dict(zip(self.feature_names, [round(f, 3) for f in feats]))
            }

        probs = self.model.predict_proba([feats])[0]
        duplicate_prob = float(probs[1]) if len(probs) > 1 else float(probs[0])

        return {
            "duplicate_probability": round(duplicate_prob, 3),
            "is_duplicate_predicted": duplicate_prob >= 0.50,
            "model_status": f"trained_{self.model_type}",
            "feature_contributions": dict(zip(self.feature_names, [round(f, 3) for f in feats]))
        }


def generate_sample_labeled_dataset() -> List[LabeledPair]:
    """
    Generates a synthetic / historical validation pair dataset for model calibration.
    """
    return [
        # Pair 1: Duplicate (Same school, same IT proposal, same ward)
        LabeledPair(
            work_a=Work("W01", "To provide IT systems to Govt High School Rampur as per specs", "Rampur", "PWD", 500000),
            work_b=Work("W02", "Providing IT system and computers to Govt High School Rampur", "Rampur", "PWD", 500000),
            label=1
        ),
        # Pair 2: Template non-duplicate (Different schools in different wards)
        LabeledPair(
            work_a=Work("W03", "To provide IT systems to Govt High School Rampur as per specs", "Rampur", "PWD", 500000),
            work_b=Work("W04", "To provide IT systems to St Mary High School Panaji as per specs", "Panaji", "DRDA", 500000),
            label=0
        ),
        # Pair 3: Duplicate (Paraphrased RO water plant, same village)
        LabeledPair(
            work_a=Work("W05", "Construction of RO drinking water purification plant at Village Keri", "Keri", "PWD", 250000),
            work_b=Work("W06", "Installation of reverse osmosis water supply unit in Keri village", "Keri", "PWD", 250000),
            label=1
        ),
        # Pair 4: Distinct (Road vs Water in different villages)
        LabeledPair(
            work_a=Work("W07", "Construction of CC road from main road to GP office", "Borim", "PWD", 800000),
            work_b=Work("W08", "Installation of solar street lights along riverbank", "Mapusa", "Zila Parishad", 300000),
            label=0
        )
    ]
