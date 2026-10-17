#!/usr/bin/env python3
"""Atomic last-known-good snapshot promotion used by the trial pipeline."""

from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def canonical_bytes(value: dict[str, Any]) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def checksum(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def promote(dashboard: str, report: dict[str, Any], root: Path) -> dict[str, Any]:
    """Promote only a fully accepted report; rejected reports never touch current."""
    key = dashboard.lower()
    current_dir = root / "current"
    history_dir = root / "history" / key
    audit_dir = root / "audit"
    current_dir.mkdir(parents=True, exist_ok=True)
    history_dir.mkdir(parents=True, exist_ok=True)
    audit_dir.mkdir(parents=True, exist_ok=True)
    current_path = current_dir / f"{key}.json"
    previous_hash = checksum(current_path) if current_path.exists() else None
    now = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ")

    accepted = report.get("status") == "accepted" and report.get("safe_to_replace_live_data") is True
    decision = {
        "dashboard": key,
        "accepted": accepted,
        "attempted_at": now,
        "previous_checksum": previous_hash,
        "reason": "validated" if accepted else "validation gate rejected the update",
    }

    if accepted:
        payload = canonical_bytes(report)
        history_path = history_dir / f"{now}.json"
        history_path.write_bytes(payload)
        temporary = current_path.with_suffix(".json.tmp")
        temporary.write_bytes(payload)
        os.replace(temporary, current_path)
        decision["current_checksum"] = checksum(current_path)
    else:
        decision["current_checksum"] = checksum(current_path) if current_path.exists() else None

    (audit_dir / f"{now}-{key}.json").write_bytes(canonical_bytes(decision))
    return decision
