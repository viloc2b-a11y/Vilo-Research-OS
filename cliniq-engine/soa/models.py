from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, computed_field

BillableStatus = Literal["pending", "triggered", "billed", "waived"]


class ExpectedBillable(BaseModel):
    """
    One line item from the SoA — what should be billed when a visit occurs.
    `amount` is derived (quantity × unit_cost) and never stored separately,
    which prevents drift when either factor is corrected.
    Field names are intentionally compatible with a future Supabase schema.
    """

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    study_id: str
    visit_name: str
    activity_id: str
    activity_type: str
    quantity: Decimal
    unit_cost: Decimal
    billable_to: str
    status: BillableStatus = "pending"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def amount(self) -> Decimal:
        return self.quantity * self.unit_cost

    def normalized_visit(self) -> str:
        return self.visit_name.strip().lower()

    class Config:
        json_encoders = {Decimal: float}