#!/usr/bin/env python3
"""Run repeatable KPI acceptance checks against the approved sample files."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from amos_pipeline import validate as validate_amos
from aog_pipeline import validate as validate_aog
from fak_pipeline import validate as validate_fak


EXPECTED = {
    "amos": {
        "total_picking_lists": 39026,
        "aog_total": 2404,
        "aog_on_time": 2305,
        "aog_on_time_percentage": 95.88,
        "normal_total": 36622,
        "normal_on_time": 33136,
        "normal_on_time_percentage": 90.48,
    },
    "aog": {
        "total_deliveries": 1221,
        "on_time_deliveries": 1171,
        "late_deliveries": 50,
        "on_time_percentage": 95.9,
    },
    "fak": {
        "total_movements": 567,
        "passenger_aircraft": 484,
        "cargo_aircraft": 83,
        "on_time_movements": 564,
        "delayed_movements": 3,
        "missed_flights": 0,
        "on_time_percentage": 99.47,
    },
}


def compare(name: str, report: dict) -> dict:
    actual = report.get("kpis", {})
    checks = []
    for metric, expected in EXPECTED[name].items():
        value = actual.get(metric)
        checks.append({
            "metric": metric,
            "expected": expected,
            "actual": value,
            "passed": value == expected,
        })
    return {
        "dashboard": name.upper(),
        "source_status": report.get("status"),
        "checks": checks,
        "passed": report.get("safe_to_replace_live_data") is True and all(item["passed"] for item in checks),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--amos", type=Path, required=True)
    parser.add_argument("--aog", type=Path, required=True)
    parser.add_argument("--fak", type=Path, required=True)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()

    results = [
        compare("amos", validate_amos(args.amos)),
        compare("aog", validate_aog(args.aog)),
        compare("fak", validate_fak(args.fak)),
    ]
    output = {
        "passed": all(result["passed"] for result in results),
        "dashboards": results,
    }
    text = json.dumps(output, ensure_ascii=False, indent=2)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(text + "\n", encoding="utf-8")
    print(text)
    raise SystemExit(0 if output["passed"] else 1)


if __name__ == "__main__":
    main()
