"""
Revenue leakage detection.
A billable is "leaked" if it remains in "pending" status past the point
where its visit should have been triggered.
"""

from __future__ import annotations

from events.store import emit_event
from soa.models import ExpectedBillable


def detect_revenue_leakage(
    billables: list[ExpectedBillable],
) -> list[ExpectedBillable]:
    leaked: list[ExpectedBillable] = []

    for b in billables:
        if b.status != "pending":
            continue

        leaked.append(b)
        emit_event(
            "revenue_leakage_flagged",
            {
                "billable_id": b.id,
                "study_id": b.study_id,
                "visit_name": b.visit_name,
                "activity_id": b.activity_id,
                "activity_type": b.activity_type,
                "amount": float(b.amount),
                "billable_to": b.billable_to,
                "reason": "still_pending_after_trigger_window",
            },
        )

    if leaked:
        emit_event(
            "revenue_leakage_summary",
            {
                "study_id": leaked[0].study_id,
                "total_leaked_items": len(leaked),
                "total_leaked_value": float(sum(b.amount for b in leaked)),
            },
        )

    return leaked
