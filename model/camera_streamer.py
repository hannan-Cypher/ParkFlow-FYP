"""
camera_streamer.py — IP Camera ANPR Processor

Pulls RTSP stream from IP camera via FFmpeg, runs YOLO + hybrid OCR
(exact same pipeline as app.py), and POSTs detected plates to the
deployed ParkFlow server.

The MJPEG stream served at /video_feed shows the RAW camera feed
(no YOLO annotations) so staff can see the plain video.
"""

import cv2
import time
import threading
import numpy as np
import requests
import logging
import os
import re
import subprocess

from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from ultralytics import YOLO
from hybrid_ocr import hybrid_ocr, get_fpocr_model, HybridOCRResult, probe_year_region, mask_city_strip_only
from ocr_postprocess import (
    full_postprocess,
    preprocess_for_ocr_enhanced,
    remove_regional_bleeding,
    split_plate_regions,
    validate_pakistani_plate,
)
from requests.auth import HTTPDigestAuth

# ============================================================================
# LOGGING
# ============================================================================
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
log = logging.getLogger(__name__)

# ============================================================================
# CONFIGURATION
# ============================================================================
CAM_IP   = os.environ.get('CAM_IP',   '192.168.18.58')
CAM_USER = os.environ.get('CAM_USER', 'admin')
CAM_PASS = os.environ.get('CAM_PASS', 'Admin123')

RTSP_URL     = f'rtsp://{CAM_USER}:{CAM_PASS}@{CAM_IP}:554/Streaming/Channels/101'
SNAPSHOT_URL = f'http://{CAM_IP}/ISAPI/Streaming/channels/101/picture'

# Cloud webhook — send detected plates to the deployed Railway app
CLOUD_URL = os.environ.get('CLOUD_URL', 'https://parkflow-fyp-production.up.railway.app')
ANPR_WEBHOOK_SECRET = os.environ.get('ANPR_WEBHOOK_SECRET', 'change-me-in-production')

MODEL_PATH = os.environ.get(
    'MODEL_PATH',
    os.path.join(os.path.dirname(os.path.abspath(__file__)), 'best.pt')
)

# Camera native resolution (from ffmpeg probe: 2688x1520)
FRAME_WIDTH  = 2688
FRAME_HEIGHT = 1520

TRIGGER_COOLDOWN = 5  # seconds between OCR snapshots

# ============================================================================
# FLASK + YOLO
# ============================================================================
app = Flask(__name__)
CORS(app)

log.info("Loading YOLO model...")
model = YOLO(MODEL_PATH)
log.info("YOLO model loaded.")

# Pre-warm fast-plate-ocr model (same as app.py)
log.info("Pre-warming fast-plate-ocr model...")
_fpocr = get_fpocr_model()
if _fpocr:
    log.info("fast-plate-ocr model ready.")
else:
    log.info("fast-plate-ocr unavailable — EasyOCR-only mode.")

# Lazy EasyOCR reader (same as app.py)
reader = None

# ============================================================================
# VENUE STATE — set by /ipLocation page
# ============================================================================
_venue_lock = threading.Lock()
_active_venue_id = None
_active_venue_name = None

# ============================================================================
# SHARED STATE
# ============================================================================

# Latest raw frame from FFmpeg (BGR)
_latest_raw_lock  = threading.Lock()
_latest_raw_frame = None

# Latest detected plate (for display on stream/dashboard)
_latest_detection_lock = threading.Lock()
_latest_detection = None   # { text, confidence, method, detected_at }

# ============================================================================
# PAKISTANI PLATE VALIDATION — copied exactly from app.py
# ============================================================================
_YEAR_RE = re.compile(
    r'^([A-Z]{2,4})'        # group 1 : city code  (2–4 letters)
    r'(0\d|1\d|2[0-6])'    # group 2 : 2-digit year  00–26
    r'(\d{1,5})$'           # group 3 : registration  1–5 digits
)


def validate_pakistan_plate(text):
    """
    Pakistani plate format: 2–4 uppercase letters (city code) + dash + 1–5 digits.
    Copied exactly from app.py.
    """
    if not text or text == "UNREADABLE":
        return text

    text = re.sub(r'[^A-Z0-9]', '', text.upper())
    text = re.sub(r'([A-Z]{2,4})[IB]{1,2}([0-9])', r'\\1\\2', text)

    m = _YEAR_RE.match(text)
    if m:
        text = m.group(1) + m.group(3)
        log.info(f"   [year-strip] removed '{m.group(2)}' → '{text}'")

    match = re.match(r'^([A-Z]{2,4})([0-9]{1,5})$', text)
    if match:
        return f"{match.group(1)}-{match.group(2)}"

    match = re.search(r'([A-Z]{2,4})([0-9]{1,5})', text)
    if match:
        return f"{match.group(1)}-{match.group(2)}"

    return "UNREADABLE"


# ============================================================================
# FFMPEG CAPTURE THREAD
# Pulls RTSP via UDP, decodes H.265, pipes raw BGR frames to Python
# ============================================================================
def start_ffmpeg_capture():
    """
    FFmpeg pulls the RTSP stream over UDP (bypasses macOS routing issues),
    decodes H.265 natively, and pipes raw BGR24 frames into Python.
    No re-encoding. No intermediate format. Lowest possible latency.
    """
    global _latest_raw_frame

    cmd = [
        'ffmpeg',
        '-loglevel', 'warning',
        '-hwaccel', 'videotoolbox',
        '-fflags', 'nobuffer',
        '-flags', 'low_delay',
        '-rtsp_transport', 'udp',
        '-i', RTSP_URL,
        '-r', '15',
        '-f', 'rawvideo',
        '-pix_fmt', 'bgr24',
        '-',
    ]

    frame_size = FRAME_WIDTH * FRAME_HEIGHT * 3

    while True:
        log.info(f"FFmpeg connecting to {RTSP_URL} via UDP...")
        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                bufsize=frame_size * 2,
            )

            log.info("FFmpeg connected. Streaming frames...")
            while True:
                raw_bytes = proc.stdout.read(frame_size)

                if len(raw_bytes) != frame_size:
                    log.warning("FFmpeg pipe ended. Restarting...")
                    break

                frame = np.frombuffer(raw_bytes, dtype=np.uint8).reshape(
                    (FRAME_HEIGHT, FRAME_WIDTH, 3)
                )

                with _latest_raw_lock:
                    _latest_raw_frame = frame.copy()

        except Exception as e:
            log.error(f"FFmpeg error: {e}")
        finally:
            try:
                proc.kill()
            except Exception:
                pass

        time.sleep(2)


# OCR Trigger timestamp
_last_trigger_time = 0


# ============================================================================
# YOLO WORKER THREAD — uses exact app.py detection pipeline
# ============================================================================
def yolo_worker():
    global _latest_detection, _last_trigger_time

    log.info("YOLO worker started. Waiting for first frame...")
    while True:
        with _latest_raw_lock:
            raw = _latest_raw_frame

        if raw is None:
            time.sleep(0.05)
            continue

        frame = raw

        # Same confidence threshold as app.py: 0.5
        results = model(frame, conf=0.5, verbose=False, imgsz=640)

        if len(results[0].boxes) == 0:
            time.sleep(0.05)
            continue

        # OCR with cooldown
        now = time.time()
        if now - _last_trigger_time < TRIGGER_COOLDOWN:
            continue

        _last_trigger_time = now

        for box in results[0].boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            plate_img = frame[y1:y2, x1:x2]

            if plate_img.size == 0:
                continue

            def _run_detection(crop=plate_img.copy()):
                global _latest_detection
                # ── Exact app.py detection pipeline ──────────────────
                try:
                    ocr_result: HybridOCRResult = hybrid_ocr(crop, reader=reader)
                    plate_text     = ocr_result.text
                    ocr_confidence = ocr_result.confidence
                    ocr_method     = ocr_result.method
                except Exception as _ocr_exc:
                    log.error(f"hybrid_ocr failed, skipping: {_ocr_exc}")
                    return

                # Validate Pakistani plate format (same as app.py)
                validated = validate_pakistan_plate(plate_text)

                log.info(
                    f">>> OCR: {plate_text} → validated: {validated} "
                    f"(conf={ocr_confidence:.2%}, method={ocr_method})"
                )

                # Skip unreadable
                if not validated or validated == "UNREADABLE":
                    return

                # Store latest detection for dashboard display
                with _latest_detection_lock:
                    _latest_detection = {
                        'text': validated,
                        'confidence': ocr_confidence,
                        'method': ocr_method,
                        'detected_at': time.time(),
                    }

                # ── POST to Railway cloud (same as before + venue_id) ─
                if ocr_confidence >= 0.40:
                    with _venue_lock:
                        vid = _active_venue_id

                    try:
                        resp = requests.post(
                            f"{CLOUD_URL}/api/recognize",
                            json={
                                'plate':      validated,
                                'confidence': round(ocr_confidence, 4),
                                'method':     ocr_method,
                                'secret':     ANPR_WEBHOOK_SECRET,
                                'venue_id':   vid,
                            },
                            timeout=5,
                        )
                        if resp.status_code == 201:
                            log.info(f"☁️  Plate '{validated}' sent to cloud (venue={vid}).")
                        else:
                            log.warning(f"☁️  Cloud responded {resp.status_code}: {resp.text[:200]}")
                    except Exception as cloud_err:
                        log.warning(f"☁️  Cloud POST failed: {cloud_err}")

            threading.Thread(target=_run_detection, daemon=True).start()


# ============================================================================
# MJPEG GENERATOR — serves RAW frame (no YOLO annotations)
# ============================================================================
def generate_frames():
    log.info("MJPEG stream client connected.")
    while True:
        with _latest_raw_lock:
            frame = _latest_raw_frame

        if frame is None:
            time.sleep(0.05)
            continue

        # Downscale for streaming (720p is enough for viewing)
        h, w = frame.shape[:2]
        scale = 1280 / w if w > 1280 else 1.0
        if scale < 1.0:
            display = cv2.resize(frame, (int(w * scale), int(h * scale)))
        else:
            display = frame

        ret, buffer = cv2.imencode('.jpg', display, [cv2.IMWRITE_JPEG_QUALITY, 75])
        if not ret:
            continue

        yield (
            b'--frame\r\n'
            b'Content-Type: image/jpeg\r\n\r\n'
            + buffer.tobytes()
            + b'\r\n'
        )


# ============================================================================
# FLASK ROUTES
# ============================================================================
@app.route('/video_feed')
def video_feed():
    return Response(
        generate_frames(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )


@app.route('/venue', methods=['GET', 'POST'])
def venue_endpoint():
    """
    GET  /venue — returns current active venue
    POST /venue — sets the active venue (called by /ipLocation page)
    """
    global _active_venue_id, _active_venue_name

    if request.method == 'POST':
        data = request.json or {}
        with _venue_lock:
            _active_venue_id = data.get('venue_id')
            _active_venue_name = data.get('venue_name', '')
        
        # Clear latest detection when venue changes to avoid stale data on new location
        with _latest_detection_lock:
            global _latest_detection
            _latest_detection = None
            
        log.info(f"🏢 Venue set: {_active_venue_name} ({_active_venue_id})")
        return jsonify({'success': True, 'venue_id': _active_venue_id, 'venue_name': _active_venue_name})

    # GET
    with _venue_lock:
        return jsonify({
            'venue_id': _active_venue_id,
            'venue_name': _active_venue_name,
        })


@app.route('/latest_detection')
def latest_detection():
    """Returns the most recently detected plate (for dashboard polling)."""
    with _latest_detection_lock:
        det = _latest_detection
    if det:
        return jsonify({
            'success': True,
            'plate': det['text'],
            'confidence': round(det['confidence'], 4),
            'method': det['method'],
        })
    return jsonify({'success': False, 'plate': None})


@app.route('/trigger_snapshot', methods=['POST'])
def manual_trigger():
    try:
        auth     = HTTPDigestAuth(CAM_USER, CAM_PASS)
        response = requests.get(SNAPSHOT_URL, auth=auth, timeout=5)
        if response.status_code == 200:
            nparr        = np.frombuffer(response.content, np.uint8)
            high_res_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            results = model(high_res_img, conf=0.5, verbose=False, imgsz=640)
            if len(results[0].boxes) > 0:
                box = results[0].boxes[0]
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                plate_crop = high_res_img[y1:y2, x1:x2]

                if plate_crop.size > 0:
                    ocr_res = hybrid_ocr(plate_crop, reader=reader)
                    validated = validate_pakistan_plate(ocr_res.text)
                    return jsonify({
                        'success':    True,
                        'text':       validated,
                        'confidence': f"{ocr_res.confidence:.2%}",
                        'method':     ocr_res.method,
                    })

            return jsonify({'success': False, 'error': 'No plate detected by YOLO in snapshot'}), 400
        return jsonify({'success': False, 'error': f'Camera HTTP {response.status_code}'}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/health')
def health():
    with _latest_raw_lock:
        has_frame = _latest_raw_frame is not None
    with _venue_lock:
        vid = _active_venue_id
        vname = _active_venue_name
    return jsonify({
        'status': 'ok',
        'camera': CAM_IP,
        'stream_active': has_frame,
        'venue_id': vid,
        'venue_name': vname,
    })


# ============================================================================
# ENTRY POINT
# ============================================================================
if __name__ == '__main__':
    # 1. Start FFmpeg capture thread
    ffmpeg_thread = threading.Thread(target=start_ffmpeg_capture, daemon=True)
    ffmpeg_thread.start()

    # 2. Give FFmpeg a moment to connect
    log.info("Waiting for FFmpeg to connect...")
    time.sleep(4)

    # 3. Start YOLO worker thread
    yolo_thread = threading.Thread(target=yolo_worker, daemon=True)
    yolo_thread.start()

    # 4. Start Flask
    port = int(os.environ.get('PORT', 8081))
    log.info(f"Starting Flask MJPEG server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)