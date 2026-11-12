"""Minimal HTTP helpers for the collector (stdlib only, no third-party deps)."""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from typing import Any

USER_AGENT = "who-controls-this-chain-collector/0.1 (+https://github.com/)"
DEFAULT_TIMEOUT = 20
DEFAULT_RETRIES = 3
RETRY_BACKOFF = 2.0


class FetchError(Exception):
    """Raised when an endpoint could not be fetched after retries."""


def fetch_json(
    url: str,
    *,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
    timeout: int = DEFAULT_TIMEOUT,
    retries: int = DEFAULT_RETRIES,
) -> Any:
    """Fetch JSON with timeout and bounded retries. Returns parsed body.

    Raises FetchError after exhausting retries. Never raises on HTTP/parse
    details other than as FetchError, so callers can treat failure uniformly.
    """
    data = None
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
    }
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    last_err: Exception | None = None
    for attempt in range(retries):
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                body = resp.read()
            try:
                return json.loads(body)
            except json.JSONDecodeError as exc:
                last_err = FetchError(f"{url}: invalid JSON ({exc})")
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as exc:
            last_err = FetchError(f"{url}: {exc}")
        if attempt < retries - 1:
            time.sleep(RETRY_BACKOFF * (attempt + 1))
    raise last_err if last_err else FetchError(f"{url}: unknown error")
