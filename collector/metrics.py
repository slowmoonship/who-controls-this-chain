"""Pure metric computations. All functions are deterministic and unit-tested.

Conventions
-----------
* ``weights`` are non-negative integers (raw chain units: nAVAX for Avalanche,
  Heimdall voting power for Polygon PoS). Scale does not matter for shares.
* Shares are floats in [0, 1], rounded to 6 decimals at the boundary.
* The Nakamoto-style statistic here is a **weight-concentration count**: the
  minimum number of largest validators whose combined weight reaches a given
  fraction of the total. It is NOT asserted to be an attack threshold; see
  methodology.json for per-network caveats.
"""

from __future__ import annotations

from typing import Iterable, Sequence


def total_weight(weights: Iterable[int]) -> int:
    return sum(weights)


def sorted_desc(weights: Iterable[int]) -> list[int]:
    return sorted((int(w) for w in weights), reverse=True)


def top_share(weights: Sequence[int], k: int) -> float:
    """Share of total weight held by the k largest validators (0 if empty)."""
    if k <= 0:
        raise ValueError("k must be positive")
    ordered = sorted_desc(weights)
    total = sum(ordered)
    if total <= 0:
        raise ValueError("total weight must be positive")
    return round(sum(ordered[:k]) / total, 6)


def max_share(weights: Sequence[int]) -> float:
    return top_share(weights, 1)


def concentration_count(weights: Sequence[int], threshold: float) -> int:
    """Minimum number of largest validators reaching ``threshold`` of total weight.

    ``threshold`` is a fraction in (0, 1], e.g. 0.33 or 0.5.
    Returns 0 for an empty input. Raises if weights are negative or total is 0.
    """
    if not 0 < threshold <= 1:
        raise ValueError("threshold must be in (0, 1]")
    ordered = sorted_desc(weights)
    if not ordered:
        return 0
    if any(w < 0 for w in ordered):
        raise ValueError("weights must be non-negative")
    total = sum(ordered)
    if total <= 0:
        raise ValueError("total weight must be positive")
    acc = 0
    for i, w in enumerate(ordered, start=1):
        acc += w
        if acc / total >= threshold:
            return i
    return len(ordered)


def block_coverage_count(block_counts: Sequence[int], threshold: float = 0.5) -> int:
    """Minimum number of producers covering ``threshold`` of blocks.

    ``block_counts`` maps producers to produced-block counts (any order).
    Same weight-concentration semantics as :func:`concentration_count`.
    """
    return concentration_count(block_counts, threshold)


def share_of(part: int, whole: int) -> float:
    if whole <= 0:
        raise ValueError("whole must be positive")
    return round(part / whole, 6)
