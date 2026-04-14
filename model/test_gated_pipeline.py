import sys
import os
import time
import cv2
import numpy as np
import logging

# Ensure model directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from hybrid_ocr import hybrid_ocr, HybridOCRResult, get_fpocr_model

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("test_gated")

def create_dummy_plate(text="ABC1234"):
    """Creates a blank plate-sized image with text."""
    img = np.zeros((100, 300, 3), dtype=np.uint8)
    cv2.putText(img, text, (50, 60), cv2.FONT_HERSHEY_SIMPLEX, 2, (255, 255, 255), 3)
    return img

def create_empty_plate():
    """Creates a black image (effectively empty text)."""
    return np.zeros((100, 300, 3), dtype=np.uint8)

def run_tests():
    print("\n" + "="*50)
    print("RUNNING GATED PIPELINE VERIFICATION SUITE")
    print("="*50)
    
    plate_img = create_dummy_plate("LZB9431")
    empty_img = create_empty_plate()
    
    # CASE 1: Early exit fires when fpocr conf >= 0.70 AND valid plate
    print("\n[CASE 1] Testing Early Exit (Conf >= 0.70 + Valid Plate)...")
    os.environ['FPOCR_GATE_THRESHOLD'] = '0.70'
    res1 = hybrid_ocr(plate_img)
    print(f"Result: {res1.text} | Early Exit: {res1.debug.get('early_exit')} | Time: {res1.elapsed_ms:.1f}ms")
    assert res1.debug.get('early_exit') is True, "Case 1 Failed: Should have early exited"
    assert "easyocr" not in res1.debug['stages_executed'], "Case 1 Failed: EasyOCR should not have run"

    # CASE 2: Early exit blocked when text is empty despite high confidence
    # (Using empty image to force empty/unreadable text)
    print("\n[CASE 2] Testing Early Exit Blocked (Empty Text)...")
    res2 = hybrid_ocr(empty_img)
    print(f"Result: {res2.text} | Early Exit: {res2.debug.get('early_exit')}")
    assert res2.debug.get('early_exit') is False, "Case 2 Failed: Should NOT have early exited on empty text"

    # CASE 3: Early exit blocked when confidence < threshold
    print("\n[CASE 3] Testing Early Exit Blocked (Low Confidence threshold=1.0)...")
    os.environ['FPOCR_GATE_THRESHOLD'] = '1.0' # Force fallback
    res3 = hybrid_ocr(plate_img)
    print(f"Result: {res3.text} | Conf: {res3.confidence:.2f} | Early Exit: {res3.debug.get('early_exit')}")
    assert res3.debug.get('early_exit') is False, "Case 3 Failed: Should NOT have early exited (threshold 1.0)"

    # CASE 4: Gate threshold respects FPOCR_GATE_THRESHOLD env var
    print("\n[CASE 4] Testing Env Var Threshold Respect...")
    os.environ['FPOCR_GATE_THRESHOLD'] = '0.1' # Very low, should exit
    res4 = hybrid_ocr(plate_img)
    print(f"Used Threshold: {res4.debug.get('gate_threshold')} | Early Exit: {res4.debug.get('early_exit')}")
    assert res4.debug.get('gate_threshold') == 0.1, "Case 4 Failed: Env var threshold not respected"
    assert res4.debug.get('early_exit') is True, "Case 4 Failed: Should have early exited with low threshold"

    # CASE 5: debug dict contains early_exit, stages_executed, total_ms keys
    print("\n[CASE 5] Testing Debug Dict Fields...")
    for key in ['early_exit', 'stages_executed', 'total_ms']:
        assert key in res1.debug, f"Case 5 Failed: Debug dict missing '{key}'"
    print("Debug fields presence verified.")

    # CASE 6: Performance: early exit path completes under 100ms
    print("\n[CASE 6] Testing Early Exit Performance (< 100ms)...")
    os.environ['FPOCR_GATE_THRESHOLD'] = '0.0'
    t_start = time.perf_counter()
    res6 = hybrid_ocr(plate_img)
    t_end = time.perf_counter()
    elapsed_ms = (t_end - t_start) * 1000
    print(f"Performance: {elapsed_ms:.2f}ms")
    assert elapsed_ms < 100, f"Case 6 Failed: Performance {elapsed_ms:.1f}ms > 100ms"

    print("\n" + "="*50)
    print("ALL 6 GATED PIPELINE TESTS PASSED!")
    print("="*50)

if __name__ == "__main__":
    # Pre-warm model
    get_fpocr_model()
    try:
        run_tests()
    except AssertionError as e:
        print(f"\n!!! TEST SUITE FAILED: {str(e)}")
        sys.exit(1)
    except Exception as e:
        print(f"\n!!! UNEXPECTED ERROR: {str(e)}")
        sys.exit(1)
