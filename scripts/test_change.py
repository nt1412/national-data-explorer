"""Tests for the core change/polarity logic. Run: python scripts/test_change.py"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from engine.change import change_value, improved, format_change


def check(name, got, want):
    ok = got == want
    print(f"  [{'ok' if ok else 'FAIL'}] {name}: got {got!r} want {want!r}")
    return ok


def main():
    results = []
    # --- change_value: absolute difference, native unit, never relative % ---
    results.append(check("institutional births 40->48 = +8 pts", change_value(40, 48), 8.0))
    results.append(check("not relative % (40->48 != +20)", change_value(40, 48) != 20, True))
    results.append(check("anaemia 55.2->38.3 = -16.9", change_value(55.2, 38.3), -16.9))
    results.append(check("sex ratio 918->925 = +7 (native)", change_value(918, 925), 7.0))
    results.append(check("missing v4 -> None", change_value(None, 48), None))
    results.append(check("missing v5 -> None", change_value(40, None), None))

    # --- improved: polarity-aware, NOT sign of raw change ---
    results.append(check("births up + polarity +1 -> improved", improved(8.0, +1), True))
    results.append(check("anaemia down + polarity -1 -> improved", improved(-16.9, -1), True))
    results.append(check("anaemia UP + polarity -1 -> worse", improved(4.0, -1), False))
    results.append(check("stunting up + polarity -1 -> worse", improved(3.0, -1), False))
    results.append(check("polarity 0 -> not graded", improved(5.0, 0), None))
    results.append(check("no change -> not graded", improved(0.0, +1), None))
    results.append(check("None change -> None", improved(None, +1), None))

    # --- format_change: label carries the unit; % -> pts ---
    results.append(check("format % as pts", format_change(8.0, "%"), "+8 pts"))
    results.append(check("format ratio native", format_change(-7.0, "per 1,000"), "-7 per 1,000"))
    results.append(check("format None", format_change(None, "%"), "—"))

    n = len(results); passed = sum(results)
    print(f"\n{passed}/{n} passed")
    sys.exit(0 if passed == n else 1)


if __name__ == "__main__":
    main()
