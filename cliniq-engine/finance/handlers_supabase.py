from events.store_supabase import (
    append, upsert_billable, mark_billable_triggered, get_pending_billables
)
from events.models import ClinIQEvent
from soa.models import ExpectedBillable
import uuid
from datetime import datetime, timezone

def seed_expected_billables(billables: list[ExpectedBillable], study_id: str) -> None:
    """
    Upsert all billables for a study into Supabase.
    Call once after parsing the SoA CSV.
    Idempotent — safe to call multiple times.
    Sets study_id on each billable before upserting.
    """
    for b in billables:
        b.study_id = study_id
        upsert_billable(b)

def handle_visit_completed(visit_name: str, study_id: str) -> list[ExpectedBillable]:
    """
    1. Load pending billables for this study filtered by visit_name
    2. Mark each as triggered in Supabase
    3. Emit 'billable_triggered' event per item
    4. Emit one 'visit_completed' summary event
    5. Return list of triggered billables
    """
    all_pending = get_pending_billables(study_id)
    visit_pending = [b for b in all_pending if b.visit_name == visit_name]

    triggered = []
    for b in visit_pending:
        mark_billable_triggered(study_id, visit_name, b.activity_id)
        append(ClinIQEvent(
            id=str(uuid.uuid4()),
            event_type="billable_triggered",
            payload={
                "study_id": study_id,
                "visit_name": visit_name,
                "activity_id": b.activity_id,
                "amount": float(b.amount),
            },
            created_at=datetime.now(timezone.utc),
        ))
        triggered.append(b)

    append(ClinIQEvent(
        id=str(uuid.uuid4()),
        event_type="visit_completed",
        payload={
            "study_id": study_id,
            "visit_name": visit_name,
            "triggered_count": len(triggered)
        },
        created_at=datetime.now(timezone.utc),
    ))
    
    return triggered
