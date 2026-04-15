import cv2
import time
import threading
import numpy as np
import requests
import logging
import os
import subprocess

from flask import Flask, Response, jsonify
from ultralytics import YOLO
from hybrid_ocr import hybrid_ocr
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
CLOUD_URL = os.environ.get('CLOUD_URL', 'https://parkflow.up.railway.app')
ANPR_WEBHOOK_SECRET = os.environ.get('ANPR_WEBHOOK_SECRET', 'change-me-in-production')

MODEL_PATH = os.environ.get(
    'MODEL_PATH',
    os.path.join(os.path.dirname(os.path.abspath(__file__)), 'best.pt')
)

# Camera native resolution (from ffmpeg probe: 2688x1520)
# We will pipe the full resolution because downsampling makes plates blurry for OCR.
FRAME_WIDTH  = 2688
FRAME_HEIGHT = 1520

TRIGGER_COOLDOWN = 5  # seconds between OCR snapshots

# ============================================================================
# FLASK + YOLO
# ============================================================================
app   = Flask(__name__)
model = YOLO(MODEL_PATH)
log.info("YOLO model loaded.")

# ============================================================================
# SHARED STATE
# ============================================================================

# Latest raw frame from FFmpeg (BGR)
_latest_raw_lock  = threading.Lock()
_latest_raw_frame = None

# Latest annotated frame from YOLO (BGR)
_latest_annotated_lock  = threading.Lock()
_latest_annotated_frame = None

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
        '-loglevel', 'warning',          # suppress verbose output
        '-hwaccel', 'videotoolbox',      # MAC hardware acceleration
        '-fflags', 'nobuffer',           # zero-latency flags
        '-flags', 'low_delay',           # zero-latency flags
        '-rtsp_transport', 'udp',        # UDP — works where TCP fails on Sequoia
        '-i', RTSP_URL,
        '-r', '15',                      # output at 15 FPS to drastically reduce pipe bandwidth
        '-f', 'rawvideo',                # pipe raw frames
        '-pix_fmt', 'bgr24',             # OpenCV native format
        '-',                             # output to stdout
    ]

    frame_size = FRAME_WIDTH * FRAME_HEIGHT * 3  # BGR24 bytes per frame

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

        time.sleep(2)  # brief pause before reconnect


# OCR Trigger timestamp
_last_trigger_time = 0


# ============================================================================
# YOLO WORKER THREAD
# Always grabs the latest raw frame — never processes stale frames
# ============================================================================
def yolo_worker():
    global _latest_annotated_frame, _last_trigger_time

    log.info("YOLO worker started. Waiting for first frame...")
    while True:
        with _latest_raw_lock:
            raw = _latest_raw_frame

        if raw is None:
            time.sleep(0.05)
            continue

        # Flip horizontally — camera is mirrored
        frame = raw

        # Increased confidence threshold to 0.75 to filter out random noise
        # that hallucinates false bounding boxes when no plate is present.
        results = model(frame, conf=0.75, verbose=False, imgsz=640)

        if len(results[0].boxes) > 0:
            annotated = results[0].plot()

            # OCR directly from frame crop — no HTTP needed
            now = time.time()
            if now - _last_trigger_time > TRIGGER_COOLDOWN:
                _last_trigger_time = now
                for box in results[0].boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                    plate_crop = frame[y1:y2, x1:x2]
                    if plate_crop.size > 0:
                        def _run_ocr(crop=plate_crop.copy()):
                            ocr_res = hybrid_ocr(crop)
                            log.info(
                                f">>> OCR: {ocr_res.text} "
                                f"(conf={ocr_res.confidence:.2%}, "
                                f"method={ocr_res.method})"
                            )
                            # ── POST to Railway cloud ────────────────
                            if ocr_res.text and ocr_res.confidence >= 0.60:
                                try:
                                    resp = requests.post(
                                        f"{CLOUD_URL}/api/recognize",
                                        json={
                                            'plate':      ocr_res.text,
                                            'confidence': round(ocr_res.confidence, 4),
                                            'method':     ocr_res.method,
                                            'secret':     ANPR_WEBHOOK_SECRET,
                                        },
                                        timeout=5,
                                    )
                                    if resp.status_code == 201:
                                        log.info(f"☁️  Plate '{ocr_res.text}' sent to cloud.")
                                    else:
                                        log.warning(f"☁️  Cloud responded {resp.status_code}: {resp.text[:200]}")
                                except Exception as cloud_err:
                                    log.warning(f"☁️  Cloud POST failed: {cloud_err}")
                        threading.Thread(target=_run_ocr, daemon=True).start()
        else:
            annotated = frame

        with _latest_annotated_lock:
            _latest_annotated_frame = annotated
# ============================================================================
# MJPEG GENERATOR — serves latest annotated frame, never blocks on YOLO
# ============================================================================
def generate_frames():
    log.info("MJPEG stream client connected.")
    while True:
        with _latest_annotated_lock:
            frame = _latest_annotated_frame

        if frame is None:
            time.sleep(0.05)
            continue

        ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
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


@app.route('/trigger_snapshot', methods=['POST'])
def manual_trigger():
    try:
        auth     = HTTPDigestAuth(CAM_USER, CAM_PASS)
        response = requests.get(SNAPSHOT_URL, auth=auth, timeout=5)
        if response.status_code == 200:
            nparr        = np.frombuffer(response.content, np.uint8)
            high_res_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            # Run YOLO to find the plate first
            results = model(high_res_img, conf=0.75, verbose=False, imgsz=640)
            if len(results[0].boxes) > 0:
                box = results[0].boxes[0]
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                plate_crop = high_res_img[y1:y2, x1:x2]
                
                if plate_crop.size > 0:
                    ocr_res = hybrid_ocr(plate_crop)
                    return jsonify({
                        'success':    True,
                        'text':       ocr_res.text,
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
    return jsonify({'status': 'ok', 'camera': CAM_IP, 'stream_active': has_frame})


# ============================================================================
# ENTRY POINT
# ============================================================================
if __name__ == '__main__':
    # 1. Start FFmpeg capture thread
    ffmpeg_thread = threading.Thread(target=start_ffmpeg_capture, daemon=True)
    ffmpeg_thread.start()

    # 2. Give FFmpeg a moment to connect and fill first frame
    log.info("Waiting for FFmpeg to connect...")
    time.sleep(4)

    # 3. Start YOLO worker thread
    yolo_thread = threading.Thread(target=yolo_worker, daemon=True)
    yolo_thread.start()

    # 4. Start Flask
    port = int(os.environ.get('PORT', 8081))
    log.info(f"Starting Flask MJPEG server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)