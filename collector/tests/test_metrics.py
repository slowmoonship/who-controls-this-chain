import pytest

from collector import metrics


def test_total_weight():
    assert metrics.total_weight([1, 2, 3]) == 6
    assert metrics.total_weight([]) == 0


def test_top_share_basic():
    weights = [50, 30, 20]
    assert metrics.top_share(weights, 1) == 0.5
    assert metrics.top_share(weights, 2) == 0.8
    assert metrics.top_share(weights, 3) == 1.0


def test_top_share_unsorted_input():
    weights = [20, 50, 30]
    assert metrics.top_share(weights, 2) == 0.8


def test_top_share_avalanche_snapshot_shape():
    # 544 validators, top 10 holds 19.05% — reproduced from raw weights.
    weights = [90] * 10 + [1] * 534
    total = sum(weights)
    assert metrics.top_share(weights, 10) == round(900 / total, 6)


def test_top_share_rejects_bad_input():
    with pytest.raises(ValueError):
        metrics.top_share([0, 0], 1)
    with pytest.raises(ValueError):
        metrics.top_share([1, 2], 0)


def test_max_share():
    assert metrics.max_share([1, 1, 8]) == 0.8


def test_concentration_count_half():
    weights = [40, 30, 20, 10]
    assert metrics.concentration_count(weights, 0.5) == 2  # 40+30 = 70 >= 50
    assert metrics.concentration_count(weights, 0.33) == 1
    assert metrics.concentration_count(weights, 1.0) == 4


def test_concentration_count_exact_threshold():
    # 4 of 100 validators at 25% each: exactly 2 reach 50%.
    weights = [25, 25, 25, 25]
    assert metrics.concentration_count(weights, 0.5) == 2


def test_concentration_count_threshold_bounds():
    with pytest.raises(ValueError):
        metrics.concentration_count([1, 2], 0)
    with pytest.raises(ValueError):
        metrics.concentration_count([1, 2], 1.5)


def test_concentration_count_negative_weights_rejected():
    with pytest.raises(ValueError):
        metrics.concentration_count([5, -1], 0.5)


def test_concentration_count_empty():
    assert metrics.concentration_count([], 0.5) == 0


def test_block_coverage_count():
    # 1-producer-per-span world: 4 producers rotated evenly over 12 spans.
    counts = [3 * 6400, 3 * 6400, 3 * 6400, 3 * 6400]
    assert metrics.block_coverage_count(counts, 0.5) == 2
    assert metrics.block_coverage_count([10, 1, 1], 0.5) == 1
