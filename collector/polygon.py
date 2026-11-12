"""Polygon PoS collector (Heimdall v2 + Bor).

Verified 2026-11-12 (see research/NOTES.md):

* Heimdall v2 REST gateway at ``https://heimdall-api.polygon.technology`` with
  routes like ``/stake/validators-set``, ``/bor/spans/latest``, ``/bor/params``.
  Legacy Heimdall v1 routes return ``Not Implemented``.
* Bor is the execution layer; block production is governed by Heimdall "veBlop"
  spans: each span freezes exactly ONE producer, round-robin over an elected
  candidate pool. ``/bor/params.producer_count`` is the legacy selection
  parameter and does not equal the number of live producers.
"""

from __future__ import annotations

from typing import Any

from . import metrics
from .http import fetch_json

DEFAULT_HEIMDALL_API = "https://heimdall-api.polygon.technology"
DEFAULT_BOR_RPC = "https://polygon-bor-rpc.publicnode.com"
DEFAULT_STAKING_API = "https://staking-api.polygon.technology"

# Client-side constants from heimdall-v2 helper/config.go (post
# SetProducerDowntime hardfork at Heimdall height 34,966,593 the limit is 4).
PRODUCER_SET_LIMIT = 4
HARDFORK_HEIGHTS_MAINNET = {
    "rio": 24404501,
    "producer_downtime": 34966593,
    "phuket": 44070000,
    "zurich": 47880000,
    "ithaca": 50185000,
    "kyoto": 51533000,
    "lugano": 54627000,
    "karwar": 57006000,
}
FALLBACK_PRODUCERS_MAINNET = "91,92,93,94"  # helper/config.go DefaultMainnetProducers

RECENT_SPANS = 12


def _h(url: str, path: str) -> Any:
    return fetch_json(url.rstrip("/") + path)


def _bor_rpc(url: str, method: str, params: list[Any] | None = None) -> Any:
    body = fetch_json(
        url,
        method="POST",
        payload={"jsonrpc": "2.0", "id": 1, "method": method, "params": params or []},
    )
    if body.get("error"):
        raise RuntimeError(f"{method}: {body['error']}")
    return body.get("result")


def tally_producer_votes(
    votes: dict[str, list[str]],
    powers: dict[str, int],
    total_potential: int,
    limit: int,
) -> list[dict[str, Any]]:
    """Replicates heimdall-v2 ``CalculateProducerSet`` scoring.

    Score(candidate) = sum over voters of (total_potential - position) * voter_stake,
    considering only the first ``total_potential`` entries of each vote list.
    Returns the top ``limit`` candidates with scores (descending).
    """
    scores: dict[str, int] = {}
    for voter_id, choices in votes.items():
        stake = powers.get(voter_id)
        if not stake:
            continue
        for i, candidate in enumerate(choices[:total_potential]):
            if i >= total_potential:
                break
            scores[candidate] = scores.get(candidate, 0) + (total_potential - i) * stake
    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)[:limit]
    return [{"val_id": c, "score": str(s)} for c, s in ranked]


def _producer_rows(producers: list[dict[str, Any]]) -> list[dict[str, str]]:
    return [
        {
            "val_id": str(p.get("val_id", p.get("ID", ""))),
            "signer": str(p.get("signer", "")),
            "voting_power": str(p.get("voting_power", p.get("power", ""))),
        }
        for p in producers
    ]


def collect_polygon(
    heimdall_api: str = DEFAULT_HEIMDALL_API,
    bor_rpc: str = DEFAULT_BOR_RPC,
    staking_api: str = DEFAULT_STAKING_API,
    top_k: int = 10,
) -> dict[str, Any]:
    status = _h(heimdall_api, "/status")
    vset = _h(heimdall_api, "/stake/validators-set")["validator_set"]
    latest_span = _h(heimdall_api, "/bor/spans/latest")["span"]
    bor_params = _h(heimdall_api, "/bor/params")["params"]
    votes_raw = _h(heimdall_api, "/bor/producer-votes").get("all_votes", {})

    validators = vset["validators"]
    powers = {str(v["val_id"]): int(v["voting_power"]) for v in validators}
    weights = list(powers.values())
    total = metrics.total_weight(weights)

    rows = sorted(
        (
            {
                "val_id": str(v["val_id"]),
                "signer": v["signer"],
                "voting_power": v["voting_power"],
                "share": round(int(v["voting_power"]) / total, 6),
            }
            for v in validators
        ),
        key=lambda r: int(r["voting_power"]),
        reverse=True,
    )

    # Optional operator-declared names (staking API). Failure is tolerated.
    names: dict[str, str] = {}
    try:
        for rid in [r["val_id"] for r in rows[:top_k]] + [
            p["val_id"] for p in _producer_rows(latest_span.get("selected_producers", []))
        ]:
            if rid in names:
                continue
            info = _h(staking_api, f"/api/v3/validators/{rid}").get("result") or {}
            if info.get("name"):
                names[rid] = str(info["name"]).strip()
    except Exception:  # noqa: BLE001 - names are best-effort enrichment
        names = {}

    for r in rows[:top_k]:
        if r["val_id"] in names:
            r["name"] = names[r["val_id"]]

    # Recent spans (current span first, then history) for producer rotation.
    current_id = int(latest_span["id"])
    recent_spans = []
    for sid in range(current_id, max(current_id - RECENT_SPANS, 0), -1):
        try:
            span = (
                latest_span
                if sid == current_id
                else _h(heimdall_api, f"/bor/spans/{sid}")["span"]
            )
        except Exception:  # noqa: BLE001
            continue
        recent_spans.append(
            {
                "id": int(span["id"]),
                "start_block": int(span["start_block"]),
                "end_block": int(span["end_block"]),
                "producers": _producer_rows(span.get("selected_producers", [])),
            }
        )

    current_producers = _producer_rows(latest_span.get("selected_producers", []))
    for p in current_producers:
        if p["val_id"] in names:
            p["name"] = names[p["val_id"]]

    # Distinct producers observed in the recent window + block coverage.
    blocks_by_producer: dict[str, int] = {}
    for s in recent_spans:
        span_blocks = s["end_block"] - s["start_block"] + 1
        for p in s["producers"]:
            key = p["val_id"] or p["signer"]
            blocks_by_producer[key] = blocks_by_producer.get(key, 0) + span_blocks

    votes = {str(k): [str(x) for x in v.get("votes", [])] for k, v in votes_raw.items()}
    vote_tally = tally_producer_votes(votes, powers, len(validators), PRODUCER_SET_LIMIT)

    # Bor execution-layer cross-check (best effort).
    bor_crosscheck: dict[str, Any] = {}
    try:
        bor_block = int(_bor_rpc(bor_rpc, "eth_blockNumber"), 16)
        bor_vals = _bor_rpc(bor_rpc, "bor_getCurrentValidators")
        bor_crosscheck = {
            "bor_block": str(bor_block),
            "bor_getCurrentValidators": [
                {"signer": v.get("signer"), "power": str(v.get("power"))}
                for v in (bor_vals or [])
            ],
        }
    except Exception as exc:  # noqa: BLE001
        bor_crosscheck = {"error": str(exc)}

    return {
        "network": "polygon_pos",
        "name": "Polygon PoS (Heimdall v2 + Bor)",
        "chain_heights": {
            "heimdall_height": str(status.get("latest_block_height")),
        },
        "heimdall": {
            "active_validators": len(validators),
            "total_voting_power": str(total),
            "top10_share": metrics.top_share(weights, top_k),
            "max_share": metrics.max_share(weights),
            "nakamoto": {
                "n_33": metrics.concentration_count(weights, 0.33),
                "n_50": metrics.concentration_count(weights, 0.50),
            },
        },
        "top10": rows[:top_k],
        "validators_all": rows,
        "bor": {
            "params": {
                "sprint_duration": int(bor_params["sprint_duration"]),
                "span_duration": int(bor_params["span_duration"]),
                "producer_count": int(bor_params["producer_count"]),
            },
            "current_span": {
                "id": int(latest_span["id"]),
                "start_block": int(latest_span["start_block"]),
                "end_block": int(latest_span["end_block"]),
                "producers": current_producers,
            },
            "recent_spans": recent_spans,
            "producer_set_limit": PRODUCER_SET_LIMIT,
            "vote_tally_top": vote_tally,
            "fallback_producers_client_constant": FALLBACK_PRODUCERS_MAINNET,
            "blocks_by_producer_recent": blocks_by_producer,
            "block_coverage_n_50": metrics.block_coverage_count(
                list(blocks_by_producer.values()), 0.5
            )
            if blocks_by_producer
            else None,
            "bor_crosscheck": bor_crosscheck,
        },
        "weights_sorted_desc": [str(w) for w in metrics.sorted_desc(weights)],
        "hardfork_heights_mainnet": HARDFORK_HEIGHTS_MAINNET,
        "sources": [
            {
                "id": "heimdall-validators-set",
                "label": "Heimdall v2 REST /stake/validators-set",
                "url": DEFAULT_HEIMDALL_API + "/stake/validators-set",
                "kind": "rest",
            },
            {
                "id": "heimdall-span-latest",
                "label": "Heimdall v2 REST /bor/spans/latest",
                "url": DEFAULT_HEIMDALL_API + "/bor/spans/latest",
                "kind": "rest",
            },
            {
                "id": "heimdall-bor-params",
                "label": "Heimdall v2 REST /bor/params",
                "url": DEFAULT_HEIMDALL_API + "/bor/params",
                "kind": "rest",
            },
            {
                "id": "heimdall-producer-votes",
                "label": "Heimdall v2 REST /bor/producer-votes",
                "url": DEFAULT_HEIMDALL_API + "/bor/producer-votes",
                "kind": "rest",
            },
            {
                "id": "bor-rpc",
                "label": "Bor JSON-RPC (bor_getCurrentValidators)",
                "url": DEFAULT_BOR_RPC,
                "kind": "rpc",
            },
        ],
    }
