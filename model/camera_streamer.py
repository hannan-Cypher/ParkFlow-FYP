"""
camera_streamer.py — IP Camera ANPR Processor

Pulls RTSP stream using OpenCV's native C++ backend (Crash-proof).
Directly imports the AI Models and OCR logic from app.py.
"""

import cv2
import time
import threading
import numpy as np
import requests
import logging
import os
os.environ['KMP_DUPLICATE_LIB_OK'] = 'True'
from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from requests.auth import HTTPDigestAuth

# ============================================================================
# THE MAGIC BRIDGE: Point directly to app.py
# ============================================================================
from app import model, process_single_plate 

# Load env from project root — try .env.local (dev) then .env.prod (VPS)
_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(_root, '.env.local'))   # dev machine
load_dotenv(os.path.join(_root, '.env.prod'))    # VPS production

# ============================================================================
# LOGGING & CONFIG
# ============================================================================
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
log = logging.getLogger(__name__)

CAM_IP   = os.environ.get('CAM_IP',   '192.168.137.50')
CAM_USER = os.environ.get('CAM_USER', 'admin')
CAM_PASS = os.environ.get('CAM_PASS', 'Admin123')

RTSP_URL = f'rtsp://{CAM_USER}:{CAM_PASS}@{CAM_IP}:554/Streaming/Channels/101'
SNAPSHOT_URL = f'http://{CAM_IP}/ISAPI/Streaming/channels/101/picture'

CLOUD_URL = os.environ.get('CLOUD_URL', 'http://213.136.67.148:3000')
ANPR_WEBHOOK_SECRET = os.environ.get('ANPR_WEBHOOK_SECRET', 'parkflow-anpr-secret-2024')

log.info(f"CONFIG  CAM_IP={CAM_IP}")
log.info(f"CONFIG  CLOUD_URL={CLOUD_URL}")
log.info(f"CONFIG  ANPR_SECRET={'set' if ANPR_WEBHOOK_SECRET else 'NOT SET'}")

TRIGGER_COOLDOWN = 2

# ============================================================================
# FLASK INITIALIZATION
# ============================================================================
app_streamer = Flask(__name__)
CORS(app_streamer)

# ============================================================================
# SHARED STATE & CACHE
# ============================================================================
_venue_lock = threading.Lock()
_active_venue_id = None
_active_venue_name = None
_active_gate_id = None

_latest_raw_lock  = threading.Lock()
_latest_raw_frame = None
_latest_annotated_lock = threading.Lock()
_latest_annotated_frame = None
_latest_detection_lock = threading.Lock()
_latest_detection = None   

_plate_history = {} 
_history_lock = threading.Lock()
_sent_plates_cache = {}  
PLATE_COOLDOWN_SECONDS = 60

# ============================================================================
# CAMERA CAPTURE THREAD (OpenCV C++ Backend - 100% Crash Proof)
# ============================================================================
def start_camera_capture():
    global _latest_raw_frame
    
    # Force OpenCV to use TCP to prevent smearing and corruption
    os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
    
    while True:
        log.info(f"OpenCV connecting to {CAM_IP} via TCP...")
        cap = cv2.VideoCapture(RTSP_URL, cv2.CAP_FFMPEG)
        
        # Tiny buffer: Forces OpenCV to drop old frames if Python is busy!
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)

        if not cap.isOpened():
            log.error("Camera failed to open. Retrying in 5 seconds...")
            time.sleep(5)
            continue

        log.info("OpenCV connected. Streaming frames...")
        while True:
            ret, frame = cap.read()
            
            if not ret:
                log.warning("Stream dropped by camera. Reconnecting...")
                break
            
            with _latest_raw_lock:
                _latest_raw_frame = frame
                
        cap.release()
        time.sleep(2)

# ============================================================================
# YOLO WORKER THREAD
# ============================================================================
_last_trigger_time = 0

def yolo_worker():
    global _latest_detection, _last_trigger_time, _latest_annotated_frame, _sent_plates_cache

    while True:
        try:
            with _latest_raw_lock:
                raw_frame = _latest_raw_frame

            if raw_frame is None:
                time.sleep(0.05)
                continue

            time.sleep(0.2) 
            
            frame = raw_frame.copy()
            max_size = 1296
            h, w = frame.shape[:2]
            if max(h,w) > max_size:
                scale = max_size / max(h, w)
                frame = cv2.resize(frame, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

            results = model(frame, conf=0.5, verbose=False, imgsz=1280)

            annotated = results[0].plot()
            with _latest_annotated_lock:
                _latest_annotated_frame = annotated

            if len(results[0].boxes) == 0:
                continue

            now = time.time()
            if now - _last_trigger_time < TRIGGER_COOLDOWN:
                continue

            _last_trigger_time = now

            for box in results[0].boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                plate_crop = frame[y1:y2, x1:x2]

                if plate_crop.size == 0:
                    continue

                # ── CALL APP.PY EXACT OCR LOGIC ──
                validated, ocr_confidence, ocr_method = process_single_plate(plate_crop)

                if not validated or validated == "UNREADABLE":
                    continue

                # ── COOLDOWN CACHE LOGIC ──
                with _history_lock:
                    current_time = time.time()
                    
                    stale_plates = [p for p, t in _sent_plates_cache.items() if current_time - t > PLATE_COOLDOWN_SECONDS]
                    for p in stale_plates:
                        del _sent_plates_cache[p]

                    if validated in _sent_plates_cache:
                        continue 

                    _plate_history[validated] = _plate_history.get(validated, 0) + 1
                    current_count = _plate_history[validated]

                log.info(f">>> OCR: {validated} (Seen {current_count}x)")

                if current_count == 3:
                    log.info(f"✨ STABLE PLATE CONFIRMED: {validated}")
                    
                    with _history_lock:
                        _sent_plates_cache[validated] = time.time()
                    
                    with _latest_detection_lock:
                        _latest_detection = {
                            'text': validated,
                            'confidence': ocr_confidence,
                            'method': ocr_method,
                            'detected_at': time.time(),
                        }

                    if ocr_confidence >= 0.40:
                        with _venue_lock:
                            vid = _active_venue_id
                            gid = _active_gate_id
                        try:
                            resp = requests.post(
                                f"{CLOUD_URL}/api/recognize",
                                json={
                                    'plate': validated,
                                    'confidence': round(ocr_confidence, 4),
                                    'method': ocr_method,
                                    'secret': ANPR_WEBHOOK_SECRET,
                                    'venue_id': vid,
                                    'gate_id': gid,
                                },
                                timeout=5,
                            )
                            if resp.status_code == 201:
                                log.info(f"☁️  Plate '{validated}' sent to cloud.")
                            else:
                                log.warning(f"☁️  Cloud POST returned {resp.status_code}: {resp.text[:200]}")
                        except Exception as cloud_err:
                            log.warning(f"☁️  Cloud POST failed: {cloud_err}")

        except Exception as e:
            log.error(f"🚨 YOLO Thread Error Caught: {e}")
            time.sleep(1)

# ============================================================================
# MJPEG GENERATOR & FLASK ROUTES
# ============================================================================
def generate_frames():
    log.info("MJPEG stream client connected.")
    while True:
        with _latest_annotated_lock:
            frame = _latest_annotated_frame

        if frame is None:
            time.sleep(0.05)
            continue

        h, w = frame.shape[:2]
        scale = 1280 / w if w > 1280 else 1.0
        if scale < 1.0:
            display = cv2.resize(frame, (int(w * scale), int(h * scale)))
        else:
            display = frame

        ret, buffer = cv2.imencode('.jpg', display, [cv2.IMWRITE_JPEG_QUALITY, 75])
        if not ret:
            continue

        yield (b'--frame\r\n' b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
        time.sleep(0.06)

@app_streamer.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app_streamer.route('/venue', methods=['GET', 'POST'])
def venue_endpoint():
    global _active_venue_id, _active_venue_name, _active_gate_id
    if request.method == 'POST':
        data = request.json or {}
        with _venue_lock:
            _active_venue_id = data.get('venue_id')
            _active_venue_name = data.get('venue_name', '')
            _active_gate_id = data.get('gate_id')
        with _latest_detection_lock:
            global _latest_detection
            _latest_detection = None
        return jsonify({'success': True, 'venue_id': _active_venue_id, 'gate_id': _active_gate_id})
    with _venue_lock:
        return jsonify({'venue_id': _active_venue_id, 'venue_name': _active_venue_name, 'gate_id': _active_gate_id})

@app_streamer.route('/latest_detection')
def latest_detection():
    with _latest_detection_lock:
        det = _latest_detection
    if det:
        return jsonify({
            'success': True, 'plate': det['text'], 'confidence': round(det['confidence'], 4), 'method': det['method']
        })
    return jsonify({'success': False, 'plate': None})

@app_streamer.route('/health')
def health():
    with _venue_lock:
        vid = _active_venue_id
        gid = _active_gate_id
    return jsonify({
        'status': 'ok',
        'cloud_url': CLOUD_URL,
        'cam_ip': CAM_IP,
        'active_venue_id': vid,
        'active_gate_id': gid,
    })

# ============================================================================
# ENTRY POINT
# ============================================================================
if __name__ == '__main__':
    capture_thread = threading.Thread(target=start_camera_capture, daemon=True)
    capture_thread.start()

    log.info("Waiting for OpenCV to connect...")
    time.sleep(4)

    yolo_thread = threading.Thread(target=yolo_worker, daemon=True)
    yolo_thread.start()

    port = int(os.environ.get('STREAMER_PORT', 8081))
    log.info(f"Starting Flask MJPEG server on port {port}...")
    app_streamer.run(host='0.0.0.0', port=port, debug=False, threaded=True)