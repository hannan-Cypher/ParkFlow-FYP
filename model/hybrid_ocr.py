"""
hybrid_ocr.py — Parallel OCR engine for ParkFlow license plate recognition.

Runs fast-plate-ocr (ONNX MobileViT) and EasyOCR simultaneously on a plate crop,
then applies intelligent selection logic to return the highest-confidence result.

Architecture
────────────
  plate_crop ──► fast_plate_ocr_run()   ──► fpocr_text, fpocr_conf
             └─► easyocr_pipeline_run() ──► eocr_text,  eocr_conf
                        │
                        ▼
                 select_best_result()
                        │
                        ▼
                 post_process_plate()   (applied before selection)
                        │
                        ▼
                 validate_pakistan_plate()
                        │
                        ▼
                HybridOCRResult (text, confidence, method, debug_info)

Performance
────────────
- fast-plate-ocr model is a module-level singleton (loaded once, cached forever).
- Total OCR budget: 1.5 s (hard timeout via signal-based decorator).
- CPU-only: no CUDA, no GPU path.
"""

from __future__ import annotations

import logging
import os
import re
import time
from dataclasses import dataclass, field
from functools import lru_cache
from typing import TYPE_CHECKING, Any

import cv2
import easyocr
import numpy as np

# ── New post-processing pipeline (all 5 fixes) ────────────────────────────────
from ocr_postprocess import (
    full_postprocess,
    is_valid_pakistani_plate,
    preprocess_for_ocr_enhanced,
    remove_regional_bleeding,
    remove_year_fragments,
    split_plate_regions,
    validate_pakistani_plate,
)

# ── fast-plate-ocr (requires Python >= 3.10, onnxruntime) ────────────────────
try:
    from fast_plate_ocr import LicensePlateRecognizer
    FAST_PLATE_AVAILABLE = True
except ImportError:
    FAST_PLATE_AVAILABLE = False
    logging.warning(
        "fast-plate-ocr not available — hybrid OCR will fall back to EasyOCR only. "
        "Install with: pip install 'fast-plate-ocr[onnx]'"
    )

log = logging.getLogger(__name__)

# ============================================================================
# CONSTANTS
# ============================================================================

# Noise words / regional text to strip from both OCR outputs
HYPHENATED_COMBOS: list[str] = [
    'ICT-ISLAMABAD', 'ICT-ISBD', 'KPK-PESHAWAR', 'KP-PESHAWAR',
    'PB-LAHORE', 'PUNJAB-LAHORE', 'SD-KARACHI', 'SINDH-KARACHI',
    'BC-QUETTA', 'BALOCHISTAN-QUETTA', 'AJK-MUZAFFARABAD',
    'GB-GILGIT', 'GILGIT-BALTISTAN', 'FATA-PESHAWAR',
]

PAKISTAN_NOISE_WORDS: list[str] = [
    'ISLAMABAD', 'ISBD', 'LAHORE', 'KARACHI', 'PESHAWAR', 'QUETTA',
    'RAWALPINDI', 'RWLPNDI', 'FAISALABAD', 'MULTAN', 'HYDERABAD',
    'GUJRANWALA', 'SIALKOT', 'BAHAWALPUR', 'SARGODHA', 'SUKKUR',
    'LARKANA', 'ABBOTTABAD', 'MARDAN', 'MINGORA', 'SHEIKHUPURA',
    'GUJRAT', 'JHELUM', 'CHAKWAL', 'ATTOCK', 'MIANWALI', 'SAHIWAL',
    'OKARA', 'VEHARI', 'KHANEWAL', 'LODHRAN', 'MUZAFFARGARH',
    'RAHIM', 'BAHAWALNAGAR', 'KASUR', 'NANKANA', 'HAFIZABAD',
    'NAROWAL', 'BAHAUDDIN', 'CHINIOT', 'JHANG', 'PAKPATTAN',
    'KHUSHAB', 'DERA', 'GHAZI', 'KHAN', 'MANDI', 'TOBA', 'TEK',
    'SINGH', 'YAR', 'MUZAFFARABAD', 'MIRPUR', 'MANSEHRA',
    'SWAT', 'KOHAT', 'BANNU', 'TANK', 'LAKKI', 'MARWAT',
    'CHARSADDA', 'NOWSHERA', 'HARIPUR', 'BUNER', 'SHANGLA',
    'BATAGRAM', 'KOHISTAN', 'TORGHAR', 'HANGU', 'KARAK',
    'KURRAM', 'ORAKZAI', 'KHYBER', 'MOHMAND', 'BAJAUR',
    'MALAKAND', 'CHITRAL', 'DIR', 'HUB', 'TURBAT', 'KHUZDAR',
    'KALAT', 'MASTUNG', 'WASHUK', 'AWARAN', 'KECH', 'PANJGUR',
    'GWADAR', 'LASBELA', 'JAFFARABAD', 'NASIRABAD', 'SIBI',
    'ZIARAT', 'HARNAI', 'SHERANI', 'ZHOB', 'BARKHAN', 'LORALAI',
    'MUSAKHEL', 'DUKI', 'CHAGAI', 'NUSHKI', 'KHARAN',
    'SUJAWAL', 'THATTA', 'BADIN', 'THARPARKAR', 'UMERKOT',
    'MIRPURKHAS', 'SANGHAR', 'NAUSHAHRO', 'FEROZE', 'SHAHEED',
    'BENAZIRABAD', 'NAWABSHAH', 'MATIARI', 'JAMSHORO', 'DADU',
    'QAMBAR', 'SHAHDADKOT', 'SHIKARPUR', 'KASHMORE', 'KANDHKOT',
    'JACOBABAD', 'GHOTKI', 'KHAIRPUR', 'NOWSHERO',
    'PUNJAB', 'SINDH', 'KPK', 'KP', 'BALOCHISTAN', 'NWFP',
    'AJK', 'GILGIT', 'BALTISTAN', 'GB', 'ICT', 'FATA', 'PATA',
    'FEDERALLY', 'ADMINISTERED', 'TRIBAL', 'AREAS',
    'AZAD', 'JAMMU', 'KASHMIR',
    'SINDHI', 'BALOCH', 'PATHAN', 'PUNJABI', 'PASHTUN',
    'PAKHTUN', 'HAZARA', 'SARAIKI', 'BRAHUI', 'BALOCHI',
    'PAKISTAN', 'GOVT', 'GOVERNMENT', 'REGISTERED', 'MOTOR',
    'VEHICLE', 'AUTHORITY', 'EXCISE', 'TAXATION', 'REGISTRATION',
    'TRANSPORT', 'BOARD', 'DEPARTMENT', 'OFFICE', 'OFFICIAL',
    'DIPLOMATIC', 'CONSULATE', 'EMBASSY', 'NATO', 'ISAF', 'UN',
    'FEDERAL', 'PROVINCIAL', 'DISTRICT', 'TEHSIL', 'UNION',
    'COUNCIL', 'COMMITTEE', 'CORPORATION',
    'POLICE', 'ARMY', 'NAVY', 'AIRFORCE', 'PAF', 'PN',
    'RANGERS', 'FC', 'SSP', 'DSP', 'ASP', 'SP',
    'LTD', 'PVT', 'ORG', 'COM', 'WWW', 'HTTP',
    'REG', 'NUM', 'MOT', 'VEH',
]

# Pakistani plate patterns
_PK_PATTERNS = [
    re.compile(r'^[A-Z]{2,3}-\d{3,4}$'),     # Standard: ABC-1234
    re.compile(r'^[A-Z]{1,2}-\d{4}$'),         # Government: AB-1234
    re.compile(r'^\d{4}-[A-Z]{2,3}$'),          # Old format: 1234-ABC
]

# Year strip regex: CITY(2-4 letters) + YY(00-26) + REG(1-5 digits)
_YEAR_RE = re.compile(
    r'^([A-Z]{2,4})'
    r'(0\d|1\d|2[0-6])'
    r'(\d{1,5})$'
)

# fast-plate-ocr confidence threshold to prefer it over EasyOCR
FPOCR_CONFIDENCE_THRESHOLD = float(os.environ.get('FPOCR_GATE_THRESHOLD', 0.70))

# Total OCR function budget in seconds
OCR_TIMEOUT_SECONDS = 1.5

# ============================================================================
# RETURN TYPE
# ============================================================================

@dataclass
class HybridOCRResult:
    """
    Result from hybrid_ocr().

    Attributes
    ----------
    text       : Cleaned, validated plate text (e.g. 'LZB-9431') or 'UNREADABLE'.
    confidence : Best available confidence in [0, 1].
    method     : Which engine won: 'fast_plate_ocr', 'easyocr', or 'unreadable'.
    elapsed_ms : Wall-clock time of the full hybrid call in milliseconds.
    debug      : Dict with both engines' raw outputs for logging/analysis.
    """
    text: str
    confidence: float
    method: str
    elapsed_ms: float
    debug: dict[str, Any] = field(default_factory=dict)


# ============================================================================
# MODEL SINGLETON — load once, reuse forever
# ============================================================================

_fpocr_model: "LicensePlateRecognizer | None" = None
_easyocr_reader: easyocr.Reader | None = None


def get_fpocr_model() -> "LicensePlateRecognizer | None":
    """
    Return the singleton fast-plate-ocr LicensePlateRecognizer instance.

    Loads the 'global-plates-mobile-vit-v2-model' on first call (downloads
    the ONNX weights to ~/.cache/fast_plate_ocr/). Subsequent calls are O(1).

    Returns None if fast-plate-ocr is not installed.
    """
    global _fpocr_model
    if not FAST_PLATE_AVAILABLE:
        return None
    if _fpocr_model is None:
        t0 = time.perf_counter()
        try:
            _fpocr_model = LicensePlateRecognizer(
                hub_ocr_model='global-plates-mobile-vit-v2-model',
                device='cpu',   # CPU-only — no CUDA on Intel Mac
            )
            elapsed = (time.perf_counter() - t0) * 1000
            log.info(f"[fast-plate-ocr] Model loaded in {elapsed:.0f} ms")
        except Exception as exc:
            log.error(f"[fast-plate-ocr] Model load failed: {exc}")
            _fpocr_model = None
    return _fpocr_model


def get_easyocr_reader() -> easyocr.Reader:
    """
    Return the singleton EasyOCR Reader instance.

    Shares the same Reader as the main Flask app if already initialised there;
    otherwise creates its own. CPU-only.
    """
    global _easyocr_reader
    if _easyocr_reader is None:
        _easyocr_reader = easyocr.Reader(['en'], gpu=False)
    return _easyocr_reader


# ============================================================================
# TIMEOUT — Removed (Sequential execution replaces parallel Pool)
# ============================================================================


# (Function _run_with_timeout removed)



# ============================================================================
# POST-PROCESSING PIPELINE (shared by both engines)
# ============================================================================

def post_process_plate(raw: str) -> str:
    """
    Clean an OCR-raw string through the Pakistani plate post-processing pipeline.

    Steps
    -----
    1. Uppercase and strip surrounding whitespace.
    2. Remove known hyphenated combos (e.g. 'ICT-ISLAMABAD').
    3. Remove regional/government noise words.
    4. Remove 4-digit model year indicators (e.g. '2019').
    5. Keep only alphanumeric characters.
    6. Strip dot-separator mis-reads (I/IB between city code and digits).
    7. Reject if length < 3 (too short to be a real plate).

    Parameters
    ----------
    raw : Raw OCR string from either engine.

    Returns
    -------
    Cleaned string, or 'UNREADABLE' if the result is invalid.
    """
    if not raw or not raw.strip():
        return "UNREADABLE"

    text = raw.upper().strip()

    # 1. Hyphenated combos first (must precede individual word removal)
    for combo in HYPHENATED_COMBOS:
        text = text.replace(combo, '')

    # 2a. Raw replace pass — handles noise words merged with plate chars
    #     (e.g. 'PUNJABLZB9431'); sort longest-first to avoid partial matches
    for word in sorted(PAKISTAN_NOISE_WORDS, key=len, reverse=True):
        text = text.replace(word, '')

    # 2b. Word-boundary regex pass — catches words separated by spaces/symbols
    #     (e.g. 'PUNJAB LZB-9431'); run AFTER the raw pass on the remaining text
    for word in sorted(PAKISTAN_NOISE_WORDS, key=len, reverse=True):
        text = re.sub(r'\b' + re.escape(word) + r'\b', '', text)

    # 3. Remove 4-digit model year (e.g. 2019, 2023) as standalone token
    text = re.sub(r'\b(19|20)\d{2}\b', '', text)

    # 4. Keep only alphanumeric (strip dots, dashes, spaces)
    text = re.sub(r'[^A-Z0-9]', '', text)

    # 5. Strip dot-separator mis-reads ONLY when they appear as a single 'I'
    #    between a 2-letter prefix and digits (e.g. 'CB·1234' → 'CB1234').
    #    We deliberately do NOT strip trailing 'B' from genuine codes like LZB.
    #    This corrects patterns like 'LDI1234' → 'LD1234' but NOT 'LZB9431'.
    #    Rule: exactly 2 uppercase letters + exactly the letter I + digits.
    text = re.sub(r'^([A-Z]{2})I([0-9])', r'\1\2', text)

    # 6. Minimum length check
    if len(text) < 3:
        return "UNREADABLE"

    return text



def validate_pakistan_plate(text: str) -> str:
    """
    Validate and reformat a cleaned plate string into standard Pakistani format.

    Applies Layer-3 year-strip (removes embedded 2-digit registration year
    between city code and number) and reformats to 'CITY-NUMBER'.

    Examples
    --------
    'LZB9431'   → 'LZB-9431'  ✓
    'LED161234' → 'LED-1234'   (year '16' stripped)
    'PUNJABLZB' → 'UNREADABLE' (city noise leaked through)

    Parameters
    ----------
    text : Post-processed plate string (alphanumeric only, no separators).

    Returns
    -------
    Formatted plate string like 'ABC-1234', or 'UNREADABLE'.
    """
    if not text or text == "UNREADABLE":
        return "UNREADABLE"

    # Ensure clean alphanumeric
    text = re.sub(r'[^A-Z0-9]', '', text.upper())

    # Dot-separator correction: only strip a lone 'I' between exactly 2 letters
    # and digits — avoids clobbering genuine 3-letter codes ending in B (e.g. LZB)
    text = re.sub(r'^([A-Z]{2})I([0-9])', r'\1\2', text)

    # Layer 3: strip embedded registration year (CITY + YY + REG)
    m = _YEAR_RE.match(text)
    if m:
        stripped = m.group(1) + m.group(3)
        log.debug(f"[year-strip] '{text}' → '{stripped}' (removed '{m.group(2)}')")
        text = stripped

    # Strict match: 2–4 letters + 1–5 digits
    match = re.match(r'^([A-Z]{2,4})([0-9]{1,5})$', text)
    if match:
        return f"{match.group(1)}-{match.group(2)}"

    # Looser fallback (handles a couple of extra noise chars at edges)
    match = re.search(r'([A-Z]{2,4})([0-9]{1,5})', text)
    if match:
        return f"{match.group(1)}-{match.group(2)}"

    return "UNREADABLE"


def matches_pk_pattern(text: str) -> bool:
    """
    Return True if `text` matches any known Pakistani plate regex pattern.

    Parameters
    ----------
    text : Validated plate string (e.g. 'LZB-9431').

    Returns
    -------
    bool
    """
    return any(p.match(text) for p in _PK_PATTERNS)


# ============================================================================
# OCR PREPROCESSING — EasyOCR sequential pipeline
# ============================================================================

def preprocess_for_ocr(plate_img: np.ndarray) -> list[tuple[str, np.ndarray]]:
    """
    Apply the sequential EasyOCR preprocessing chain and return a single
    fully-processed image.

    Pipeline: original_resized → gray → denoised → equalized
              → CLAHE-enhanced → sharpened → otsu_inv

    Parameters
    ----------
    plate_img : BGR plate crop (H, W, 3).

    Returns
    -------
    List of one (name, preprocessed_image) tuple.
    """
    height, width = plate_img.shape[:2]

    # Step 1 — upscale 3×
    original_resized = cv2.resize(
        plate_img, (width * 3, height * 3), interpolation=cv2.INTER_CUBIC
    )
    # Step 2 — grayscale
    gray = cv2.cvtColor(original_resized, cv2.COLOR_BGR2GRAY)
    # Step 3 — bilateral denoise
    denoised = cv2.bilateralFilter(gray, 11, 17, 17)
    # Step 4 — global histogram equalisation
    equalized = cv2.equalizeHist(denoised)
    # Step 5 — CLAHE
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(equalized)
    # Step 6 — unsharp-mask sharpening
    kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
    sharpened = cv2.filter2D(enhanced, -1, kernel)
    # Step 7 — Otsu binarization (inverted: white text on black)
    _, otsu_inv = cv2.threshold(
        sharpened, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )

    return [('otsu_inv', otsu_inv)]


def is_in_year_box(bbox: list, img_w: int, img_h: int) -> bool:
    """
    Spatial year-box filter for EasyOCR bbox results.

    Returns True if the detected bbox sits in the top-right corner where
    the 2-digit registration year appears on Pakistani plates.

    Parameters
    ----------
    bbox   : List of 4 corner points [[x0,y0], [x1,y1], [x2,y2], [x3,y3]].
    img_w  : Width of the preprocessed plate image.
    img_h  : Height of the preprocessed plate image.

    Returns
    -------
    bool
    """
    xs = [pt[0] for pt in bbox]
    ys = [pt[1] for pt in bbox]
    cx = sum(xs) / 4
    cy = sum(ys) / 4
    return cy < img_h * 0.45 and cx > img_w * 0.80


def mask_year_region(plate_img: np.ndarray) -> np.ndarray:
    """
    Black out OCR-noise regions on a Pakistani plate crop before any OCR runs.

    Masks TWO regions:
      1. Top-right corner  (top 60% height × rightmost 28% width)
         → 2-digit registration year badge (e.g. '16' for 2016)
      2. Bottom strip      (bottom 22% height, full width)
         → city/province name line (e.g. 'ICT-ISLAMABAD', 'PUNJAB')

    Parameters
    ----------
    plate_img : BGR or grayscale plate crop.

    Returns
    -------
    Copy of plate_img with both noise regions zeroed to black.
    """
    masked = plate_img.copy()
    h, w = masked.shape[:2]
    # Region 1 — top-right year badge
    masked[0:int(h * 0.60), int(w * 0.72):w] = 0
    # Region 2 — bottom city/province name strip (conservative: only bottom 15%)
    masked[int(h * 0.85):h, 0:w] = 0
    return masked


def mask_city_strip_only(plate_img: np.ndarray) -> np.ndarray:
    """
    Black out ONLY the bottom city/province strip — used when no year badge
    is detected, so the top-right region stays intact (protects plate digits).

    Parameters
    ----------
    plate_img : BGR or grayscale plate crop.

    Returns
    -------
    Copy of plate_img with only the bottom city strip zeroed to black.
    """
    masked = plate_img.copy()
    h, w = masked.shape[:2]
    # Only mask bottom city/province name strip (bottom 15%)
    masked[int(h * 0.85):h, 0:w] = 0
    return masked


# Year badge regex: match exactly 1–2 digits in the range 00–29
_YEAR_PROBE_RE = re.compile(r'^(0[0-9]|1[0-9]|2[0-9])$')


def probe_year_region(
    plate_img: np.ndarray,
    reader: easyocr.Reader,
) -> bool:
    """
    Pre-OCR Probe: check if the top-right corner of a plate contains
    a 2-digit registration year badge (e.g. '20', '16', '18').

    Crops the "Year Probe Zone" (top 60% height × rightmost 28% width),
    upscales it, runs a quick EasyOCR pass with bounding boxes, and checks:
      1. Any detected text matches a 2-digit year in range 00–29.
      2. The bbox is ISOLATED within the zone (not bleeding in from the left
         edge, which would indicate it's a continuation of the main plate text).

    This prevents false positives like reading '35' from 'AAY-035' where the
    digits extend from the main plate area into the top-right corner.

    This is near-instantaneous (~20-50ms) because the crop is very small.

    Parameters
    ----------
    plate_img : BGR plate crop (original, un-masked).
    reader    : Initialised easyocr.Reader (CPU).

    Returns
    -------
    True if an isolated year badge is detected, False otherwise.
    """
    if plate_img is None or plate_img.size == 0:
        return False

    h, w = plate_img.shape[:2]

    # Wide single-line plates (aspect ratio >= 3.0) never have year badges
    aspect_ratio = w / h if h > 0 else 99
    if aspect_ratio >= 3.0:
        log.debug(f"[year-probe] aspect={aspect_ratio:.2f} >= 3.0 → no year badge")
        return False

    # Crop the year probe zone: top 60% height × rightmost 28% width
    y_end = int(h * 0.60)
    x_start = int(w * 0.72)
    year_zone = plate_img[0:y_end, x_start:w]

    if year_zone.size == 0:
        return False

    # Upscale 3× for better OCR accuracy on tiny crop
    zh, zw = year_zone.shape[:2]
    year_zone_up = cv2.resize(year_zone, (zw * 3, zh * 3), interpolation=cv2.INTER_CUBIC)
    zw_up, zh_up = zw * 3, zh * 3

    try:
        # Use detail=1 to get bounding boxes for spatial filtering
        probe_results = reader.readtext(
            year_zone_up,
            detail=1,
            paragraph=False,
            min_size=3,
            contrast_ths=0.1,
            adjust_contrast=0.5,
        )

        if not probe_results:
            log.debug("[year-probe] No text found in year zone → no year badge")
            return False

        for (bbox, text, conf) in probe_results:
            digits_only = re.sub(r'[^0-9]', '', text)

            # Must be exactly a 2-digit year (00-29)
            if not _YEAR_PROBE_RE.match(digits_only):
                log.debug(f"[year-probe] '{text}' → digits='{digits_only}' not a year")
                continue

            # Spatial isolation check: the bbox's left edge must NOT touch
            # the left boundary of the probe zone.  If it does, the text is
            # bleeding in from the main plate area (e.g. '35' from 'AAY-035').
            # A real year badge is centered/indented within the zone.
            xs = [pt[0] for pt in bbox]
            left_x = min(xs)
            right_x = max(xs)
            bbox_width = right_x - left_x

            # Criterion 1: left edge must be indented at least 10% into zone
            left_margin_pct = left_x / zw_up if zw_up > 0 else 0

            # Criterion 2: bbox width should be less than 80% of zone width
            # (a real year badge is compact; plate text bleeding in is wider)
            width_pct = bbox_width / zw_up if zw_up > 0 else 1.0

            log.info(
                f"[year-probe] candidate='{text}' digits='{digits_only}' "
                f"conf={conf:.2%} left_margin={left_margin_pct:.1%} "
                f"width_pct={width_pct:.1%}"
            )

            if left_margin_pct < 0.05:
                # Text bbox starts at the left edge of the zone → it's bleeding
                # in from the main plate. NOT an isolated year badge.
                log.info(
                    f"[year-probe] REJECTED: text bleeds from left edge "
                    f"(left_margin={left_margin_pct:.1%} < 5%)"
                )
                continue

            if width_pct > 0.85:
                # Text is too wide relative to the zone — it's spanning most
                # of the zone, likely plate text not a compact year badge.
                log.info(
                    f"[year-probe] REJECTED: text too wide "
                    f"(width={width_pct:.1%} > 85%)"
                )
                continue

            # Passed all checks — this is an isolated year badge
            log.info(f"[year-probe] YEAR DETECTED: '{digits_only}' ✓")
            return True

        log.debug("[year-probe] No isolated year badge found → no year")
        return False

    except Exception as exc:
        log.warning(f"[year-probe] Probe failed: {exc} → defaulting to masking")
        # On failure, safer to assume year exists and mask (existing behavior)
        return True


def is_in_city_box(bbox: list, img_w: int, img_h: int) -> bool:
    """
    Spatial filter: return True if a bbox centre sits in the bottom city strip
    (bottom 15% of plate height).  These detections are the city/province name
    line (e.g. ICT-ISLAMABAD) and must be discarded before building plate text.
    """
    ys = [pt[1] for pt in bbox]
    cy = sum(ys) / 4
    return cy > img_h * 0.85


# ============================================================================
# ENGINE A — fast-plate-ocr runner
# ============================================================================

def run_fast_plate_ocr(
    plate_img: np.ndarray,
) -> tuple[str, float]:
    """
    Run fast-plate-ocr on a single plate crop image.

    Uses the global-plates-mobile-vit-v2-model singleton.
    Per-character confidence scores are retrieved via return_confidence=True
    and averaged to produce an overall confidence.

    Parameters
    ----------
    plate_img : BGR or grayscale numpy array of the plate crop.

    Returns
    -------
    Tuple of (raw_plate_text: str, confidence: float).
    raw_plate_text may contain underscores (_) for empty slots.
    Returns ("", 0.0) on any failure.
    """
    model = get_fpocr_model()
    if model is None:
        return ("", 0.0)

    if plate_img is None or plate_img.size == 0:
        return ("", 0.0)

    try:
        # fast-plate-ocr global-plates model expects GRAYSCALE (1-channel).
        # Convert BGR → grayscale explicitly — do NOT pass RGB or BGR 3-channel.
        if len(plate_img.shape) == 3:
            img_gray = cv2.cvtColor(plate_img, cv2.COLOR_BGR2GRAY)
        else:
            img_gray = plate_img.copy()

        plates, confidences = model.run(img_gray, return_confidence=True)

        if not plates:
            return ("", 0.0)

        raw_text = plates[0] if plates else ""
        # confidences shape: (N, plate_slots) — take first image's scores
        char_confs = confidences[0] if len(confidences) > 0 else np.array([])

        # Remove underscore padding slots from the mean (they usually have high
        # confidence for the '_' class which is just a blank placeholder)
        text_chars = [c for c in raw_text if c != '_']
        if len(text_chars) == 0:
            return ("", 0.0)

        # Average only the character positions that contributed to real output
        n_real = len(text_chars)
        if len(char_confs) >= n_real:
            mean_conf = float(np.mean(char_confs[:n_real]))
        else:
            mean_conf = float(np.mean(char_confs)) if len(char_confs) > 0 else 0.0

        # Strip underscores from text (blank-slot padding)
        clean_text = raw_text.replace('_', '').strip()

        log.debug(
            f"[fast-plate-ocr] raw='{raw_text}' clean='{clean_text}' "
            f"conf={mean_conf:.3f}"
        )
        return (clean_text, mean_conf)

    except Exception as exc:
        log.error(f"[fast-plate-ocr] Inference error: {exc}")
        return ("", 0.0)


# ============================================================================
# ENGINE B — EasyOCR pipeline runner
# ============================================================================

def run_easyocr(
    plate_img: np.ndarray,
    reader: easyocr.Reader,
    force_year_mask: bool | None = None,
) -> tuple[str, float]:
    """
    Run the full EasyOCR preprocessing pipeline on a plate crop.

    Uses the Pre-OCR Probe to decide whether to mask the year region:
      - If probe detects a 2-digit year → mask top-right (year-constrained path)
      - If no year detected → only mask city strip (simple path, preserves digits)

    Pipeline: probe_year_region → conditional masking → preprocess_for_ocr_enhanced
              → readtext → filter year-box bboxes → combine tokens.

    Parameters
    ----------
    plate_img      : BGR plate crop.
    reader         : Initialised easyocr.Reader (CPU).
    force_year_mask: If True/False, bypass the probe and force/skip year masking.
                     If None (default), use the probe to decide automatically.

    Returns
    -------
    Tuple of (combined_text: str, confidence: float).
    Returns ("", 0.0) on failure or empty result.
    """
    if plate_img is None or plate_img.size == 0:
        return ("", 0.0)

    try:
        # ── Pre-OCR Probe: decide whether to mask year region ────────────
        if force_year_mask is not None:
            has_year = force_year_mask
            log.debug(f"[easyocr] Year mask forced: {has_year}")
        else:
            has_year = probe_year_region(plate_img, reader)

        if has_year:
            # Year badge detected → mask both year region AND city strip
            img = mask_year_region(plate_img)
            log.info("[easyocr] Year badge detected → masking year region")
        else:
            # No year badge → only mask city strip, preserve full plate
            img = mask_city_strip_only(plate_img)
            log.info("[easyocr] No year badge → simple path (city strip only)")

        img_version = preprocess_for_ocr_enhanced(img)   # Problem 5 fix
        vh, vw = img_version.shape[:2]

        result = reader.readtext(
            img_version,
            detail=1,
            paragraph=False,
            min_size=5,
            contrast_ths=0.1,
            adjust_contrast=0.5,
        )
        if not result:
            return ("", 0.0)

        tokens, confs = [], []
        for (bbox, text, conf) in result:
            # Only apply year-box spatial filter when year was detected
            if has_year and is_in_year_box(bbox, vw, vh):
                log.debug(f"[easyocr] year-box skip: '{text}'")
                continue
            if is_in_city_box(bbox, vw, vh):
                log.debug(f"[easyocr] city-strip skip: '{text}'")
                continue
            ct = ''.join(c for c in text if c.isalnum()).upper()
            if len(ct) >= 1:
                tokens.append(ct)
                confs.append(conf)

        if not tokens:
            return ("", 0.0)

        combined = ''.join(tokens)
        avg_conf = sum(confs) / len(confs)

        # Prefer results that have both letters AND digits
        has_letters = any(c.isalpha() for c in combined)
        has_digits  = any(c.isdigit() for c in combined)
        score = avg_conf * (1.4 if (has_letters and has_digits) else 1.0)

        return (combined, score)

    except Exception as exc:
        log.error(f"[easyocr] Pipeline error: {exc}")
        return ("", 0.0)


# ============================================================================
# MULTI-LINE SPLIT HANDLER
# ============================================================================

def run_multiline_easyocr(
    plate_img: np.ndarray,
    reader: easyocr.Reader,
) -> tuple[str, float]:
    """
    Handle 3-line Pakistani plates using the new zone-based split.

    Zone layout (Problem 2 fix):
      Zone 0 — top 28%         : Province line (PUNJAB etc.)  → DISCARD
      Zone 1 — 28%–58%        : Registration letters (RI)    → OCR
      Zone 2 — 52%–100%       : Registration digits (423)    → OCR
      Combined — 28%–100%     : Fallback if zones fail

    Only runs for near-square plates (aspect_ratio < 2.5).

    Parameters
    ----------
    plate_img : BGR plate crop.
    reader    : Initialised easyocr.Reader (CPU).

    Returns
    -------
    Tuple of (combined_text: str, confidence: float).
    Returns ("", 0.0) if aspect ratio doesn't warrant splitting.
    """
    if plate_img is None or plate_img.size == 0:
        return ("", 0.0)

    h, w = plate_img.shape[:2]
    aspect_ratio = w / h if h > 0 else 99
    if aspect_ratio >= 2.5:
        return ("", 0.0)   # single-line plate — caller handles it

    # 3-zone split (discards province line automatically)
    regions = split_plate_regions(plate_img)

    letters_text, letters_conf = run_easyocr(regions.letters,  reader)
    numbers_text, numbers_conf = run_easyocr(regions.numbers,  reader)

    # Apply regional bleeding removal to letters zone (Problem 1 fix)
    letters_text = remove_regional_bleeding(letters_text)
    letters_text = remove_year_fragments(letters_text)

    if letters_text and numbers_text:
        # Characters only from letters zone, digits only from numbers zone
        clean_letters = re.sub(r'[^A-Z]', '', letters_text.upper())
        clean_numbers = re.sub(r'[^0-9]', '', numbers_text)
        if clean_letters and clean_numbers:
            combined      = clean_letters + clean_numbers
            combined_conf = (letters_conf + numbers_conf) / 2
            log.debug(
                f"[split3] letters='{clean_letters}' digits='{clean_numbers}' "
                f"→ '{combined}'"
            )
            return (combined, combined_conf)

    # Fallback: OCR on combined (province-stripped) region
    combined_text, combined_conf = run_easyocr(regions.combined, reader)
    if combined_text:
        combined_text = remove_regional_bleeding(combined_text)
    return (combined_text, combined_conf)


# ============================================================================
# MAIN PUBLIC API
# ============================================================================

def hybrid_ocr(
    plate_crop_img: np.ndarray,
    reader: easyocr.Reader | None = None,
) -> HybridOCRResult:
    """
    Run fast-plate-ocr and EasyOCR in parallel on a plate crop, then select
    the best result using intelligent confidence-based logic.

    Timeout is enforced internally using concurrent.futures (thread-safe —
    works inside Flask worker threads, unlike SIGALRM).

    Selection Rules
    ---------------
    1. If fast-plate-ocr confidence > FPOCR_CONFIDENCE_THRESHOLD (0.75) AND
       result matches a Pakistani plate regex → use fast-plate-ocr.
    2. Else if EasyOCR confidence > fast-plate-ocr confidence → use EasyOCR.
    3. Else → use fast-plate-ocr (it's more structurally reliable for Latin).
    4. For multi-line plates, a 3-zone split EasyOCR pass is also tried and
       can override if it produces a higher-confidence valid result.

    Post-processing (full_postprocess) is applied to BOTH engine outputs
    BEFORE selection.

    Parameters
    ----------
    plate_crop_img : BGR numpy array of the cropped plate region from YOLO.
                     May be None or empty — handled gracefully.
    reader         : Optional pre-existing easyocr.Reader.
                     If None, the module-level singleton is used.

    Returns
    -------
    HybridOCRResult with validated text, confidence, winning method, elapsed
    time, and debug dict containing both engines' raw outputs.
    """
    t_start = time.perf_counter()

    # ── Guard: empty / None input ────────────────────────────────────────────
    if plate_crop_img is None or plate_crop_img.size == 0:
        log.warning("[hybrid_ocr] Received empty plate crop")
        return HybridOCRResult(
            text="UNREADABLE", confidence=0.0, method="none", elapsed_ms=0.0,
            debug={"error": "empty input"}
        )

    ocr_reader = reader or get_easyocr_reader()
    
    # Read threshold dynamically (supports runtime change via env var)
    try:
        gate_threshold = float(os.environ.get('FPOCR_GATE_THRESHOLD', FPOCR_CONFIDENCE_THRESHOLD))
    except (ValueError, TypeError):
        gate_threshold = FPOCR_CONFIDENCE_THRESHOLD

    stages_executed = ["fpocr"]

    # ── Step 1: Run fast-plate-ocr (Primary Engine) ──────────────────────────
    t_fpocr_start = time.perf_counter()
    fpocr_raw, fpocr_conf = run_fast_plate_ocr(plate_crop_img)
    t_fpocr_ms = (time.perf_counter() - t_fpocr_start) * 1000

    # Post-process fast-plate-ocr result immediately
    fpocr_valid = full_postprocess(fpocr_raw)
    fpocr_is_valid_pk = (
        fpocr_valid not in ("UNREADABLE", "")
        and is_valid_pakistani_plate(fpocr_valid)
    )

    # ── GATING CRITERIA: Sequential Exit ─────────────────────────────────────
    # If fast-plate-ocr is confident AND result is valid, return immediately
    # Rule: confidence >= threshold AND text must not be empty or unreadable
    if fpocr_conf >= gate_threshold and fpocr_valid not in ("UNREADABLE", "") and fpocr_is_valid_pk:
        elapsed_ms = (time.perf_counter() - t_start) * 1000
        log.info(
            f"[hybrid_ocr] GATED SUCCESS: FPOCR='{fpocr_valid}'({fpocr_conf:.2f}) "
            f"→ '{fpocr_valid}' via fast_plate_ocr [GATED, {elapsed_ms:.0f} ms]"
        )
        return HybridOCRResult(
            text=fpocr_valid,
            confidence=fpocr_conf,
            method="fast_plate_ocr",
            elapsed_ms=elapsed_ms,
            debug={
                "fast_plate_ocr": {
                    "raw":        fpocr_raw,
                    "validated":  fpocr_valid,
                    "confidence": round(fpocr_conf, 4),
                    "elapsed_ms": round(t_fpocr_ms, 1),
                    "pk_match":   fpocr_is_valid_pk,
                },
                "easyocr": {"status": "SKIPPED"},
                "early_exit": True,
                "stages_executed": stages_executed,
                "selected": "fast_plate_ocr",
                "total_ms": round(elapsed_ms, 1),
                "gate_threshold": gate_threshold
            }
        )

    # ── FALLBACK: Run EasyOCR (only if gate failed) ───────────────────────────
    log.info(f"[hybrid_ocr] Gate failed (conf={fpocr_conf:.2f}, text='{fpocr_valid}'), running EasyOCR fallback...")
    
    stages_executed.extend(["easyocr", "split"])

    t_eocr_start = time.perf_counter()
    eocr_raw,  eocr_conf  = run_easyocr(plate_crop_img, ocr_reader)
    t_eocr_ms = (time.perf_counter() - t_eocr_start) * 1000

    # Multi-line split EasyOCR (only for near-square plates)
    t_split_start = time.perf_counter()
    split_raw, split_conf = run_multiline_easyocr(plate_crop_img, ocr_reader)
    t_split_ms = (time.perf_counter() - t_split_start) * 1000

    # ── Post-process Fallback Results ─────────────────────────────────────────
    eocr_valid  = full_postprocess(eocr_raw)
    split_valid = full_postprocess(split_raw)

    # Upgrade EasyOCR if 3-zone split produced a longer, valid result
    if split_valid not in ("UNREADABLE", "") and split_valid != eocr_valid:
        if (
            len(split_valid) >= len(eocr_valid)
            and split_conf > 0.4
        ) or split_conf > eocr_conf:
            eocr_valid = split_valid
            eocr_conf  = split_conf
            log.debug(f"[hybrid_ocr] 3-zone split upgraded EasyOCR → '{eocr_valid}'")

    # ── Final Selection Logic (Same as original but for fallback results) ──
    # Note: fpocr was already processed above
    if fpocr_conf > 0.85 and fpocr_is_valid_pk: # Buffer for extremely high FPOCR
        winner_text   = fpocr_valid
        winner_conf   = fpocr_conf
        winner_method = "fast_plate_ocr"
    elif eocr_conf > fpocr_conf:
        winner_text   = eocr_valid
        winner_conf   = eocr_conf
        winner_method = "easyocr"
    else:
        winner_text   = fpocr_valid if fpocr_valid != "UNREADABLE" else eocr_valid
        winner_conf   = fpocr_conf  if fpocr_valid != "UNREADABLE" else eocr_conf
        winner_method = (
            "fast_plate_ocr" if fpocr_valid != "UNREADABLE" else "easyocr"
        )

    if winner_text == "UNREADABLE":
        winner_method = "unreadable"

    elapsed_ms = (time.perf_counter() - t_start) * 1000

    debug = {
        "fast_plate_ocr": {
            "raw":        fpocr_raw,
            "validated":  fpocr_valid,
            "confidence": round(fpocr_conf, 4),
            "elapsed_ms": round(t_fpocr_ms, 1),
            "pk_match":   fpocr_is_valid_pk,
        },
        "easyocr": {
            "raw":        eocr_raw,
            "validated":  eocr_valid,
            "confidence": round(eocr_conf, 4),
            "elapsed_ms": round(t_eocr_ms, 1),
        },
        "split_combined": {
            "raw":        split_raw,
            "validated":  split_valid,
            "confidence": round(split_conf, 4),
            "elapsed_ms": round(t_split_ms, 1),
        },
        "early_exit": False,
        "stages_executed": stages_executed,
        "selected": winner_method,
        "total_ms": round(elapsed_ms, 1),
        "gate_threshold": gate_threshold
    }

    log.info(
        f"[hybrid_ocr] FALLBACK COMPLETE: "
        f"FPOCR='{fpocr_valid}'({fpocr_conf:.2f}) "
        f"EOCR='{eocr_valid}'({eocr_conf:.2f}) "
        f"→ '{winner_text}' via {winner_method} "
        f"[{elapsed_ms:.0f} ms]"
    )

    return HybridOCRResult(
        text=winner_text,
        confidence=winner_conf,
        method=winner_method,
        elapsed_ms=elapsed_ms,
        debug=debug,
    )
