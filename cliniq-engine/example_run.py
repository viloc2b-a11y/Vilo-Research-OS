"""
ClinIQ — SoA Engine Example Run
Pipeline:
  1. Parse SoA CSV  -> ExpectedBillable list
  2. Screening Visit completed  -> trigger matching billables
  3. Baseline Visit completed   -> trigger matching billables
  4. Leakage detection          -> flag remaining pending items
  5. Print full event log

Run from the repo root:
    python .\cliniq-engine\example_run.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Make sibling packages importable without installing
sys.path.insert(0, str(Path(__file__).parent))

from events.store import clear_event_store, event_store
from finance import detect_revenue_leakage, handle_visit_completed
from soa import parse_soa_to_expected_billables


def _section(title: str) -> None:
    print("\n" + "-" * 60)
    print(f"  {title}")
    print("-" * 60)


def main() -> None:
    clear_event_store()

    csv_path = Path(__file__).parent / "mock_soa.csv"

    # 1. Parse SoA
    _section("1. Parse SoA CSV")
    billables = parse_soa_to_expected_billables(csv_path)
    total = sum(b.amount for b in billables)
    print(f"  {len(billables)} billables loaded   |   total value: ${total:,.2f}\n")
    for b in billables:
        print(
            f"  [{b.status:8}]  {b.visit_name:<22}  {b.activity_id:<10}  ${b.amount:>8.2f}  -> {b.billable_to}"
        )

    # 2. Screening Visit
    _section("2. Visit Completed: Screening Visit")
    triggered = handle_visit_completed("Screening Visit", billables)
    print(f"  {len(triggered)} billable(s) triggered")
    for b in triggered:
        print(f"  OK  {b.activity_id}  ${b.amount:.2f}  [{b.status}]")

    # 3. Baseline Visit
    _section("3. Visit Completed: Baseline Visit")
    triggered = handle_visit_completed("Baseline Visit", billables)
    print(f"  {len(triggered)} billable(s) triggered")
    for b in triggered:
        print(f"  OK  {b.activity_id}  ${b.amount:.2f}  [{b.status}]")

    # 4. Leakage Detection
    _section("4. Revenue Leakage Detection")
    leaked = detect_revenue_leakage(billables)
    leaked_value = sum(b.amount for b in leaked)
    print(f"  {len(leaked)} leaked item(s)   |   leaked value: ${leaked_value:,.2f}\n")
    for b in leaked:
        print(f"  !!  {b.visit_name:<22}  {b.activity_id:<10}  ${b.amount:.2f}")

    # 5. Event Log
    _section(f"5. Event Store ({len(event_store)} events)")
    for e in event_store:
        ts = e.created_at.strftime("%H:%M:%S.%f")
        payload_lines = json.dumps(e.payload, indent=6).splitlines()
        print(f"\n  [{ts}]  {e.event_type}")
        for line in payload_lines:
            print(f"    {line}")


if __name__ == "__main__":
    main()