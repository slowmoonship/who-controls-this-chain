"""Avalanche Primary Network collector.

Data source: official P-Chain RPC ``platform.getCurrentValidators`` against the
Primary Network (no subnetID parameter). Verified 2026-11-12:

* ``weight`` (nAVAX) already includes delegated stake — ``delegatorWeight`` is
  the delegated portion of ``weight`` and must never be added on top.
"""

from __future__ import annotations

from typing import Any

from . import metrics
from .http import fetch_json

DEFAULT_RPC = "https://api.avax.network/ext/bc/P"


def rpc_call(url: str, method: str, params: dict[str, Any] | None = None) -> Any:
    body = fetch_json(
        url,
        method="POST",
        payload={"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}},
    )
    if "error" in body:
        raise RuntimeError(f"{method}: {body['error']}")
    return body.get("result")


def collect_avalanche(rpc_url: str = DEFAULT_RPC, top_k: int = 10) -> dict[str, Any]:
    """Collect Primary Network validator data and compute concentration stats."""
    validators = rpc_call(rpc_url, "platform.getCurrentValidators")["validators"]
    height = str(rpc_call(rpc_url, "platform.getHeight").get("height"))

    weights = [int(v["weight"]) for v in validators]
    delegator_weights = [int(v.get("delegatorWeight", "0")) for v in validators]
    total = metrics.total_weight(weights)

    rows = sorted(
        (
            {
                "node_id": v["nodeID"],
                "weight": v["weight"],
                "delegator_weight": v.get("delegatorWeight", "0"),
                "share": round(int(v["weight"]) / total, 6),
                "uptime": v.get("uptime"),
            }
            for v in validators
        ),
        key=lambda r: int(r["weight"]),
        reverse=True,
    )

    return {
        "network": "avalanche",
        "name": "Avalanche Primary Network",
        "chain_heights": {"p_chain_height": height},
        "metrics": {
            "active_validators": len(validators),
            "total_weight": str(total),
            "weight_unit": "nAVAX",
            "delegated_weight": str(metrics.total_weight(delegator_weights)),
            "top10_share": metrics.top_share(weights, top_k),
            "max_share": metrics.max_share(weights),
            "nakamoto": {
                "n_33": metrics.concentration_count(weights, 0.33),
                "n_50": metrics.concentration_count(weights, 0.50),
            },
        },
        "top10": rows[:top_k],
        "weights_sorted_desc": [str(w) for w in metrics.sorted_desc(weights)],
        "block_production": {
            "comparable_to_bor_spans": False,
            "mechanism": "Snowman++ leader sampling (stake-weighted proposers)",
            "note": (
                "Different consensus model: there is no fixed per-span producer set "
                "like Bor; any validator may propose blocks in proportion to stake."
            ),
        },
        "sources": [
            {
                "id": "avax-pchain-validators",
                "label": "platform.getCurrentValidators (Primary Network)",
                "url": "https://api.avax.network/ext/bc/P",
                "kind": "rpc",
            },
            {
                "id": "avax-pchain-height",
                "label": "platform.getHeight",
                "url": "https://api.avax.network/ext/bc/P",
                "kind": "rpc",
            },
        ],
    }
