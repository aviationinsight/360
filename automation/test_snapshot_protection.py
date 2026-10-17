#!/usr/bin/env python3
"""Prove that rejected updates cannot replace the last-known-good snapshots."""

from __future__ import annotations

import argparse
import copy
import json
import tempfile
from pathlib import Path

from amos_pipeline import validate as validate_amos
from aog_pipeline import validate as validate_aog
from fak_pipeline import validate as validate_fak
from snapshot_store import checksum, promote


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--amos", type=Path, required=True)
    parser.add_argument("--aog", type=Path, required=True)
    parser.add_argument("--fak", type=Path, required=True)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()

    reports = {
        "amos": validate_amos(args.amos),
        "aog": validate_aog(args.aog),
        "fak": validate_fak(args.fak),
    }
    checks = []
    with tempfile.TemporaryDirectory(prefix="sal-snapshot-test-") as temp:
        root = Path(temp)
        for dashboard, valid_report in reports.items():
            first = promote(dashboard, valid_report, root)
            current = root / "current" / f"{dashboard}.json"
            before = checksum(current)

            invalid_report = copy.deepcopy(valid_report)
            invalid_report["status"] = "rejected"
            invalid_report["safe_to_replace_live_data"] = False
            invalid_report["rejection_reasons"] = {"test invalid column": 1}
            rejected = promote(dashboard, invalid_report, root)
            after = checksum(current)

            passed = first["accepted"] is True and rejected["accepted"] is False and before == after
            checks.append({
                "dashboard": dashboard.upper(),
                "valid_snapshot_saved": first["accepted"],
                "invalid_update_rejected": rejected["accepted"] is False,
                "last_good_snapshot_unchanged": before == after,
                "passed": passed,
            })

    output = {"passed": all(check["passed"] for check in checks), "checks": checks}
    text = json.dumps(output, ensure_ascii=False, indent=2)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(text + "\n", encoding="utf-8")
    print(text)
    raise SystemExit(0 if output["passed"] else 1)


if __name__ == "__main__":
    main()
