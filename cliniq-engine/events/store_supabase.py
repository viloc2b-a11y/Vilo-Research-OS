import os
from datetime import datetime, timezone
from supabase import create_client

def _get_supabase():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise ImportError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    return create_client(url, key)

def append(event) -> None:
    try:
        db = _get_supabase()
        db.table("cliniq_events").insert({
            "id": str(event.id),
            "event_type": str(event.event_type),
            "payload": event.payload,
            "created_at": event.created_at.isoformat() if hasattr(event.created_at, "isoformat") else str(event.created_at),
        }).execute()
    except Exception as e:
        print(f"DB Error in append: {e}")

def get_all() -> list:
    try:
        db = _get_supabase()
        res = db.table("cliniq_events").select("*").order("created_at").execute()
        from events.models import ClinIQEvent
        return [ClinIQEvent(**r) for r in res.data]
    except Exception as e:
        print(f"DB Error in get_all: {e}")
        return []

def get_by_type(event_type: str) -> list:
    try:
        db = _get_supabase()
        res = db.table("cliniq_events").select("*").eq("event_type", event_type).order("created_at").execute()
        from events.models import ClinIQEvent
        return [ClinIQEvent(**r) for r in res.data]
    except Exception as e:
        print(f"DB Error in get_by_type: {e}")
        return []

def count() -> int:
    try:
        db = _get_supabase()
        res = db.table("cliniq_events").select("*", count="exact").execute()
        return res.count if res.count is not None else 0
    except Exception as e:
        print(f"DB Error in count: {e}")
        return 0

def upsert_billable(billable) -> None:
    try:
        db = _get_supabase()
        db.table("expected_billables").upsert({
            "id": str(billable.id),
            "study_id": str(billable.study_id),
            "visit_name": str(billable.visit_name),
            "activity_id": str(billable.activity_id),
            "activity_type": str(billable.activity_type),
            "quantity": float(billable.quantity),
            "unit_cost": float(billable.unit_cost),
            "billable_to": str(billable.billable_to),
            "status": str(billable.status),
        }, on_conflict="study_id,visit_name,activity_id").execute()
    except Exception as e:
        print(f"DB Error in upsert_billable: {e}")

def mark_billable_triggered(study_id: str, visit_name: str, activity_id: str) -> None:
    try:
        db = _get_supabase()
        db.table("expected_billables").update({
            "status": "triggered",
            "triggered_at": datetime.now(timezone.utc).isoformat(),
        }).eq("study_id", study_id).eq("visit_name", visit_name).eq("activity_id", activity_id).execute()
    except Exception as e:
        print(f"DB Error in mark_billable_triggered: {e}")

def get_pending_billables(study_id: str) -> list:
    try:
        db = _get_supabase()
        res = db.table("expected_billables").select("*").eq("study_id", study_id).eq("status", "pending").execute()
        from soa.models import ExpectedBillable
        from decimal import Decimal
        return [
            ExpectedBillable(
                id=row["id"],
                study_id=row["study_id"],
                visit_name=row["visit_name"],
                activity_id=row["activity_id"],
                activity_type=row["activity_type"],
                quantity=Decimal(str(row["quantity"])),
                unit_cost=Decimal(str(row["unit_cost"])),
                billable_to=row["billable_to"],
                status=row["status"],
            )
            for row in res.data
        ]
    except Exception as e:
        print(f"DB Error in get_pending_billables: {e}")
        return []

def get_leakage_summary(study_id: str) -> list:
    try:
        db = _get_supabase()
        res = db.table("leakage_summary").select("*").eq("study_id", study_id).execute()
        return res.data
    except Exception as e:
        print(f"DB Error in get_leakage_summary: {e}")
        return []

def is_supabase_configured() -> bool:
    return bool(os.environ.get("SUPABASE_URL")) and bool(os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))

def insert_event(event):
    append(event)
    return True

def get_events_by_type(event_type: str) -> list:
    return get_by_type(event_type)

def list_events(limit: int = 1000) -> list:
    try:
        db = _get_supabase()
        res = db.table("cliniq_events").select("*").order("created_at", desc=True).limit(limit).execute()
        from events.models import ClinIQEvent
        return [ClinIQEvent(**r) for r in res.data]
    except Exception as e:
        print(f"DB Error in list_events: {e}")
        return []

def clear_events() -> None:
    try:
        db = _get_supabase()
        db.table("cliniq_events").delete().neq("id", "").execute()
    except Exception as e:
        print(f"DB Error in clear_events: {e}")

def reset_client_cache() -> None:
    return None
