"""
test_year_probe.py — Test the Pre-OCR Probe on both plate types.

Validates that:
  1. Plate WITH year badge (ri423_crop.jpg)  → probe returns True
  2. Plate WITHOUT year badge (aay035_crop.jpg) → probe returns False
  3. OCR produces correct result for both plate types

Usage:
    cd model/
    source venv311/bin/activate
    python test_year_probe.py
"""
from __future__ import annotations
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import cv2
from hybrid_ocr import (
    probe_year_region,
    get_easyocr_reader,
    hybrid_ocr,
)

TEST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_plates")

# Test cases: (filename, expected_has_year, expected_plate_text)
TEST_CASES = [
    ("ri423_crop.jpg",   True,  "RI-423"),
    ("aay035_crop.jpg",  False, "AAY-035"),
]


def main():
    print("\n" + "=" * 65)
    print("PRE-OCR YEAR PROBE TEST")
    print("=" * 65)

    reader = get_easyocr_reader()
    all_pass = True

    for filename, expected_year, expected_text in TEST_CASES:
        path = os.path.join(TEST_DIR, filename)
        if not os.path.exists(path):
            print(f"\n⚠  Missing: {path}")
            all_pass = False
            continue

        img = cv2.imread(path)
        if img is None:
            print(f"\n❌  Cannot open: {path}")
            all_pass = False
            continue

        print(f"\n{'─' * 50}")
        print(f"  Testing: {filename}")
        print(f"  Expected year badge: {expected_year}")
        print(f"  Expected plate text: {expected_text}")

        # Test probe
        t0 = time.perf_counter()
        has_year = probe_year_region(img, reader)
        probe_ms = (time.perf_counter() - t0) * 1000

        probe_ok = (has_year == expected_year)
        probe_status = "✅" if probe_ok else "❌"
        print(f"  {probe_status} Probe result: has_year={has_year} (expected={expected_year}) [{probe_ms:.0f}ms]")

        if not probe_ok:
            all_pass = False

        # Test full OCR with probe-enabled pipeline
        t1 = time.perf_counter()
        result = hybrid_ocr(img, reader)
        ocr_ms = (time.perf_counter() - t1) * 1000

        ocr_ok = (result.text == expected_text)
        ocr_status = "✅" if ocr_ok else "❌"
        print(f"  {ocr_status} OCR result: '{result.text}' (expected='{expected_text}') [{ocr_ms:.0f}ms]")
        print(f"     method={result.method}, conf={result.confidence:.2%}")

        if not ocr_ok:
            all_pass = False

    print(f"\n{'=' * 65}")
    if all_pass:
        print("✅  ALL TESTS PASSED!")
    else:
        print("❌  SOME TESTS FAILED")
    print("=" * 65 + "\n")
    sys.exit(0 if all_pass else 1)


if __name__ == "__main__":
    main()
