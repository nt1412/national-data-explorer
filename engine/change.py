"""Unit-aware, polarity-adjusted change — the core honesty logic.

Shared across all datasets. Kept pure (no I/O) so it is trivially testable.

Two rules the whole product rests on:
  * change is the ABSOLUTE difference in the indicator's native unit
    (percentage *points* for %, native diff for rates/ratios) — never relative %.
  * "improved" depends on the indicator's polarity, not the sign of the raw change:
    higher institutional births = good (+1), higher anaemia = bad (-1).
"""
from __future__ import annotations


def change_value(v4, v5):
    """Absolute change v5 - v4 in the native unit, or None if either round missing.

    Unit does not change the arithmetic (points and native-ratio diffs are both
    absolute differences) — it only drives the *label*. Relative % is never used.
    """
    if v4 is None or v5 is None:
        return None
    return round(v5 - v4, 1)


def improved(change, polarity):
    """True if the district got better on this indicator, honouring polarity.

    polarity: +1 up-is-good, -1 up-is-bad, 0 not graded.
    Returns None when not gradable (no change, or polarity 0).
    """
    if change is None or polarity == 0 or change == 0:
        return None
    return (1 if change > 0 else -1) * polarity > 0


def format_change(change, unit):
    """Human label carrying the unit, e.g. '+8.0 pts' or '-7.0 per 1,000'."""
    if change is None:
        return "—"
    sign = "+" if change > 0 else ("" if change < 0 else "±")
    suffix = "pts" if unit == "%" else unit
    return f"{sign}{change:g} {suffix}"
