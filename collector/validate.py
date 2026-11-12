"""Sanity checks over collected data. Pure functions, unit-tested.

Anomaly policy (see spec §8): a suspicious change is recorded but must NOT
overwrite the last known-good snapshot. The orchestrator keeps the previous
``latest.json`` values and attaches the anomaly as a warning.
"""

from __future__ import annotations

from typing import Any

# Relative change beyond which a value is considered suspicious.
SUDDEN_CHANGE_RATIO = 0.5  # e.g. validator count drops by >50%


def sudden_change(old: float, new: float) -> bool:
    """True if ``new`` moved away from ``old`` by more than SUDDEN_CHANGE_RATIO."""
    if old <= 0:
        return False
    return abs(new - old) / old > SUDDEN_CHANGE_RATIO


def check_validator_count(old_count: int | None, new_count: int) -> list[str]:
    warnings: list[str] = []
    if new_count <= 0:
        warnings.append("active validator count is zero or negative")
    if old_count is not None and sudden_change(old_count, new_count):
        warnings.append(
            f"active validator count changed abruptly: {old_count} -> {new_count} "
            f"(> {SUDDEN_CHANGE_RATIO:.0%}); treating as suspected data anomaly"
        )
    return warnings


def check_weights(old_total: int | None, new_total: int) -> list[str]:
    warnings: list[str] = []
    if new_total <= 0:
        warnings.append("total weight is zero or negative")
    if old_total is not None and sudden_change(float(old_total), float(new_total)):
        warnings.append(
            f"total weight changed abruptly: {old_total} -> {new_total} "
            f"(> {SUDDEN_CHANGE_RATIO:.0%}); treating as suspected data anomaly"
        )
    return warnings


def check_shares(top10: float, max_s: float, count: int) -> list[str]:
    warnings: list[str] = []
    if not 0 < top10 <= 1:
        warnings.append(f"top10 share out of range: {top10}")
    if not 0 < max_s <= 1:
        warnings.append(f"max share out of range: {max_s}")
    if count > 0 and max_s * count < top10 - 1e-9:
        warnings.append("inconsistent shares: max_share * count < top10_share")
    return warnings


def is_anomalous(warnings: list[str]) -> bool:
    """An anomaly (vs. a mere missing-value warning) blocks overwriting stats."""
    return any("anomaly" in w for w in warnings)
