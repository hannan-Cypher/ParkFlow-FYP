"""
test_postprocess_fixes.py — validate the two new post-processing fixes:
  1. LEF1981 must NOT lose its digits (19xx standalone-only removal)
  2. MNFT811 → MNF-811  (year-badge 'T' correction)
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ocr_postprocess import full_postprocess, validate_pakistani_plate, remove_year_fragments

UNIT = [
    # (raw_input,          expected_output,    label)
    ("LEF1981",            "LEF-1981",   "LEF-1981 — 19xx must NOT be stripped"),
    ("MNFT811",            "MNF-811",    "MNFT811 — T=year-badge misread → strip T"),
    ("MNA2272",            "MNA-2272",   "MNA-2272 genuine 4-digit plate unchanged"),
    ("LEB5542",            "LEB-5542",   "LEB-5542 genuine 4-digit plate unchanged"),
    ("AAY035",             "AAY-035",    "AAY-035 normal unchanged"),
    ("RI423",              "RI-423",     "RI-423 unchanged"),
    ("AGT427",             "AGT-427",    "AGT-427 unchanged"),
    ("BGW355",             "BGW-355",    "BGW-355 unchanged"),
    ("ABC1234",            "ABC-1234",   "ABC-1234 — no corruption"),
    ("LED16902",           "LED-902",    "LED16902 — embedded year 16 stripped"),
    ("PUNJABRI423",        "RI-423",     "PUNJABRI423 — province stripped"),
    ("JABR423",            "R-423",      "JABR423 — JAB prefix stripped"),
    # year fragment removal
    ("RI 20 423",          "RI-423",     "standalone 20 stripped from RI 20 423"),
    ("ABC 2019 1234",      "ABC-1234",   "standalone 2019 stripped"),
    # trailing year-badge digit bleed
    ("LEA3611",            "LEA-361",    "LEA3611 — trailing '1' from year badge stripped"),
    ("MNF8111",            "MNF-811",    "MNF8111 — trailing '1' from year badge stripped"),
    ("MNA2272",            "MNA-2272",   "MNA-2272 — does NOT strip trailing 2 (not '1')"),
]

passed = failed = 0
print("\n=== POST-PROCESS UNIT TESTS ===\n")
for raw, expected, label in UNIT:
    got = full_postprocess(raw)
    ok  = got == expected
    if ok: passed += 1
    else:  failed += 1
    print(f"  {'✅' if ok else '❌'}  {label}")
    if not ok:
        print(f"         input={raw!r}  expected={expected!r}  got={got!r}")

print(f"\n  {passed}/{passed+failed} passed\n")

# validate_pakistani_plate unit test
VT = [
    ("LEF1981", "LEF-1981"),
    ("MNF811",  "MNF-811"),
    ("MNFT811", "MNF-811"),
]
print("=== validate_pakistani_plate UNIT TESTS ===\n")
for raw, expected in VT:
    got = validate_pakistani_plate(raw)
    ok  = got == expected
    if ok: passed += 1
    else:  failed += 1
    print(f"  {'✅' if ok else '❌'}  validate({raw!r}) = {got!r}  expected={expected!r}")

print(f"\n{'='*40}")
total = passed + failed
print(f"{'✅ ALL PASS' if failed == 0 else f'❌ {failed} FAILED'}  ({passed}/{total})")
print(f"{'='*40}\n")
sys.exit(0 if failed == 0 else 1)
