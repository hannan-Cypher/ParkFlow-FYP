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

app = Flask(__name__)
CORS(app)

# ============================================================================
# CONFIGURATION - paths and settings via environment variables
# ============================================================================
MODEL_PATH = os.environ.get('MODEL_PATH', '/app/model/best.pt')
BASE_FOLDER = os.environ.get('ANPR_STORAGE_PATH', '/app/data/detected_plates')
PLATES_FOLDER = os.path.join(BASE_FOLDER, 'plates')
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
    """
    Two-pass blacklist filter:
    Pass 1 - remove hyphenated combos as whole strings (ICT-ISLAMABAD)
    Pass 2 - remove individual noise words with word boundary matching
    """
    if not raw_text:
        return "UNREADABLE"

    cleaned = raw_text.upper()

    # Pass 1: hyphenated combos
    for combo in HYPHENATED_COMBOS:
        cleaned = cleaned.replace(combo, '')

    # Pass 2: individual words with word boundary
    for word in PAKISTAN_NOISE_WORDS:
        cleaned = re.sub(r'\b' + re.escape(word) + r'\b', '', cleaned)

    # Strip non-alphanumeric
    cleaned = re.sub(r'[^A-Z0-9]', '', cleaned)

    if len(cleaned) < 4:
        return "UNREADABLE"

    # If over 10 chars, try to extract valid Pakistani plate pattern
    if len(cleaned) > 10:
        match = re.search(r'[A-Z]{1,3}[0-9]{4,7}', cleaned)
        if match:
            cleaned = match.group()
        else:
            match = re.search(r'[A-Z]{2,4}[0-9]{2,6}', cleaned)
            if match:
                cleaned = match.group()
            else:
                cleaned = cleaned[:10]

    return cleaned if cleaned else "UNREADABLE"


# ============================================================================
# OCR PREPROCESSING - 11 methods, full plate image, no cropping
# ============================================================================
def preprocess_for_ocr(plate_img):
    """Generate 11 preprocessed versions of the full plate image"""
    height, width = plate_img.shape[:2]

    # 3x upscale
    plate_img = cv2.resize(plate_img, (width * 3, height * 3),
                           interpolation=cv2.INTER_CUBIC)

    gray     = cv2.cvtColor(plate_img, cv2.COLOR_BGR2GRAY)
    denoised = cv2.bilateralFilter(gray, 11, 17, 17)
    thresh1  = cv2.adaptiveThreshold(
        denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
    thresh2  = cv2.adaptiveThreshold(
        denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 15, 2)
    _, otsu     = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    _, otsu_inv = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    clahe    = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    kernel   = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
    sharpened = cv2.filter2D(gray, -1, kernel)
    _, binary_inv = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY_INV)
    equalized     = cv2.equalizeHist(gray)

    return [
        ('original_resized', plate_img),
        ('gray',             gray),
        ('denoised',         denoised),
        ('thresh1',          thresh1),
        ('thresh2',          thresh2),
        ('otsu',             otsu),
        ('otsu_inv',         otsu_inv),
        ('enhanced',         enhanced),
        ('sharpened',        sharpened),
        ('binary_inv',       binary_inv),
        ('equalized',        equalized),
    ]


def extract_text_from_plate(plate_img):
    """
    Run OCR on full plate image using 11 preprocessing methods.
    Pick best confidence result then clean through blacklist filter.
    """
    try:
        versions = preprocess_for_ocr(plate_img)
        best_text       = ""
        best_confidence = 0
        best_version    = "original"

        for version_name, img_version in versions:
            result = reader.readtext(
                img_version,
                detail=1,
                paragraph=False,
                min_size=5,
                contrast_ths=0.1,
                adjust_contrast=0.5
            )

            if result:
                all_texts  = []
                total_conf = 0
                for (bbox, text, conf) in result:
                    ct = ''.join(c for c in text if c.isalnum()).upper()
                    if len(ct) >= 1:
                        all_texts.append(ct)
                        total_conf += conf
                combined = ''.join(all_texts)
                avg_conf = total_conf / len(result) if result else 0

                if avg_conf > best_confidence and len(combined) >= 3:
                    best_text       = combined
                    best_confidence = avg_conf
                    best_version    = version_name

        final_text = clean_plate_text(best_text) if best_text else "UNREADABLE"
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

        results = model(frame, conf=0.5, verbose=False)

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

            ocr_result     = extract_text_from_plate(plate_img)
            plate_text     = ocr_result['text']
            ocr_confidence = ocr_result['confidence']
            ocr_method     = ocr_result['method']

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
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)
