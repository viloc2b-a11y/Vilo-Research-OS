from __future__ import annotations

import os
from typing import Any

from .models import ClinIQEvent

# In-process mirror for the current worker: kept in sync with emit_event when using
# Supabase, and is the sole store when env is not configured (explicit fallback).
event_store: list[ClinIQEvent] = []


def _supabase_enabled() -> bool:
    """Prefer Supabase when URL + service role key are set."""
    from .store_supabase import is_supabase_configured

    return is_supabase_configured()


def emit_event(event_type: str, payload: dict[str, Any]) -> ClinIQEvent:
    """Create and persist a ClinIQEvent. Returns the stored event."""
    event = ClinIQEvent(event_type=event_type, payload=payload)
    if _supabase_enabled():
        from . import store_supabase

        stored = store_supabase.insert_event(event)
        event_store.append(stored)
        return stored
    event_store.append(event)
    return event


def get_events_by_type(event_type: str) -> list[ClinIQEvent]:
    if _supabase_enabled():
        from . import store_supabase

        return store_supabase.get_events_by_type(event_type)
    return [e for e in event_store if e.event_type == event_type]


def list_events(limit: int = 1000) -> list[ClinIQEvent]:
    """Recent events (by event_timestamp desc). In-memory path uses created_at ordering."""
    if _supabase_enabled():
        from . import store_supabase

        return store_supabase.list_events(limit)
    sorted_events = sorted(event_store, key=lambda e: e.created_at, reverse=True)
    return sorted_events[:limit]


def clear_event_store() -> None:
    """Clears in-process buffer; when Supabase is configured, also deletes all rows."""
    if _supabase_enabled():
        from . import store_supabase

        store_supabase.clear_events()
    event_store.clear()


def use_in_memory_store_only() -> None:
    """
    Force in-memory behavior for this process (tests / local scripts without DB).
    Clears Supabase env vars from os.environ so emit_event uses the list only.
    """
    for key in (
        "SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
    ):
        os.environ.pop(key, None)
    from . import store_supabase

    store_supabase.reset_client_cache()
