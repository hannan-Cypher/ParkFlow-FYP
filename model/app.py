from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from ultralytics import YOLO
import cv2
import base64
import numpy as np
from datetime import datetime
import os
import json
import easyocr
import re
import logging
from hybrid_ocr import hybrid_ocr, get_fpocr_model, HybridOCRResult
from ocr_postprocess import (
    full_postprocess,
    preprocess_for_ocr_enhanced,
    remove_regional_bleeding,
    split_plate_regions,
    validate_pakistani_plate,
)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# ============================================================================
# CONFIGURATION - paths and settings via environment variables
# ============================================================================
MODEL_PATH = os.environ.get('MODEL_PATH', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'best.pt'))
BASE_FOLDER = os.environ.get('ANPR_STORAGE_PATH', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'detected_plates'))
PLATES_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'plates')
FRAMES_FOLDER = os.path.join(BASE_FOLDER, 'full_frames')
LOGS_FILE = os.path.join(BASE_FOLDER, 'detection_log.json')

os.makedirs(PLATES_FOLDER, exist_ok=True)
os.makedirs(FRAMES_FOLDER, exist_ok=True)

# Load YOLO model
print("Loading YOLO model...")
model = YOLO(MODEL_PATH)
print("Model loaded.")

# Initialize EasyOCR (gpu=False for broad hardware compatibility)
print("Loading OCR reader...")
reader = easyocr.Reader(['en'], gpu=False)
print("OCR reader loaded.")

# Pre-warm fast-plate-ocr model (downloads ONNX weights on first run)
print("Pre-warming fast-plate-ocr model...")
_fpocr = get_fpocr_model()
if _fpocr:
    print("fast-plate-ocr model ready.")
else:
    print("fast-plate-ocr unavailable — EasyOCR-only mode.")

# ============================================================================
# PAKISTANI PLATE BLACKLIST
# Two-pass: hyphenated combos first, then individual words
# ============================================================================
HYPHENATED_COMBOS = [
    'ICT-ISLAMABAD', 'ICT-ISBD', 'KPK-PESHAWAR', 'KP-PESHAWAR',
    'PB-LAHORE', 'PUNJAB-LAHORE', 'SD-KARACHI', 'SINDH-KARACHI',
    'BC-QUETTA', 'BALOCHISTAN-QUETTA', 'AJK-MUZAFFARABAD',
    'GB-GILGIT', 'GILGIT-BALTISTAN', 'FATA-PESHAWAR',
]

PAKISTAN_NOISE_WORDS = [
    # Major cities
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
    # Provinces and regions
    'PUNJAB', 'SINDH', 'KPK', 'KP', 'BALOCHISTAN', 'NWFP',
    'AJK', 'GILGIT', 'BALTISTAN', 'GB', 'ICT', 'FATA', 'PATA',
    'FEDERALLY', 'ADMINISTERED', 'TRIBAL', 'AREAS',
    'AZAD', 'JAMMU', 'KASHMIR',
    # Urdu romanizations
    'SINDHI', 'BALOCH', 'PATHAN', 'PUNJABI', 'PASHTUN',
    'PAKHTUN', 'HAZARA', 'SARAIKI', 'BRAHUI', 'BALOCHI',
    # Government / authority text
    'PAKISTAN', 'GOVT', 'GOVERNMENT', 'REGISTERED', 'MOTOR',
    'VEHICLE', 'AUTHORITY', 'EXCISE', 'TAXATION', 'REGISTRATION',
    'TRANSPORT', 'BOARD', 'DEPARTMENT', 'OFFICE', 'OFFICIAL',
    'DIPLOMATIC', 'CONSULATE', 'EMBASSY', 'NATO', 'ISAF', 'UN',
    'FEDERAL', 'PROVINCIAL', 'DISTRICT', 'TEHSIL', 'UNION',
    'COUNCIL', 'COMMITTEE', 'CORPORATION',
    'POLICE', 'ARMY', 'NAVY', 'AIRFORCE', 'PAF', 'PN',
    'RANGERS', 'FC', 'SSP', 'DSP', 'ASP', 'SP',
    # Common OCR noise from plate borders/stamps
    'LTD', 'PVT', 'ORG', 'COM', 'WWW', 'HTTP',
    'REG', 'NUM', 'MOT', 'VEH',
]


def clean_plate_text(raw_text):
    if not raw_text:
        return "UNREADABLE"

    cleaned = raw_text.upper()

    # Remove noise words
    for combo in HYPHENATED_COMBOS:
        cleaned = cleaned.replace(combo, '')
    for word in PAKISTAN_NOISE_WORDS:
        cleaned = re.sub(r'\b' + re.escape(word) + r'\b', '', cleaned)

    # Keep only alphanumeric — dots, dashes, spaces removed here
    cleaned = re.sub(r'[^A-Z0-9]', '', cleaned)

    # Strip dot-separator misreads: · is often read as I or IB between city code and digits
    # We REMOVE them (not convert to 18 — there is no year in the plate number)
    cleaned = re.sub(r'([A-Z]{2,3})[IB]{1,2}([0-9])', r'\1\2', cleaned)

    # Too short to be a real plate
    if len(cleaned) < 3:
        return "UNREADABLE"

    return cleaned if cleaned else "UNREADABLE"
# ============================================================================
# OCR PREPROCESSING - sequential pipeline, single output image
# Pipeline: original_resized → gray → denoised → equalized → enhanced
#           → sharpened → otsu_inv  (then OCR once on the final image)
# ============================================================================
def preprocess_for_ocr(plate_img):
    """
    Apply a strictly sequential preprocessing chain and return a single
    fully-processed image ready for EasyOCR.

    Steps
    -----
    1. original_resized : 3× upscale (BGR)
    2. gray             : convert to single-channel (required for all later steps)
    3. denoised         : bilateral filter on clean grayscale
    4. equalized        : global histogram equalisation on denoised image
    5. enhanced         : CLAHE on equalized image (localised contrast boost)
    6. sharpened        : unsharp-mask kernel on CLAHE output
    7. otsu_inv         : Otsu binarisation (inverted) – white text on black,
                          best for EasyOCR
    """
    height, width = plate_img.shape[:2]

    # ── Step 1: upscale ──────────────────────────────────────────────────────
    original_resized = cv2.resize(
        plate_img, (width * 3, height * 3), interpolation=cv2.INTER_CUBIC
    )

    # ── Step 2: grayscale (single channel required for everything below) ─────
    gray = cv2.cvtColor(original_resized, cv2.COLOR_BGR2GRAY)

    # ── Step 3: denoise BEFORE contrast work ─────────────────────────────────
    denoised = cv2.bilateralFilter(gray, 11, 17, 17)

    # ── Step 4: global histogram equalisation on clean grayscale ─────────────
    equalized = cv2.equalizeHist(denoised)

    # ── Step 5: CLAHE on equalized image (localised contrast boost) ──────────
    clahe    = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(equalized)

    # ── Step 6: sharpen the contrast-enhanced image ───────────────────────────
    kernel    = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
    sharpened = cv2.filter2D(enhanced, -1, kernel)

    # ── Step 7: Otsu binarisation (inverted) – final output for OCR ──────────
    _, otsu_inv = cv2.threshold(sharpened, 0, 255,
                                cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Return a single (name, image) tuple so callers stay compatible
    return [('otsu_inv', otsu_inv)]


def mask_year_region(plate_img):
    """
    Black out OCR-noise regions on a Pakistani plate crop before any OCR runs.

    Masks TWO regions:
      1. Top-right corner  (top 60% height × rightmost 28% width)
         → covers the 2-digit registration year badge (e.g. '16' for 2016)
      2. Bottom strip      (bottom 22% height, full width)
         → covers the city/province name line (e.g. 'ICT-ISLAMABAD', 'PUNJAB')
           that appears on the lower border of all Pakistani plates

    Both regions are zeroed to black so EasyOCR skips them entirely.
    """
    masked = plate_img.copy()
    h, w = masked.shape[:2]
    # Region 1 — top-right year badge
    masked[0:int(h * 0.60), int(w * 0.72):w] = 0
    # Region 2 — bottom city/province name strip (keep conservative: only bottom 15%)
    masked[int(h * 0.85):h, 0:w] = 0
    return masked


def is_in_city_box(bbox, img_w: int, img_h: int) -> bool:
    """
    Spatial filter: return True if a detected text bbox sits in the bottom
    city-name strip (bottom 15% of plate height, any x position).
    """
    ys = [pt[1] for pt in bbox]
    cy = sum(ys) / 4
    return cy > img_h * 0.85


def is_in_year_box(bbox, img_w, img_h):
    """
    Layer 2 defence: spatial bbox filter applied DURING OCR result parsing.
    Returns True if a detected text bbox sits in the top-right year region,
    so it can be discarded before concatenating the text.

    Thresholds are deliberately tight (80% width, 45% height) to avoid
    accidentally discarding legitimate plate text like the '14' in 'LED·149'
    which sits near but NOT in the year-box corner.

    bbox is a list of 4 corner points: [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]
    """
    xs = [pt[0] for pt in bbox]
    ys = [pt[1] for pt in bbox]
    cx = sum(xs) / 4   # centre-x of the bbox
    cy = sum(ys) / 4   # centre-y of the bbox
    # Top 45 % height AND rightmost 20 % width  →  only the actual year box
    return cy < img_h * 0.45 and cx > img_w * 0.80


def extract_text_from_plate(plate_img):
    """
    Legacy EasyOCR-only fallback used when hybrid_ocr() raises an exception.

    Uses the 3-zone split (Problem 2 fix) and full_postprocess (Problems 1, 3, 4)
    so the fallback path also benefits from all bug fixes.

    Parameters
    ----------
    plate_img : BGR numpy array of the plate crop from YOLO.

    Returns
    -------
    dict with keys: text, confidence, method.
    """
    try:
        h, w = plate_img.shape[:2]

        # Mask top-right year region before any OCR (Layer 1 defence)
        plate_img = mask_year_region(plate_img)

        aspect_ratio = w / h if h > 0 else 99
        use_split    = aspect_ratio < 2.5

        best_text       = ""
        best_confidence = 0.0
        best_version    = "original"

        # ── Strategy A: 3-zone split for multi-line plates ──────────────────────
        if use_split:
            regions = split_plate_regions(plate_img)

            # Letters zone (middle): expect registration letters like 'RI'
            letters_img = preprocess_for_ocr_enhanced(regions.letters)
            lh, lw = letters_img.shape[:2]
            letters_result = reader.readtext(
                letters_img, detail=1, paragraph=False, min_size=3,
                contrast_ths=0.1, adjust_contrast=0.5,
            )
            letters_tokens, letters_confs = [], []
            for (bbox, text, conf) in letters_result:
                if is_in_year_box(bbox, lw, lh):
                    continue
                ct = ''.join(c for c in text if c.isalnum()).upper()
                if ct:
                    letters_tokens.append(ct)
                    letters_confs.append(conf)
            raw_letters = remove_regional_bleeding(''.join(letters_tokens))

            # Numbers zone (bottom): expect registration digits like '423'
            numbers_img = preprocess_for_ocr_enhanced(regions.numbers)
            numbers_result = reader.readtext(
                numbers_img, detail=1, paragraph=False, min_size=3,
                contrast_ths=0.1, adjust_contrast=0.5,
            )
            raw_numbers = ''.join(
                ''.join(c for c in t if c.isdigit())
                for (_, t, _) in numbers_result
            )

            if raw_letters and raw_numbers:
                clean_letters = re.sub(r'[^A-Z]', '', raw_letters.upper())
                clean_numbers = re.sub(r'[^0-9]', '', raw_numbers)
                if clean_letters and clean_numbers:
                    zone_combined = clean_letters + clean_numbers
                    zone_conf = (
                        (sum(letters_confs) / len(letters_confs) if letters_confs else 0)
                        + 0.6   # numbers from bottom zone get base confidence
                    ) / 2
                    if len(zone_combined) > len(best_text):
                        best_text       = zone_combined
                        best_confidence = zone_conf
                        best_version    = "3zone_split"

        # ── Strategy B: full plate OCR (always tried as baseline) ─────────────
        full_img = preprocess_for_ocr_enhanced(plate_img)
        fh, fw = full_img.shape[:2]
        full_result = reader.readtext(
            full_img, detail=1, paragraph=False, min_size=5,
            contrast_ths=0.1, adjust_contrast=0.5,
        )
        all_tokens, all_confs = [], []
        for (bbox, text, conf) in full_result:
            if is_in_year_box(bbox, fw, fh):
                print(f"   [year-box skip] '{text}'")
                continue
            if is_in_city_box(bbox, fw, fh):
                print(f"   [city-strip skip] '{text}'")
                continue
            ct = ''.join(c for c in text if c.isalnum()).upper()
            if ct:
                all_tokens.append(ct)
                all_confs.append(conf)


        if all_tokens:
            combined  = ''.join(all_tokens)
            avg_conf  = sum(all_confs) / len(all_confs)
            has_l = any(c.isalpha() for c in combined)
            has_d = any(c.isdigit() for c in combined)
            score = avg_conf * (1.4 if has_l and has_d else 1.0)
            if score > best_confidence and len(combined) >= 2:
                best_text       = combined
                best_confidence = score
                best_version    = "full_plate"

        # ── Post-process winning raw text through unified pipeline ───────────
        final_text = full_postprocess(best_text) if best_text else "UNREADABLE"
        print(f"   Raw OCR : '{best_text}'")
        print(f"   Cleaned : '{final_text}' | method: {best_version} | conf: {best_confidence:.2%}")

        return {
            'text':       final_text,
            'confidence': best_confidence,
            'method':     best_version
        }
    except Exception as e:
        print(f"OCR Error: {str(e)}")
        return {'text': "ERROR", 'confidence': 0.0, 'method': 'none'}

# Years on Pakistani plates: 2-digit suffix, currently 00–26.
# Strip any 2-digit year between the city code and the registration number.
# e.g.  LEH163236  →  LEH3236  |  LED161234 → LED1234
_YEAR_RE = re.compile(
    r'^([A-Z]{2,4})'        # group 1 : city code  (2–4 letters)
    r'(0\d|1\d|2[0-6])'    # group 2 : 2-digit year  00–26
    r'(\d{1,5})$'           # group 3 : registration  1–5 digits
)


def validate_pakistan_plate(text):
    """
    Pakistani plate format: 2–4 uppercase letters (city code) + dash + 1–5 digits.
    Examples: MNA-877, LHR-1234, LEH-3236, LED-149, ISB-5

    Layer 3 defence: strip the 2-digit registration year that sits between
    the city code and the registration number if it slipped through masking.
    """
    if not text or text == "UNREADABLE":
        return text

    # Keep only letters and digits
    text = re.sub(r'[^A-Z0-9]', '', text.upper())

    # Remove dot-separator misreads (· → I or IB)
    text = re.sub(r'([A-Z]{2,4})[IB]{1,2}([0-9])', r'\1\2', text)

    # ── Layer 3: strip embedded registration year ─────────────────────────────
    # Pattern: CITY + YY + REG  →  CITY + REG
    m = _YEAR_RE.match(text)
    if m:
        text = m.group(1) + m.group(3)
        print(f"   [year-strip] removed '{m.group(2)}' → '{text}'")

    # ── Final structural match: 2–4 letters + 1–5 digits ────────────────────
    match = re.match(r'^([A-Z]{2,4})([0-9]{1,5})$', text)
    if match:
        return f"{match.group(1)}-{match.group(2)}"

    # Looser fallback (handles extra noise chars at edges from OCR)
    match = re.search(r'([A-Z]{2,4})([0-9]{1,5})', text)
    if match:
        return f"{match.group(1)}-{match.group(2)}"

    return "UNREADABLE"

# ============================================================================
# STATE
# ============================================================================
plate_counter = 0
detection_log = []

if os.path.exists(LOGS_FILE):
    try:
        with open(LOGS_FILE, 'r') as f:
            detection_log = json.load(f)
        if detection_log:
            plate_counter = max([d.get('plate_id', 0) for d in detection_log])
    except Exception:
        detection_log = []


# ============================================================================
# ROUTES
# ============================================================================
@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'model_loaded': True})


@app.route('/detect', methods=['POST'])
def detect():
    global plate_counter, detection_log
    try:
        data       = request.json
        image_data = data['image']
        user_info  = data.get('user_info', 'Unknown')

        img_data = base64.b64decode(image_data.split(',')[1])
        nparr    = np.frombuffer(img_data, np.uint8)
        frame    = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        max_size = 1280
        h, w = frame.shape[:2]
        if max(h,w) > max_size:
            scale = max_size / max(h, w)
            frame = cv2.resize(frame, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        print(f"Frame size: {frame.shape[1]}x{frame.shape[0]}")

        results = model(frame, conf=0.5, verbose=False, imgsz= 640)

        detected_plates   = []
        session_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        full_frame_filename = None

        if len(results[0].boxes) > 0:
            annotated_frame     = results[0].plot()
            full_frame_filename = f"frame_{session_timestamp}.jpg"
            cv2.imwrite(os.path.join(FRAMES_FOLDER, full_frame_filename), annotated_frame)

        for box in results[0].boxes:
            conf            = box.conf[0].item()
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            plate_img       = frame[y1:y2, x1:x2]

            # ── Hybrid OCR: fast-plate-ocr + EasyOCR with selection logic ──
            try:
                ocr_result: HybridOCRResult = hybrid_ocr(plate_img, reader=reader)
                plate_text     = ocr_result.text
                ocr_confidence = ocr_result.confidence
                ocr_method     = ocr_result.method
                ocr_debug      = ocr_result.debug
                ocr_elapsed_ms = ocr_result.elapsed_ms
            except Exception as _ocr_exc:
                log.error(f"hybrid_ocr failed, falling back to legacy OCR: {_ocr_exc}")
                _fallback      = extract_text_from_plate(plate_img)
                plate_text     = _fallback['text']
                ocr_confidence = _fallback['confidence']
                ocr_method     = _fallback['method'] + '_fallback'
                ocr_debug      = {}
                ocr_elapsed_ms = 0.0

            plate_counter += 1
            plate_filename = f"plate_{plate_counter}_{session_timestamp}_{plate_text}_conf{conf:.0%}.jpg"
            cv2.imwrite(os.path.join(PLATES_FOLDER, plate_filename), plate_img)

            print(f"Saved: {plate_filename}")
            print(f"Detection: {conf:.2%} | User: {user_info}")

            _, buffer    = cv2.imencode('.jpg', plate_img)
            plate_base64 = base64.b64encode(buffer).decode('utf-8')

            detection_log.append({
                'plate_id':             plate_counter,
                'timestamp':            datetime.now().isoformat(),
                'detection_confidence': conf,
                'ocr_text':             plate_text,
                'ocr_confidence':       ocr_confidence,
                'ocr_method':           ocr_method,
                'ocr_elapsed_ms':       round(ocr_elapsed_ms, 1),
                'ocr_debug':            ocr_debug,
                'plate_filename':       plate_filename,
                'full_frame_filename':  full_frame_filename,
                'user_info':            user_info,
                'coordinates':          [x1, y1, x2, y2]
            })

            detected_plates.append({
                'confidence':       f"{conf:.2%}",
                'confidence_value': conf,
                'ocr_text':         plate_text,
                'ocr_confidence':   f"{ocr_confidence:.2%}",
                'image':            f"data:image/jpeg;base64,{plate_base64}",
                'filename':         plate_filename,
                'plate_id':         plate_counter,
                'coords':           [x1, y1, x2, y2]
            })

        with open(LOGS_FILE, 'w') as f:
            json.dump(detection_log, f, indent=2)

        return jsonify({'success': True, 'plates': detected_plates, 'total': len(detected_plates)})

    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/stats')
def stats():
    return jsonify({
        'total_saved':   plate_counter,
        'save_location': BASE_FOLDER,
        'plates_folder': PLATES_FOLDER,
        'frames_folder': FRAMES_FOLDER,
        'detection_log': detection_log[-10:]
    })


@app.route('/gallery')
def gallery():
    plates = []
    for filename in sorted(os.listdir(PLATES_FOLDER)):
        if filename.endswith('.jpg'):
            plates.append({'filename': filename, 'url': f'/plates/{filename}'})
    return jsonify({'plates': plates})


@app.route('/plates/<filename>')
def serve_plate(filename):
    return send_from_directory(PLATES_FOLDER, filename)


@app.route('/frames/<filename>')
def serve_frame(filename):
    return send_from_directory(FRAMES_FOLDER, filename)


# ============================================================================
# START SERVER
# ============================================================================
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    print(f"LICENSE PLATE DETECTOR - Flask AI Service")
    print(f"Model    : {MODEL_PATH}")
    print(f"Storage  : {BASE_FOLDER}")
    print(f"Port     : {port}")
    app.run(host='0.0.0.0', port=8080, debug=False, threaded=True)
