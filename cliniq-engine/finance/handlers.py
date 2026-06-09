"""
Visit execution handler.
Bridges real-world visit completion → expected billables plan.
Each matched pending billable: pending → triggered + event emitted.
"""

from __future__ import annotations

from events.store import emit_event
from soa.models import ExpectedBillable


def handle_visit_completed(
    visit_name: str,
    billables: list[ExpectedBillable],
) -> list[ExpectedBillable]:
    """
    Process a completed visit against the expected billables list.
    Mutates status in-place (acceptable with in-memory store).
    Supabase migration: replace the mutation with an UPDATE call.
    """
    triggered: list[ExpectedBillable] = []

    emit_event(
        "visit_completed",
        {
            "study_id": billables[0].study_id if billables else None,
            "visit_name": visit_name,
        },
    )

    normalized_input = visit_name.strip().lower()

    for b in billables:
        if b.normalized_visit() != normalized_input:
            continue
        if b.status != "pending":
            continue

        b.status = "triggered"
        triggered.append(b)

        emit_event(
            "billable_instance_created",
            {
                "billable_id": b.id,
                "study_id": b.study_id,
                "visit_name": b.visit_name,
                "activity_id": b.activity_id,
                "activity_type": b.activity_type,
                "amount": float(b.amount),
                "billable_to": b.billable_to,
            },
        )

    return triggered