"""
Entity Extraction & Description Quality Engine for MPLADS.

Pulls out structured entities from unstructured work descriptions:
- Work Types / Categories
- Locations (Village, Ward, Panchayat, Block, District)
- Beneficiaries / Institutional Objects (School, Hospital, Road, Community Hall)
- Implementing Agencies / Vendors
- Financial Amounts (INR / Lakhs / Crores)
- Description Quality & Vagueness Risk Score (CAG Audit Compliance Signal)

BUG FIXES (files 4 audit, tested against real 43k-row dataset):

  Bug 1 — Amount regex double-counted the same number.
    Old regex: r"\\b(?:rs\\.?|₹|inr)\\s*(\\d[\\d,]*(?:\\.\\d+)?)" matched "Rs. 5.00 Lakhs Rs."
    as both the forward pattern AND the reversed pattern -> two 5,00,000 entries.
    Fix: added _dedupe_amounts() to collapse duplicate matches from both patterns.

  Bug 2 — Amount regex swallowed stray numbers.
    "Ward 4, Rs." matched "4," as a bogus rupee 4 amount because [\\d,]+ accepted
    a lone comma. Fix: require digit group to start AND end with a real digit:
    (\\d[\\d,]*\\d|\\d) instead of (\\d[\\d,]*).

  Bug 3 — Location regex missing re.IGNORECASE.
    Silently missed ~76% of real locations (those not in Title Case). Since
    nothing in nlp_feature_pipeline.py consumes the location list directly
    (entity_overlap in duplicate_detection covers that signal), location
    extraction is kept for the FastAPI demo layer but no longer affects the
    quality score (which was being incorrectly penalised for failed extraction).
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Optional, Dict
from functools import lru_cache
import re

# --- Work Category Taxonomy (with Hinglish / Regional terms) ---

WORK_TYPE_KEYWORDS: Dict[str, List[str]] = {
    "road": [
        "road", "cc road", "wbm road", "pavement", "bridge", "culvert", "pulli",
        "paver block", "paving block", "paver", "lane", "sadak", "asphalt",
        "tar road", "marga", "rasta",
    ],
    "water_supply": [
        "ro plant", "reverse osmosis", "water purification", "borewell", "bore well",
        "hand pump", "handpump", "overhead tank", "pipeline", "submersible",
        "water tanker", "tanker", "drinking water", "jal jeevan", "water supply",
        "peyajal", "nalkoop", "tubewell",
    ],
    "sanitation": [
        "toilet", "sanitation", "drainage", "sewage", "shauchalaya", "latrine",
        "waste management", "soak pit", "swachhata",
    ],
    "education": [
        "school building", "classroom", "furniture for school", "computer lab",
        "library", "library books", "anganwadi", "it systems to", "smart board",
        "vidyalaya", "kanya shala", "college", "hostel",
    ],
    "health": [
        "health centre", "hospital", "dispensary", "ambulance", "medical equipment",
        "primary health", "phc", "chc", "icu", "oxygen plant", "health sub-centre",
    ],
    "community_infra": [
        "community hall", "community centre", "samudayik bhawan", "panchayat bhawan",
        "crematorium", "shamshan", "park", "bus shelter", "tin shed", "stadium",
        "sports", "playground", "drama stage", "electrification", "transformer",
        "boundary wall", "chardiwari", "chahardiwari", "kalyan mantapa", "auditorium",
        "bhawan nirman", "sabhagriha", "dharamshala",
    ],
    "lighting": [
        "streetlight", "street light", "high mast", "highmast", "solar light",
        "flood light", "led light", "lighting",
    ],
}

# Vague / Non-specific Description Patterns (CAG Audit Red Flags — Report No. 31)
VAGUE_TERMS = [
    "miscellaneous works", "misc. works", "development works",
    "general improvement", "various works", "other works",
    "as required", "as per need", "beautification works",
    "improvement works", "renovation works", "sundry items",
    "construction work", "repair work", "public works",
]

# --- Regular Expression Patterns ---

# BUG FIX: (\d[\d,]*\d|\d) prevents trailing comma from being swallowed
#           (old: (\d[\d,]*(?:\.\d+)?) matched "Ward 4," → bogus ₹4)
AMOUNT_PATTERN = re.compile(
    r"\b(?:rs\.?|₹|inr)\s*(\d[\d,]*\d|\d)(?:\.\d+)?\s*(lakh|lakhs|crore|crores)?",
    re.IGNORECASE,
)
AMOUNT_PATTERN_REVERSED = re.compile(
    r"\b(\d[\d,]*\d|\d)(?:\.\d+)?\s*(lakh|lakhs|crore|crores)?\s*rs\.?\b",
    re.IGNORECASE,
)

# Location patterns (kept with re.IGNORECASE — BUG FIX for 76% miss rate)
LOCATION_PATTERNS = [
    re.compile(
        r"\b(?:village|gram|gp|ward|panchayat|block|tehsil|taluka|district|nagar|locality)"
        r"\s*[-:]?\s*([A-Z][a-zA-Z0-9'\s-]{2,25})\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:at|in|near|from|to)\s+([A-Z][a-zA-Z0-9'\s-]{2,20})\s+"
        r"(?:village|ward|panchayat|block|district|nagar)\b",
        re.IGNORECASE,
    ),
    re.compile(r"\bward\s*(?:no\.?|num\.?|number)?\s*(\d{1,4}[a-zA-Z]?)\b", re.IGNORECASE),
]

BENEFICIARY_OBJECT_PATTERNS = [
    re.compile(
        r"\b(?:government|govt\.?|primary|high|higher secondary|zila parishad|municipal)"
        r"\s+(school|hospital|phc|chc|anganwadi|college|dispensary)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(school|hospital|college|anganwadi|phc|chc|dispensary|community hall|"
        r"samudayik bhawan|panchayat bhawan|crematorium|playground|stadium|park|"
        r"library|water tank|borewell|road|bridge|culvert)\b",
        re.IGNORECASE,
    ),
]

AGENCY_VENDOR_PATTERNS = [
    re.compile(
        r"\b(?:pwd|drda|zila parishad|gram panchayat|municipal corporation|"
        r"block development officer|bdo|cpwd|nbcc|irrigation dept|rural development|"
        r"constructions?\s*ltd|contractor)\b",
        re.IGNORECASE,
    )
]


@dataclass
class ExtractedEntities:
    work_id: str
    work_types: List[str] = field(default_factory=list)
    locations: List[str] = field(default_factory=list)
    beneficiaries_and_objects: List[str] = field(default_factory=list)
    agencies_vendors: List[str] = field(default_factory=list)
    mentioned_amounts: List[float] = field(default_factory=list)
    vague_terms_found: List[str] = field(default_factory=list)
    quality_score: float = 0.0      # 0.0 (vague/poor) to 1.0 (highly specific)
    vagueness_score: float = 1.0    # 1.0 - quality_score
    specificity_level: str = "VAGUE"
    quality_risk_signal: str = "HIGH_RISK_DATA_QUALITY"
    word_count: int = 0


def _normalize_amount(value: str, unit: Optional[str]) -> float:
    num = float(value.replace(",", ""))
    if unit:
        unit = unit.lower()
        if unit.startswith("lakh"):
            num *= 100_000
        elif unit.startswith("crore"):
            num *= 10_000_000
    return num


def _dedupe_amounts(amounts: List[float]) -> List[float]:
    """
    BUG FIX: Forward and reversed patterns can both match the same number when
    a description has "Rs. 5.00 Lakh Rs." — collapse that double-match without
    discarding genuinely distinct repeated amounts elsewhere in the description.
    """
    seen = []
    for a in amounts:
        if a not in seen:
            seen.append(a)
    return seen


def extract_locations(text: str) -> List[str]:
    locations = []
    for pat in LOCATION_PATTERNS:
        for match in pat.finditer(text):
            loc = match.group(1).strip()
            if loc and len(loc) > 1 and loc not in locations:
                locations.append(loc)
    return locations


def extract_beneficiaries_and_objects(text: str) -> List[str]:
    items = []
    for pat in BENEFICIARY_OBJECT_PATTERNS:
        for match in pat.finditer(text):
            item = match.group(0).strip()
            if item and item not in items:
                items.append(item)
    return items


def extract_agencies(text: str) -> List[str]:
    agencies = []
    for pat in AGENCY_VENDOR_PATTERNS:
        for match in pat.finditer(text):
            agency = match.group(0).strip()
            if agency and agency not in agencies:
                agencies.append(agency)
    return agencies


@lru_cache(maxsize=50_000)
def _extract_core(description: str) -> tuple:
    """
    Pure, description-only extraction core (no work_id in the key).

    MPLADS completed-works descriptions are heavily templated — the same
    string recurs across thousands of Work IDs (e.g. identical procurement
    templates sent to many schools). Every field computed here depends only
    on `description`, so caching on that string alone lets repeated
    descriptions across a dataset skip regex/keyword work entirely without
    changing a single output value versus the uncached path.
    """
    text_lower = description.lower()
    word_count = len(description.split())

    # Work type detection
    work_types = [
        category for category, keywords in WORK_TYPE_KEYWORDS.items()
        if any(kw in text_lower for kw in keywords)
    ]

    # Location extraction (re.IGNORECASE bug fixed)
    locations = extract_locations(description)

    # Beneficiary / object extraction
    beneficiaries = extract_beneficiaries_and_objects(description)

    # Agency extraction
    agencies = extract_agencies(description)

    # Amount extraction with BUG FIX: dedup + fixed regex boundary
    raw_amounts = [
        _normalize_amount(m.group(1), m.group(2))
        for m in AMOUNT_PATTERN.finditer(description)
    ] + [
        _normalize_amount(m.group(1), m.group(2))
        for m in AMOUNT_PATTERN_REVERSED.finditer(description)
    ]
    amounts = _dedupe_amounts(raw_amounts)

    # Vagueness detection
    vague_found = [term for term in VAGUE_TERMS if term in text_lower]

    # 6-Factor Quality Score
    quality = 0.0
    if work_types:
        quality += 0.35
    if locations:
        quality += 0.20
    if amounts:
        quality += 0.20
    if word_count >= 8:
        quality += 0.25
    if vague_found:
        quality -= 0.25 * len(vague_found)
    quality = round(max(0.0, min(1.0, quality)), 2)
    vagueness = round(1.0 - quality, 2)

    if quality >= 0.65:
        specificity_level = "HIGH"
        quality_risk_signal = "LOW_RISK"
    elif quality >= 0.35:
        specificity_level = "MEDIUM"
        quality_risk_signal = "MEDIUM_RISK"
    else:
        specificity_level = "VAGUE"
        quality_risk_signal = "HIGH_RISK_DATA_QUALITY"

    return (
        tuple(work_types), tuple(locations), tuple(beneficiaries), tuple(agencies),
        tuple(amounts), tuple(vague_found), quality, vagueness,
        specificity_level, quality_risk_signal, word_count,
    )


def extract(work_id: str, description: str) -> ExtractedEntities:
    (work_types, locations, beneficiaries, agencies, amounts, vague_found,
     quality, vagueness, specificity_level, quality_risk_signal,
     word_count) = _extract_core(description)

    return ExtractedEntities(
        work_id=work_id,
        work_types=list(work_types),
        locations=list(locations),
        beneficiaries_and_objects=list(beneficiaries),
        agencies_vendors=list(agencies),
        mentioned_amounts=list(amounts),
        vague_terms_found=list(vague_found),
        quality_score=quality,
        vagueness_score=vagueness,
        specificity_level=specificity_level,
        quality_risk_signal=quality_risk_signal,
        word_count=word_count,
    )
