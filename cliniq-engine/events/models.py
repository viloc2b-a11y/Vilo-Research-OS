from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


class ClinIQEvent(BaseModel):
    """
    Immutable audit record. Append-only — never mutate after creation.
    Payload is untyped here; each emitter owns its payload shape.
    Migration path: swap event_store.append() for a Supabase INSERT.
    """

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: str
    payload: dict[str, Any]
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
