"""
run_test_plates.py  — Automated OCR validation on the 4 sample plate images.

Saves the 4 provided car photos to test_plates/, runs YOLO + OCR on each,
and asserts 100% accuracy before printing PASS.

Usage:
    cd model/
    source venv311/bin/activate
    python3 run_test_plates.py
"""
from __future__ import annotations
import sys, os, time, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import cv2
import numpy as np
from ultralytics import YOLO

# ─── ground truth ─────────────────────────────────────────────────────────────
GROUND_TRUTH = {
    "aay035.jpg":  "AAY-035",
    "agt427.jpg":  "AGT-427",
    "ri423.jpg":   "RI-423",
    "bgw355.jpg":  "BGW-355",
}

MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "best.pt")
TEST_DIR   = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_plates")
os.makedirs(TEST_DIR, exist_ok=True)

# ─── lazy imports (need venv311) ──────────────────────────────────────────────
from hybrid_ocr import hybrid_ocr, get_easyocr_reader
from ocr_postprocess import full_postprocess

# ─── helpers ──────────────────────────────────────────────────────────────────

def largest_plate_crop(img_bgr: np.ndarray, yolo: YOLO, conf: float = 0.25):
    """Return the largest detected plate crop, or the full image if none found."""
    results = yolo.predict(img_bgr, conf=conf, verbose=False)
    best_crop = None
    best_area = 0
    h, w = img_bgr.shape[:2]
    for r in results:
        for box in r.boxes.xyxy.cpu().numpy():
            x1,y1,x2,y2 = map(int, box)
            x1,y1 = max(0,x1), max(0,y1)
            x2,y2 = min(w,x2), min(h,y2)
            area = (x2-x1)*(y2-y1)
            if area > best_area:
                best_area = area
                best_crop = img_bgr[y1:y2, x1:x2]
    return best_crop if best_crop is not None else img_bgr


def ocr_plate(crop: np.ndarray) -> tuple[str, float, str]:
    """Returns (text, conf, method)."""
    reader = get_easyocr_reader()
    result = hybrid_ocr(crop, reader)
    return result.text, result.confidence, result.method


# ─── main ─────────────────────────────────────────────────────────────────────

def main():
    print("\n" + "="*65)
    print("PLATE OCR ACCURACY TEST")
    print("="*65)

    # Check all test images exist
    missing = [f for f in GROUND_TRUTH if not os.path.exists(os.path.join(TEST_DIR, f))]
    if missing:
        print(f"\n⚠  Missing images in {TEST_DIR}/:")
        for f in missing:
            print(f"   {f}")
        print("\nPlease save the 4 plate car photos as:")
        for f in GROUND_TRUTH:
            print(f"   {TEST_DIR}/{f}")
        sys.exit(1)

    yolo = YOLO(MODEL_PATH)
    reader = get_easyocr_reader()

    results = {}
    all_pass = True

    for filename, expected in GROUND_TRUTH.items():
        path = os.path.join(TEST_DIR, filename)
        img  = cv2.imread(path)
        if img is None:
            print(f"\n❌  Cannot open {path}")
            all_pass = False
            continue

        t0   = time.perf_counter()
        crop = largest_plate_crop(img, yolo)
        text, conf, method = ocr_plate(crop)
        ms   = (time.perf_counter() - t0) * 1000

        ok = (text == expected)
        if not ok:
            all_pass = False
        status = "✅ PASS" if ok else "❌ FAIL"
        print(f"\n  {status}  {filename}")
        print(f"         expected : {expected!r}")
        print(f"         got      : {text!r}  (conf={conf:.2%}, method={method}, {ms:.0f}ms)")
        results[filename] = (expected, text, ok)

    print("\n" + "="*65)
    if all_pass:
        print("✅  ALL 4 PLATES PASSED — 100% accuracy!")
    else:
        fails = [f for f,(e,g,ok) in results.items() if not ok]
        print(f"❌  {len(fails)}/4 FAILED: {', '.join(fails)}")
    print("="*65 + "\n")
    sys.exit(0 if all_pass else 1)


if __name__ == "__main__":
    main()
