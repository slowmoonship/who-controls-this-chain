"""Collector orchestrator.

Usage:  python3 -m collector.main --data-dir data

Writes:
  data/latest.json        last VALID snapshot (never overwritten by failures)
  data/history/<ts>.json  one file per collection attempt (valid + anomalies)
  data/history/index.json small manifest for the frontend history charts
  data/last_attempt.json  operational status of the most recent attempt

Anomaly policy: sudden >50% moves in validator count / total weight are stored
in history with status "anomaly" and do NOT replace the previous valid stats.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from . import validate
from .authority import collect_authority
from .avalanche import collect_avalanche
from .polygon import collect_polygon


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def stamp(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(path)


def read_json(path: Path) -> Any | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def network_prev_snapshot(prev_latest: dict[str, Any] | None, key: str) -> dict[str, Any] | None:
    if not prev_latest:
        return None
    return (prev_latest.get("networks") or {}).get(key)


def validate_network(key: str, snap: dict[str, Any], prev: dict[str, Any] | None) -> list[str]:
    warnings: list[str] = []
    if key == "avalanche":
        m = snap["metrics"]
        old = prev["metrics"] if prev else None
        warnings += validate.check_validator_count(
            old["active_validators"] if old else None, m["active_validators"]
        )
        warnings += validate.check_weights(
            int(old["total_weight"]) if old else None, int(m["total_weight"])
        )
        warnings += validate.check_shares(m["top10_share"], m["max_share"], m["active_validators"])
    else:
        h = snap["heimdall"]
        old = prev["heimdall"] if prev else None
        warnings += validate.check_validator_count(
            old["active_validators"] if old else None, h["active_validators"]
        )
        warnings += validate.check_weights(
            int(old["total_voting_power"]) if old else None, int(h["total_voting_power"])
        )
        warnings += validate.check_shares(h["top10_share"], h["max_share"], h["active_validators"])
    return warnings


def build_history_entry(snapshot: dict[str, Any], file_name: str) -> dict[str, Any]:
    networks = snapshot["networks"]
    av = (networks.get("avalanche") or {}).get("metrics", {})
    px = (networks.get("polygon_pos") or {}).get("heimdall", {})
    pb = (networks.get("polygon_pos") or {}).get("bor", {})
    span = pb.get("current_span", {}) if pb else {}
    return {
        "file": file_name,
        "t": snapshot["generated_at"],
        "status": snapshot["status"],
        "avalanche": {
            "active_validators": av.get("active_validators"),
            "top10_share": av.get("top10_share"),
            "n_33": (av.get("nakamoto") or {}).get("n_33"),
        },
        "polygon_pos": {
            "active_validators": px.get("active_validators"),
            "top10_share": px.get("top10_share"),
            "n_33": (px.get("nakamoto") or {}).get("n_33"),
            "span_id": span.get("id"),
            "producers": len(span.get("producers") or []),
        },
    }


def run(data_dir: Path) -> int:
    now = utc_now()
    generated_at = stamp(now)
    prev_latest = read_json(data_dir / "latest.json")

    warnings: list[str] = []
    networks: dict[str, Any] = {}
    anomalies: dict[str, list[str]] = {}
    errors: dict[str, str] = {}

    collectors = {
        "avalanche": lambda: collect_avalanche(),
        "polygon_pos": lambda: collect_polygon(),
    }
    for key, fn in collectors.items():
        try:
            snap = fn()
        except Exception as exc:  # noqa: BLE001 - keep other networks alive
            errors[key] = str(exc)
            prev = network_prev_snapshot(prev_latest, key)
            if prev:
                carried = dict(prev)
                carried["carried_forward"] = True
                networks[key] = carried
                warnings.append(f"{key}: collection failed ({exc}); carrying previous snapshot")
            else:
                networks[key] = {"network": key, "collect_status": f"error: {exc}"}
            continue

        prev = network_prev_snapshot(prev_latest, key)
        w = validate_network(key, snap, prev)
        snap["collect_status"] = "ok" if not errors else "ok"
        snap["validation_warnings"] = w
        if validate.is_anomalous(w):
            anomalies[key] = w
            if prev:
                carried = dict(prev)
                carried["carried_forward"] = True
                carried["validation_warnings"] = w
                networks[key] = carried
                warnings.append(
                    f"{key}: anomaly detected, keeping previous valid stats ({'; '.join(w)})"
                )
            else:
                snap["collect_status"] = "anomaly"
                networks[key] = snap
        else:
            networks[key] = snap
            warnings += [f"{key}: {x}" for x in w]

    try:
        networks["authority"] = collect_authority()
    except Exception as exc:  # noqa: BLE001
        errors["authority"] = str(exc)
        prev = network_prev_snapshot(prev_latest, "authority")
        if prev:
            networks["authority"] = {**prev, "carried_forward": True}
        warnings.append(f"authority: collection failed ({exc})")

    status = "ok"
    if errors or anomalies:
        status = "partial"
    if len(errors) == len(collectors):
        status = "error"

    snapshot = {
        "schema_version": 1,
        "generated_at": generated_at,
        "status": status,
        "warnings": warnings,
        "networks": networks,
    }

    hist_dir = data_dir / "history"
    hist_dir.mkdir(parents=True, exist_ok=True)
    file_name = generated_at.replace(":", "").replace("-", "")
    write_json(hist_dir / f"{file_name}.json", snapshot)

    index = read_json(hist_dir / "index.json") or []
    index.append(build_history_entry(snapshot, f"{file_name}.json"))
    write_json(hist_dir / "index.json", index)

    write_json(
        data_dir / "last_attempt.json",
        {
            "attempted_at": generated_at,
            "status": status,
            "errors": errors,
            "anomalies": anomalies,
            "warnings": warnings,
        },
    )

    # Replace latest.json only when at least one network is fresh & valid.
    fresh_valid = any(
        isinstance(networks.get(k), dict) and not networks[k].get("carried_forward")
        for k in collectors
    )
    if fresh_valid and status != "error":
        write_json(data_dir / "latest.json", snapshot)
        print(f"[ok] latest.json updated at {generated_at}")
    else:
        print(f"[warn] latest.json NOT updated ({status}); see last_attempt.json")

    for k, v in errors.items():
        print(f"[error] {k}: {v}", file=sys.stderr)
    for w in warnings:
        print(f"[warn] {w}")
    return 0 if status != "error" else 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Who Controls This Chain? data collector")
    parser.add_argument("--data-dir", default="data", type=Path)
    args = parser.parse_args(argv)
    return run(args.data_dir)


if __name__ == "__main__":
    raise SystemExit(main())
