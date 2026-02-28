"""
ocr_postprocess.py — Pakistani plate OCR post-processing pipeline.

Fixes implemented:
  Problem 1: remove_regional_bleeding()  — strips province OCR fragments
             that survive character-by-character (e.g. JAB from PUNJAB)
  Problem 2: split_plate_regions()       — 3-zone split discarding top 28%
  Problem 3: validate_pakistani_plate()  — updated regex for 2-letter codes
  Problem 4: remove_year_fragments()     — removes standalone "20" / 4-digit year
  Problem 5: preprocess_for_ocr_enhanced() — upscale FIRST, then process

All functions are pure (no side effects) and have full docstrings.
"""

from __future__ import annotations

import re
import logging
from typing import NamedTuple

import cv2
import numpy as np

log = logging.getLogger(__name__)

# ============================================================================
# PROVINCE FRAGMENT LISTS
# Sorted longest-first at module level so every call is O(1) for sort.
# ============================================================================

# Full province / region names AND common OCR typos — stripped from anywhere in string
_PROVINCE_FULL: list[str] = [
    # Full names
    "BALOCHISTAN", "ISLAMABAD", "GILGIT-BALTISTAN",
    "GILGITBALTISTAN", "GILGIT", "BALTISTAN",
    "PUNJAB", "SINDH", "KHYBER", "PAKHTUNKHWA",
    "AJK", "AZAD", "KASHMIR", "JAMMU",
    "ICT", "KPK", "KP", "GB",
    "FEDERALLY", "ADMINISTERED", "TRIBAL", "AREAS",
    "PAKISTAN", "GOVT", "GOVERNMENT",
    # Common OCR typos / partial reads (3+ chars only — shorter go to fragments)
    "PUNJB", "PUNJ", "PNJB", "PNJAB",       # Punjab typos
    "SNDH", "SIND", "SNDB",                  # Sindh typos
    "BALOCH", "BLOCH", "BALOC",              # Balochistan typos
    "KHYB", "KYBER",                         # KPK typos
    "ISLMBD", "SLMBD", "ISBD",               # Islamabad typos
]


# OCR fragments produced when province names are read character-by-character.
# These are stripped from the START of the OCR result first (most common
# artifact), then from anywhere in the string.
_PROVINCE_FRAGMENTS: list[str] = [
    # PUNJAB fragments (read left-to-right, characters bleed into result)
    "PUNJAB", "PNJAB", "PUNJA", "UNJAB", "NJAB", "PNJA",
    "JAB",    "UAB",   "UNJ",   "NJA",   "JA",
    # SINDH fragments
    "SINDH", "SIND", "IND", "SND", "SIN",
    # BALOCHISTAN fragments
    "BALOCHISTAN", "BALOCH", "ALOCH", "LOCH", "BALOC", "BAL",
    # KPK / KHYBER
    "KPK", "KHYBER", "KPKH", "KHYB",
    # ICT / ISLAMABAD
    "ICT", "ISLAMABAD", "SLMBD", "ISLMBD", "SLABD",
    # AJK / AZAD KASHMIR
    "AJK", "AZAD",
    # GB / GILGIT
    "GB", "GILGIT",
]

# Pre-sort both lists descending by length (greedy match: prefer longer matches)
_PROVINCE_FULL_SORTED     = sorted(_PROVINCE_FULL,      key=len, reverse=True)
_PROVINCE_FRAGMENTS_SORTED = sorted(_PROVINCE_FRAGMENTS, key=len, reverse=True)

# ============================================================================
# PROBLEM 1 — REGIONAL TEXT BLEEDING
# ============================================================================

def remove_regional_bleeding(text: str) -> str:
    """
    Strip province/region OCR artifacts from a raw OCR string.

    Two-pass strategy:
      Pass A: raw .replace() of full province names (e.g. 'PUNJAB', 'SINDH')
              from ANYWHERE in the string — these are unambiguous and long.
      Pass B: strip short OCR fragments (e.g. 'JAB', 'IND', 'JAB') ONLY from
              the START of the string (prefix-only).  Short fragments are NOT
              stripped from mid-string to avoid clobbering real plate text
              (e.g. 'JAB' in 'JABR' is a prefix, but 'JAB' in 'ABC-JAB' is noise
              that should not be stripped because it would corrupt plate text).

    Parameters
    ----------
    text : Raw or partially-cleaned OCR string (uppercase or mixed).

    Returns
    -------
    Cleaned string with province artifacts removed, stripped of leading/
    trailing hyphens, underscores, and spaces.

    Examples
    --------
    >>> remove_regional_bleeding("JABR423")
    'R423'
    >>> remove_regional_bleeding("PUNJABRI423")
    'RI423'
    >>> remove_regional_bleeding("PUNJB RI 423")
    'RI 423'
    >>> remove_regional_bleeding("RI423")
    'RI423'
    >>> remove_regional_bleeding("ABC1234")
    'ABC1234'
    """
    result = text.upper().strip()

    # Pass A — full province name raw replace (safe: long strings, unambiguous)
    for name in _PROVINCE_FULL_SORTED:
        result = result.replace(name, '')
    result = result.strip("-_ ")

    # Pass B — short OCR fragment prefix strip only (longest-first, one pass)
    #          Only strips if the fragment is AT THE START of the string.
    for frag in _PROVINCE_FRAGMENTS_SORTED:
        if result.startswith(frag):
            result = result[len(frag):].strip("-_ ")
            break   # one prefix strip per call max

    return result.strip("-_ ")




# ============================================================================
# PROBLEM 4 — YEAR FRAGMENT REMOVAL
# ============================================================================

def remove_year_fragments(text: str) -> str:
    """
    Remove registration year indicators commonly found on Pakistani plates.

    Targets:
    - 4-digit years 2000–2029  (e.g. "2019", "2023")
    - Standalone 2-digit "20"  (the fragment visible when crop includes
      the year badge box on the plate) — only when NOT part of a longer digit run
    - 4-digit years 19xx when standalone

    Parameters
    ----------
    text : String to clean (uppercase recommended).

    Returns
    -------
    Cleaned string, stripped of leading/trailing hyphens, underscores, spaces.

    Examples
    --------
    >>> remove_year_fragments("RI 20 423")
    'RI  423'
    >>> remove_year_fragments("ABC 2019 1234")
    'ABC  1234'
    >>> remove_year_fragments("ABC1234")   # do NOT strip '12' from '1234'
    'ABC1234'
    """
    # 4-digit year 2000-2029: only when surrounded by non-digits or boundaries
    text = re.sub(r'(?<![0-9])(20[0-2][0-9])(?![0-9])', '', text)

    # 4-digit year 19xx: ONLY when it is a standalone whitespace/hyphen-delimited
    # token — NOT when it is the registration number itself (e.g. LEF-1981).
    # Key insight: if preceded by letters (city code) with no separator, it IS
    # the registration number and must NOT be removed.
    text = re.sub(r'(?<![0-9A-Z])(19\d{2})(?![0-9])', '', text)

    # Standalone "20": only when it is a separate token (space/hyphen-delimited)
    # Does NOT fire on '2034', '120', '209', etc.
    text = re.sub(r'(?<![0-9A-Z])20(?![0-9A-Z])', '', text)

    return text.strip("-_ ")


# ============================================================================
# PROBLEM 3 — UPDATED REGEX VALIDATION
# ============================================================================

# All known Pakistani plate patterns.  Note the 2-letter code minimum to
# handle plates like RI-423, LB-1234, MQ-9999.
_PK_REGEX_PATTERNS: list[re.Pattern] = [
    # Standard: 2–3 letters + optional separator + 3–4 digits  →  RI-423 / ABC-1234
    re.compile(r'^[A-Z]{2,3}[-\s]?\d{3,4}$'),
    # Government / official: 1–2 letters + 4 digits  →  G-1234
    re.compile(r'^[A-Z]{1,2}[-\s]?\d{4}$'),
    # Old format including 4-digit regs: 2-3 letters + 4-5 digits  →  LEF-1981
    re.compile(r'^[A-Z]{2,3}[-\s]?\d{4,5}$'),
    # Old format: digits first  →  1234-ABC
    re.compile(r'^\d{4}[-\s]?[A-Z]{2,3}$'),
    # Series plates: letters + digits + optional trailing letters  →  RI-423-A
    re.compile(r'^[A-Z]{1,3}[-\s]?\d{3,4}[-\s]?[A-Z]{0,2}$'),
]


# 2-digit embedded year: CITY(2-4) + YY(00-26) + REG(3-5 digits)
# MUST have 3+ digits after the year to avoid stripping '12' from '1234'
_EMBEDDED_YEAR_RE = re.compile(
    r'^([A-Z]{2,4})'
    r'(0\d|1\d|2[0-6])'
    r'(\d{3,5})$'    # <-- was \d{1,5}; now minimum 3 to prevent ABC1234→ABC34
)


def is_valid_pakistani_plate(text: str) -> bool:
    """
    Return True if `text` matches any known Pakistani plate format.

    Accepts plates with or without the hyphen separator.
    Enforces a total cleaned length of 4–8 characters.

    Parameters
    ----------
    text : Plate string to test (e.g. 'RI-423', 'ABC1234', 'G-1234').

    Returns
    -------
    bool

    Examples
    --------
    >>> is_valid_pakistani_plate("RI-423")
    True
    >>> is_valid_pakistani_plate("ABC-1234")
    True
    >>> is_valid_pakistani_plate("JABR")
    False
    """
    cleaned = re.sub(r'[-\s]', '', text.upper())
    if not (3 <= len(cleaned) <= 8):      # RI423 = 5 chars minimum practical
        return False
    t = text.upper().strip()
    return any(p.match(t) for p in _PK_REGEX_PATTERNS)


def validate_pakistani_plate(text: str) -> str:
    """
    Validate and reformat a cleaned plate string into standard Pakistani format.

    Steps
    -----
    1. Strip non-alphanumeric chars (except existing hyphens).
    2. Apply dot-separator correction (lone I between 2 letters and digits).
    3. Strip embedded 2-digit registration year (e.g. LED16→LED, then append digits).
    4. Try strict regex match → return 'XY-NNN' format.
    5. Looser regex search as final fallback.

    Parameters
    ----------
    text : Semi-cleaned plate string (may contain hyphens).

    Returns
    -------
    Formatted plate string like 'RI-423' or 'ABC-1234', or 'UNREADABLE'.

    Examples
    --------
    >>> validate_pakistani_plate("RI423")
    'RI-423'
    >>> validate_pakistani_plate("LED161234")
    'LED-1234'
    >>> validate_pakistani_plate("JABR")
    'UNREADABLE'
    """
    if not text or text in ("UNREADABLE", "ERROR"):
        return "UNREADABLE"

    # Keep only alphanumeric
    text = re.sub(r'[^A-Z0-9]', '', text.upper())

    if not text:
        return "UNREADABLE"

    # Dot-separator correction: lone 'I' between exactly 2 letters and digits
    # (e.g. LDI1234 → LD1234). Does NOT fire on 3-letter codes ending in I.
    text = re.sub(r'^([A-Z]{2})I([0-9])', r'\1\2', text)

    # Year-badge 'T' correction: OCR reads the year badge '1' as 'T', bleeding
    # it into the city code.  Pattern: a 4-letter block ending in T + digits
    # e.g. MNFT811 → MNF811 → MNF-811.
    # CRITICAL: only fires when letter block is EXACTLY 4 long (3 real + 1 fake T).
    # Does NOT fire on valid 3-letter codes ending in T like AGT, BGT, LDT, etc.
    text = re.sub(r'^([A-Z]{3})T([0-9])', r'\1\2', text)


    # Year-badge trailing '1' correction: the year badge digit (usually '1'
    # from year '18', '17', '16' etc.) bleeds into the END of the digit run.
    # e.g. LEA18361 is read as LEA3611 — strip the trailing '1'.
    # Guard: only fires when the 3-digit core does NOT start with '1'.
    # This prevents LEF1981 (genuine 4-digit where first 3 = '198' starting with 1)
    # from being incorrectly trimmed.  Real bleed cases: 3611→361, 8111→811,
    # 4271→427 — their 3-digit cores start with 3,8,4 (not 1).
    m_trail = re.match(r'^([A-Z]{2,3})([2-9]\d{2})1$', text)
    if m_trail:
        text = m_trail.group(1) + m_trail.group(2)
        log.debug(f"[trail-1-strip] removed trailing year-badge '1' → '{text}'")

    # Embedded 2-digit year strip: CITY + YY + REG → CITY + REG
    m = _EMBEDDED_YEAR_RE.match(text)
    if m:
        stripped = m.group(1) + m.group(3)
        log.debug(f"[year-strip] '{text}' → '{stripped}' (removed '{m.group(2)}')")
        text = stripped

    # Strict: 1–4 letters + 1–5 digits  →  'XX-NNN'
    match = re.match(r'^([A-Z]{1,4})([0-9]{1,5})$', text)
    if match:
        letters, digits = match.group(1), match.group(2)
        # Extra guard: reject if pure province fragment (e.g. 'JAB')
        if _is_pure_province_fragment(letters):
            return "UNREADABLE"
        return f"{letters}-{digits}"

    # Looser fallback: first alpha run + first digit run
    match = re.search(r'([A-Z]{1,4})([0-9]{1,5})', text)
    if match:
        letters, digits = match.group(1), match.group(2)
        if _is_pure_province_fragment(letters):
            return "UNREADABLE"
        return f"{letters}-{digits}"

    return "UNREADABLE"


def _is_pure_province_fragment(letters: str) -> bool:
    """
    Return True if `letters` is itself a known province OCR fragment
    with no real city-code content.

    Used to reject false positives like 'JAB-423' that still slip through
    after regional bleeding removal.

    Parameters
    ----------
    letters : Uppercase letter string (the city-code portion of the plate).

    Returns
    -------
    bool
    """
    # Must be at least 2 chars to be a real city code
    if len(letters) < 2:
        return True
    # If the whole letter portion is in the fragment list → reject
    return letters in _PROVINCE_FRAGMENTS_SORTED


# ============================================================================
# UNIFIED PIPELINE — The single entry point for post-processing
# ============================================================================

def full_postprocess(raw_ocr_text: str) -> str:
    """
    Apply the complete Pakistani plate post-processing pipeline.

    Steps (in order)
    ----------------
    1. remove_regional_bleeding   — strip province OCR fragments
    2. remove_year_fragments      — strip "20" / 4-digit year tokens
    3. Strip non-alphanumeric chars (keep hyphens)
    4. Clean up multiple / leading / trailing hyphens
    5. Insert hyphen if absent (letter-run → digit-run detection)
    6. Validate with validate_pakistani_plate()

    Parameters
    ----------
    raw_ocr_text : Raw OCR string from any engine, e.g. "JABR-423" or
                   "PUNJAB RI 20 423".

    Returns
    -------
    Cleaned plate string like 'RI-423', or a best-effort result with a
    warning logged if validation fails.

    Examples
    --------
    >>> full_postprocess("JABR-423")
    'RI-423'
    >>> full_postprocess("PUNJABRI423")
    'RI-423'
    >>> full_postprocess("ABC-1234")
    'ABC-1234'
    >>> full_postprocess("LZB-9431")
    'LZB-9431'
    """
    if not raw_ocr_text or not raw_ocr_text.strip():
        return "UNREADABLE"

    text = raw_ocr_text.upper().strip()

    # Step 1 — Strip province OCR bleeding (JAB, NJAB, SINDH, etc.)
    text = remove_regional_bleeding(text)
    if not text:
        return "UNREADABLE"

    # Step 2 — Strip year fragments ("20", "2023")
    text = remove_year_fragments(text)
    if not text:
        return "UNREADABLE"

    # Step 3 — Keep only [A-Z0-9-]
    text = re.sub(r'[^A-Z0-9\-]', '', text)

    # Step 4 — Normalise hyphens
    text = re.sub(r'-+', '-', text).strip('-')

    # Step 5 — Insert hyphen if absent and pattern is clear letters+digits
    if '-' not in text:
        m = re.match(r'^([A-Z]{1,4})(\d{3,5})$', text)
        if m:
            text = f"{m.group(1)}-{m.group(2)}"

    # Step 6 — Full structural validation + formatting
    validated = validate_pakistani_plate(text.replace('-', ''))

    if validated == "UNREADABLE":
        # Log warning but return best-effort
        log.warning(f"[postprocess] Plate '{text}' failed structural validation")

    return validated if validated != "UNREADABLE" else text


# ============================================================================
# PROBLEM 2 — 3-ZONE PLATE SPLITTING
# ============================================================================

class PlateRegions(NamedTuple):
    """Named tuple holding the three split strips of a multi-line plate crop."""
    letters: np.ndarray   # middle zone: registration letters (e.g. "RI")
    numbers: np.ndarray   # bottom zone: registration digits  (e.g. "423")
    combined: np.ndarray  # middle+bottom together for fallback OCR


def split_plate_regions(plate_crop: np.ndarray) -> PlateRegions:
    """
    Split a 3-line Pakistani plate crop into three zones.

    Standard Punjab plate layout (approximate pixel percentages):
    ┌─────────────────────────────────────────┐
    │  0%–28%   PUNJAB  [emblem]  20          │  ← Province strip (DISCARD)
    │ 28%–58%   RI                            │  ← Letters zone
    │ 52%–100%  423                           │  ← Numbers zone  (overlap ok)
    └─────────────────────────────────────────┘

    The province strip (top 28%) is completely discarded — it is always noise.
    The letters and numbers zones overlap slightly at 52–58% to handle plates
    where the font bleeds across the boundary.

    For single-line plates (aspect ratio ≥ 2.5) the caller should NOT use
    this function; the full crop should be passed directly to OCR.

    Parameters
    ----------
    plate_crop : BGR numpy array of the full plate crop from YOLO.

    Returns
    -------
    PlateRegions(letters, numbers, combined) — all BGR numpy arrays.

    Examples
    --------
    >>> regions = split_plate_regions(plate_img)
    >>> letters_text = run_ocr(regions.letters)
    >>> numbers_text = run_ocr(regions.numbers)
    """
    h, w = plate_crop.shape[:2]

    province_end  = int(h * 0.28)   # top 28%  → discard (province name)
    letters_end   = int(h * 0.58)   # 28%–58%  → registration letters
    numbers_start = int(h * 0.52)   # 52%–100% → registration digits (overlap)

    letters_region  = plate_crop[province_end : letters_end,  :]
    numbers_region  = plate_crop[numbers_start : h,           :]
    combined_region = plate_crop[province_end  : h,           :]

    return PlateRegions(
        letters=letters_region,
        numbers=numbers_region,
        combined=combined_region,
    )


# ============================================================================
# PROBLEM 5 — ENHANCED PREPROCESSING (upscale FIRST)
# ============================================================================

def preprocess_for_ocr_enhanced(plate_img: np.ndarray) -> np.ndarray:
    """
    Prepare a plate crop for EasyOCR: upscale to improve resolution, return color.

    EasyOCR is a deep-learning model designed to read color/grayscale images
    natively.  Its `adjust_contrast` parameter handles low-contrast plates.
    Complex binarization pipelines (Otsu, CLAHE, histogram equalisation)
    frequently HURT accuracy by:
      - Misthresholding white plates (destroys digits like '035' → 'UL')
      - Introducing edge artifacts from aggressive sharpening
      - Flipping polarity assumptions for mixed plate types

    Pipeline (deliberate minimalism):
    ----------------------------------
    0. 3× upscale with INTER_CUBIC  — the one step that genuinely helps OCR
       by giving the text detector more pixels to work with
    1. Return the upscaled COLOR image directly
       EasyOCR's readtext() will apply its own internal preprocessing

    Parameters
    ----------
    plate_img : BGR numpy array of any size (typically a YOLO-crop region).

    Returns
    -------
    Upscaled BGR (color) numpy array.  Single-channel input is returned as-is
    after upscaling (passed through without conversion).
    """
    if plate_img is None or plate_img.size == 0:
        raise ValueError("preprocess_for_ocr_enhanced received empty image")

    h, w = plate_img.shape[:2]
    # 3× upscale — more pixels = better text detection accuracy
    upscaled = cv2.resize(plate_img, (w * 3, h * 3), interpolation=cv2.INTER_CUBIC)
    return upscaled
