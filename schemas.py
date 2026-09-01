"""
Pydantic schemas and request/response contracts for MPLADS NLP API microservice.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class WorkItem(BaseModel):
    work_id: str = Field(..., example="W01029")
    description: str = Field(..., example="To provide IT systems to Govt High School Rampur")
    village_or_ward: Optional[str] = Field(default="", example="Rampur")
    implementing_agency: Optional[str] = Field(default="", example="PWD")
    sanctioned_amount: Optional[float] = Field(default=0.0, example=500000.0)


class DuplicateRequest(BaseModel):
    works: List[WorkItem]
    threshold: Optional[float] = Field(default=0.62, example=0.62)


class DuplicateFlagSchema(BaseModel):
    work_id_a: str
    work_id_b: str
    composite_score: float
    tfidf_similarity: float
    semantic_similarity: float
    fuzzy_similarity: float
    location_agency_match: bool
    entity_overlap: float
    entity_overlap_confident: bool   # False = unverifiable recipient, needs manual check
    amount_similarity: float
    reasons: List[str]
    recommendation: str


class DuplicateResponse(BaseModel):
    flags_count: int
    flags: List[DuplicateFlagSchema]


class EntityRequest(BaseModel):
    work_id: str = Field(..., example="W01029")
    description: str = Field(..., example="Construction of CC road from Rampur village to Main Road, Rs. 5.00 Lakhs")


class EntityResponse(BaseModel):
    work_id: str
    work_types: List[str]
    locations: List[str]
    beneficiaries_and_objects: List[str]
    agencies_vendors: List[str]
    mentioned_amounts: List[float]
    vague_terms_found: List[str]
    quality_score: float
    vagueness_score: float
    specificity_level: str
    quality_risk_signal: str
    word_count: int


class CategoryRequest(BaseModel):
    work_id: str = Field(..., example="W01029")
    description: str = Field(..., example="Installation of RO drinking water purification unit")


class CategoryResponse(BaseModel):
    work_id: str
    primary_category: str
    confidence: str
    keyword_category: Optional[str]
    semantic_category: Optional[str]
    matched_keywords: List[str]
    category_scores: Dict[str, float]


class ExplainRequest(BaseModel):
    work_id: str = Field(..., example="W01029")
    description: str = Field(..., example="Development works as required")
    duplicate_score: Optional[float] = Field(default=0.0, example=0.85)
    quality_score: Optional[float] = Field(default=0.30, example=0.30)
    duplicate_reasons: Optional[List[str]] = Field(default_factory=list)
    vague_terms: Optional[List[str]] = Field(default_factory=list)
    primary_category: Optional[str] = Field(default="Community Infrastructure")


class ExplainResponse(BaseModel):
    work_id: str
    headline: str
    risk_level: str
    summary: str
    evidence_checklist: List[str]
    recommended_action: str
    cag_audit_flag: str


class TrainRequest(BaseModel):
    model_type: Optional[str] = Field(default="logistic", example="logistic")


class TrainResponse(BaseModel):
    status: str
    model_type: str
    accuracy: float
    precision: float
    recall: float
    f1: float
    n_samples: int


# --- Dataset Ingestion Schemas ---

class DatasetDuplicateRequest(BaseModel):
    csv_content: str = Field(..., description="CSV content string containing work dataset records")
    threshold: Optional[float] = Field(default=0.62, example=0.62)
    block_by_constituency: Optional[bool] = Field(default=True, example=True)


class DatasetDuplicateResponse(BaseModel):
    summary: Dict[str, Any]
    flags_count: int
    flags: List[DuplicateFlagSchema]


class SyntheticDatasetRequest(BaseModel):
    num_records: Optional[int] = Field(default=50, example=50)


class SyntheticDatasetResponse(BaseModel):
    num_records: int
    records: List[Dict[str, Any]]
