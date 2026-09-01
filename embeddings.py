"""
Embedding backend abstraction & Hybrid Similarity Engine for MPLADS NLP.

Combines Lexical (TF-IDF) + Semantic (SentenceTransformer / LSA Fallback)
embeddings to deliver context-aware, paraphrase-resilient similarity matching.

BUG FIX (files 4 audit): Added crash-fallback to TfidfBackend.fit_transform.
Real case: a block of 36 works all had the verbatim description "MS pole with
LED semi High Mast Light" — every term hit 100% document frequency, adaptive
max_df=0.7 pruned the entire vocabulary to nothing, and TF-IDF raised a
ValueError crash. Now retries without max_df filtering, then falls back to
treating all texts as textually identical (correct for this case).
"""

from __future__ import annotations
from abc import ABC, abstractmethod
from typing import List, Tuple
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
import warnings


class EmbeddingBackend(ABC):
    @abstractmethod
    def fit_transform(self, texts: List[str]) -> np.ndarray:
        """Embed a batch of texts. Returns (n_texts, dim) array."""
        ...

    @abstractmethod
    def transform_one(self, text: str) -> np.ndarray:
        """Embed a single new text against an already-fitted vocabulary."""
        ...


class TfidfBackend(EmbeddingBackend):
    """
    Lexical similarity backend. Zero external downloads, fast, deterministic.
    Captures exact keyword overlap, repeated phrasing, and copy-pasted templates.

    max_df logic (from files 4 audit, tested on real data):
    - max_df=1.0 on tiny batches (n<10): with only 2-3 documents, a shared word
      trivially hits 100% doc frequency — filtering it would strip exactly the
      shared-wording signal duplicate detection needs.
    - max_df=0.7 once n>=10: at that size, a template phrase shared across MOST
      works in a block is boilerplate, not identity, and should be downweighted.
    """

    def __init__(self, adapt_max_df: bool = True):
        self._adapt_max_df = adapt_max_df
        self.vectorizer: TfidfVectorizer | None = None
        self._fitted = False

    def _build_vectorizer(self, n_docs: int) -> TfidfVectorizer:
        max_df = 0.7 if (self._adapt_max_df and n_docs >= 10) else 1.0
        return TfidfVectorizer(
            ngram_range=(1, 2),
            min_df=1,
            max_df=max_df,
            stop_words="english",
            sublinear_tf=True,
        )

    def fit_transform(self, texts: List[str]) -> np.ndarray:
        if not texts:
            return np.empty((0, 0))
        self.vectorizer = self._build_vectorizer(n_docs=len(texts))
        try:
            matrix = self.vectorizer.fit_transform(texts)
        except ValueError:
            # BUG FIX: Real crash case — 36 identical descriptions caused
            # adaptive max_df=0.7 to prune vocabulary to nothing.
            # Retry without filtering first; if still degenerate, return
            # ones-matrix (texts are textually identical — correct signal).
            try:
                self.vectorizer = TfidfVectorizer(
                    ngram_range=(1, 2), min_df=1, max_df=1.0,
                    stop_words="english", sublinear_tf=True,
                )
                matrix = self.vectorizer.fit_transform(texts)
            except ValueError:
                self._fitted = True
                return np.ones((len(texts), 1))
        self._fitted = True
        return matrix.toarray()

    def transform_one(self, text: str) -> np.ndarray:
        if not self._fitted or self.vectorizer is None:
            raise RuntimeError("Call fit_transform on the corpus first.")
        return self.vectorizer.transform([text]).toarray()[0]


class SemanticFallbackBackend(EmbeddingBackend):
    """
    Lightweight Semantic Fallback using LSA (TruncatedSVD on TF-IDF).

    NOTE (files 4 audit): On small per-MP blocks (dozens of works), LSA collapses
    to 1-2 components and produces near-1.0 similarities between almost any two
    texts sharing common template language. This backend is kept for the FastAPI
    demo / single-work-check use case only. Do NOT use it as a production
    duplicate-detection signal on small blocks — it measures co-occurrence
    artifacts, not meaning.
    """

    def __init__(self, n_components: int = 32):
        self.n_components = n_components
        self.vectorizer: TfidfVectorizer | None = None
        self.svd: TruncatedSVD | None = None
        self._fitted = False

    def fit_transform(self, texts: List[str]) -> np.ndarray:
        if not texts:
            return np.empty((0, 0))
        n_docs = len(texts)
        n_comp = min(self.n_components, n_docs - 1) if n_docs > 1 else 1
        self.vectorizer = TfidfVectorizer(
            ngram_range=(1, 3), analyzer="char_wb", min_df=1, sublinear_tf=True,
        )
        try:
            tfidf_matrix = self.vectorizer.fit_transform(texts)
        except ValueError:
            self._fitted = True
            return np.ones((len(texts), 1))
        n_features = tfidf_matrix.shape[1]
        n_comp = min(n_comp, n_features - 1) if n_features > 1 else 1
        self.svd = TruncatedSVD(n_components=n_comp, random_state=42)
        dense = self.svd.fit_transform(tfidf_matrix)
        norms = np.linalg.norm(dense, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        self._fitted = True
        return dense / norms

    def transform_one(self, text: str) -> np.ndarray:
        if not self._fitted or self.vectorizer is None or self.svd is None:
            raise RuntimeError("Call fit_transform on the corpus first.")
        tfidf_vec = self.vectorizer.transform([text])
        dense = self.svd.transform(tfidf_vec)
        norm = np.linalg.norm(dense)
        return (dense / norm)[0] if norm > 0 else dense[0]


class SentenceTransformerBackend(EmbeddingBackend):
    """
    Production Neural Embedding backend.
    Catches semantic paraphrases TF-IDF misses (e.g., 'RO plant' vs 'reverse
    osmosis purification unit'). Requires huggingface.co access to download
    model weights. Falls back to SemanticFallbackBackend if unavailable.
    """

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self._model = None

    def _load_model(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self.model_name)

    def fit_transform(self, texts: List[str]) -> np.ndarray:
        self._load_model()
        return self._model.encode(texts, normalize_embeddings=True)

    def transform_one(self, text: str) -> np.ndarray:
        self._load_model()
        return self._model.encode([text], normalize_embeddings=True)[0]


class HybridEmbeddingBackend:
    """
    Hybrid Embedding Strategy (TF-IDF + Semantic).

    Returns both lexical (TF-IDF) and semantic (SentenceTransformer or LSA)
    vectors concurrently for use by duplicate_detection.py's composite scorer.

    NOTE: Semantic signal is used only by the FastAPI demo endpoints (single-work
    checks). The batch nlp_feature_pipeline.py uses TfidfBackend directly for
    reliability on small per-MP blocks.
    """

    def __init__(self, use_neural_semantic: bool = True):
        self.tfidf_backend = TfidfBackend()
        self.use_neural_semantic = use_neural_semantic
        self.semantic_backend: EmbeddingBackend | None = None
        self._init_semantic_backend()

    def _init_semantic_backend(self):
        if self.use_neural_semantic:
            try:
                self.semantic_backend = SentenceTransformerBackend()
            except Exception:
                warnings.warn(
                    "SentenceTransformer unavailable, falling back to LSA Semantic Backend."
                )
                self.semantic_backend = SemanticFallbackBackend()
        else:
            self.semantic_backend = SemanticFallbackBackend()

    def fit_transform(self, texts: List[str]) -> Tuple[np.ndarray, np.ndarray]:
        """Returns (tfidf_matrix, semantic_matrix)"""
        tfidf_vecs = self.tfidf_backend.fit_transform(texts)
        try:
            semantic_vecs = self.semantic_backend.fit_transform(texts)
        except Exception:
            self.semantic_backend = SemanticFallbackBackend()
            semantic_vecs = self.semantic_backend.fit_transform(texts)
        return tfidf_vecs, semantic_vecs


# Default active backend instances
# - ACTIVE_BACKEND: used by nlp_feature_pipeline.py (TF-IDF only, crash-safe)
# - ACTIVE_HYBRID_BACKEND: used by duplicate_detection.py FastAPI endpoints
ACTIVE_BACKEND: EmbeddingBackend = TfidfBackend()
ACTIVE_HYBRID_BACKEND = HybridEmbeddingBackend(use_neural_semantic=False)
