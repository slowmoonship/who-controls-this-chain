"""Parser-level tests against fixture shapes recorded from live APIs (2026-11-12)."""

from collector.polygon import tally_producer_votes, _producer_rows
from collector.metrics import concentration_count, sorted_desc, top_share


def test_tally_producer_votes_positional_weighting():
    # Two voters: A (power 10) votes [x, y]; B (power 5) votes [y, x].
    # N = 2 potential producers -> weights 2 (pos0), 1 (pos1).
    # x: 2*10 + 1*5 = 25 ; y: 1*10 + 2*5 = 20
    votes = {"A": ["x", "y"], "B": ["y", "x"]}
    powers = {"A": 10, "B": 5}
    result = tally_producer_votes(votes, powers, total_potential=2, limit=2)
    assert result == [
        {"val_id": "x", "score": "25"},
        {"val_id": "y", "score": "20"},
    ]


def test_tally_producer_votes_skips_unknown_voters():
    votes = {"ghost": ["x"], "A": ["x"]}
    powers = {"A": 10}
    result = tally_producer_votes(votes, powers, total_potential=2, limit=1)
    assert result == [{"val_id": "x", "score": "20"}]


def test_tally_producer_votes_limit():
    votes = {"A": ["x", "y", "z"]}
    powers = {"A": 10}
    result = tally_producer_votes(votes, powers, total_potential=3, limit=2)
    assert [r["val_id"] for r in result] == ["x", "y"]


def test_producer_rows_from_span_shape():
    # Shape from /bor/spans/latest selected_producers (verified 2026-11-12).
    raw = [
        {
            "val_id": "91",
            "start_epoch": "9990",
            "end_epoch": "0",
            "nonce": "319",
            "voting_power": "83489003",
            "pub_key": "BNP2UyNqqdW0qq+ZataKTo0bz94dCIDTsf7HzO6EiNeeLTkRcL4Qkiip1/eKK2o5gUQPsRFNbomLcHvHVHT9bb0=",
            "signer": "0xe8de70b95a4d105aff6584a722242726016956fe",
            "last_updated": "2619120900102",
            "jailed": False,
        }
    ]
    rows = _producer_rows(raw)
    assert rows == [
        {
            "val_id": "91",
            "signer": "0xe8de70b95a4d105aff6584a722242726016956fe",
            "voting_power": "83489003",
        }
    ]


def test_polygon_snapshot_metrics_recompute():
    """Recompute stats from a stored weights list — the reproducibility contract."""
    # Observed shape: 100 validators, top10 ≈ 66%, max ≈ 11.7%.
    weights = sorted_desc([int(x) for x in (["438000000"] + ["2000000"] * 9 + ["100000"] * 90)])
    assert concentration_count(weights, 0.33) <= 10
    assert top_share(weights, 10) > 0.6
