"""
test_hybrid_ocr.py — Comparison test harness for the hybrid OCR pipeline.

Usage
-----
    cd model/
    source venv311/bin/activate
    python test_hybrid_ocr.py [--plates-dir /path/to/test_plates]

Output
------
Prints a Markdown-style comparison table:
    | Image | EasyOCR Result | EasyOCR Conf | FastPlateOCR | FP Conf | Selected | Time(ms) |
Flags any image where both engines disagree significantly (Levenshtein > 2).
Reports average processing time and warns if > 1500 ms.
"""

from __future__ import annotations

import argparse
import os
import sys
import time

import cv2
import numpy as np

# ---------------------------------------------------------------------------
# Ensure the model/ directory is in sys.path
# ---------------------------------------------------------------------------
_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

from hybrid_ocr import (
    HybridOCRResult,
    get_easyocr_reader,
    get_fpocr_model,
    hybrid_ocr,
    post_process_plate,
    run_easyocr,
    run_fast_plate_ocr,
    validate_pakistan_plate,
)


# ── A tiny Levenshtein distance for disagreement detection ───────────────────

def levenshtein(s1: str, s2: str) -> int:
    """Compute edit distance between two strings."""
    if s1 == s2:
        return 0
    if not s1:
        return len(s2)
    if not s2:
        return len(s1)
    dp = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        new_dp = [i + 1]
        for j, c2 in enumerate(s2):
            new_dp.append(min(
                dp[j] + (0 if c1 == c2 else 1),
                dp[j + 1] + 1,
                new_dp[-1] + 1,
            ))
        dp = new_dp
    return dp[-1]


# ── Table printing helpers ───────────────────────────────────────────────────

COL_WIDTHS = [28, 16, 12, 16, 8, 14, 10, 6]
HEADERS = ["Image", "EasyOCR Result", "EOCR Conf", "FP-OCR Result", "FP Conf",
           "Selected", "Time(ms)", "⚠"]


def _row(cells: list[str]) -> str:
    padded = [str(c).ljust(w) for c, w in zip(cells, COL_WIDTHS)]
    return "| " + " | ".join(padded) + " |"


def _separator() -> str:
    return "|" + "|".join("-" * (w + 2) for w in COL_WIDTHS) + "|"


# ── Main test runner ─────────────────────────────────────────────────────────

def run_tests(plates_dir: str, max_images: int = 10) -> None:
    """
    Load up to `max_images` plate images from `plates_dir`, run hybrid_ocr
    on each, and print a comparison table with disagreement flags.

    Parameters
    ----------
    plates_dir : Directory containing .jpg/.png plate crops.
    max_images : Maximum number of images to test (default 10).
    """
    print(f"\nParkFlow — Hybrid OCR Test Suite")
    print(f"Plates directory : {plates_dir}")
    print(f"Max images       : {max_images}")
    print()

    # ── Gather image files ───────────────────────────────────────────────────
    supported = {'.jpg', '.jpeg', '.png', '.bmp'}
    images = sorted([
        f for f in os.listdir(plates_dir)
        if os.path.splitext(f)[1].lower() in supported
    ])[:max_images]

    if not images:
        print(f"⚠  No images found in '{plates_dir}'.")
        print("   Place cropped plate images there and re-run.")
        return

    print(f"Found {len(images)} image(s). Loading models…")
    reader  = get_easyocr_reader()
    fp_model = get_fpocr_model()
    fp_available = fp_model is not None
    print(f"EasyOCR    : ready")
    print(f"FastPlateOCR: {'ready' if fp_available else 'NOT available (Python>=3.10 + fast-plate-ocr[onnx] required)'}")
    print()

    # ── Table header ─────────────────────────────────────────────────────────
    print(_row(HEADERS))
    print(_separator())

    times_ms: list[float] = []
    disagreements: list[str] = []

    for img_name in images:
        img_path = os.path.join(plates_dir, img_name)
        plate_img = cv2.imread(img_path)
        if plate_img is None:
            print(_row([img_name, "READ ERROR", "-", "-", "-", "-", "-", "❌"]))
            continue

        # ── Individual engine runs (for the table columns) ────────────────────
        t0 = time.perf_counter()

        eocr_raw,  eocr_conf  = run_easyocr(plate_img, reader)
        fpocr_raw, fpocr_conf = run_fast_plate_ocr(plate_img)

        # Full hybrid result (uses both engines + selection logic)
        result: HybridOCRResult = hybrid_ocr(plate_img, reader=reader)

        elapsed_ms = (time.perf_counter() - t0) * 1000
        times_ms.append(elapsed_ms)

        # Post-process individual engine results for display
        eocr_valid  = validate_pakistan_plate(post_process_plate(eocr_raw))
        fpocr_valid = validate_pakistan_plate(post_process_plate(fpocr_raw))

        # Disagreement check (edit distance > 2 between the two engine outputs)
        dist = levenshtein(
            eocr_valid.replace("-", ""),
            fpocr_valid.replace("-", ""),
        )
        flag = "⚠" if dist > 2 and eocr_valid != "UNREADABLE" and fpocr_valid != "UNREADABLE" else ""
        if flag:
            disagreements.append(img_name)

        short_name = img_name[:26] + ".." if len(img_name) > 28 else img_name
        print(_row([
            short_name,
            eocr_valid,
            f"{eocr_conf:.2%}",
            fpocr_valid if fp_available else "N/A",
            f"{fpocr_conf:.2%}" if fp_available else "N/A",
            result.text,
            f"{elapsed_ms:.0f}",
            flag,
        ]))

    print(_separator())

    # ── Summary ───────────────────────────────────────────────────────────────
    if times_ms:
        avg_ms = sum(times_ms) / len(times_ms)
        max_ms = max(times_ms)
        budget_ok = avg_ms <= 1500

        print()
        print(f"Average processing time : {avg_ms:.0f} ms  {'✅' if budget_ok else '❌ OVER 1500ms BUDGET'}")
        print(f"Slowest single image    : {max_ms:.0f} ms")
        print(f"Total images tested     : {len(times_ms)}")

        if disagreements:
            print(f"\n⚠  {len(disagreements)} image(s) had engine disagreement:")
            for name in disagreements:
                print(f"   – {name}")
        else:
            print("\n✅ No significant engine disagreements detected.")

    print()


# ── CLI entry point ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Hybrid OCR comparison test")
    parser.add_argument(
        "--plates-dir",
        default=os.path.join(_HERE, "test_plates"),
        help="Directory containing test plate images (default: ./test_plates/)",
    )
    parser.add_argument(
        "--max", type=int, default=10,
        help="Maximum number of images to test (default: 10)",
    )
    args = parser.parse_args()

    if not os.path.isdir(args.plates_dir):
        os.makedirs(args.plates_dir, exist_ok=True)
        print(f"Created directory '{args.plates_dir}'.")
        print("Add .jpg/.png plate crops and re-run.\n")
        sys.exit(0)

    run_tests(args.plates_dir, max_images=args.max)
