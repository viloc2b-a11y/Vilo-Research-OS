"""
SoA CSV → ExpectedBillable parser.

Expected columns (case-insensitive, extra columns ignored):
    study_id | visit_name | activity_id | activity_type
    quantity | unit_cost  | billable_to

Rows with missing or un-parseable required fields are skipped with a warning.
The parser never raises — it always returns whatever it successfully parsed.
"""

from __future__ import annotations

import csv
import io
import warnings
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Union

from events.store import emit_event
from .models import ExpectedBillable

_REQUIRED = frozenset(
    {"study_id", "visit_name", "activity_id", "activity_type",
     "quantity", "unit_cost", "billable_to"}
)


def _normalise(key: str) -> str:
    return key.strip().lower().replace(" ", "_")


def _to_decimal(raw: str, field: str, row_num: int) -> Decimal | None:
    try:
        return Decimal(raw.strip().replace(",", ""))
    except InvalidOperation:
        warnings.warn(
            f"Row {row_num}: '{field}' value '{raw}' is not a valid number — row skipped."
        )
        return None


def parse_soa_to_expected_billables(
    source: Union[str, Path, io.StringIO],
) -> list[ExpectedBillable]:
    """
    Parse a SoA CSV into a list of ExpectedBillable objects.

    Args:
        source: file path (str | Path) or an open StringIO.

    Emits:
        expected_billables_generated  — always, even on empty result.
    """
    if isinstance(source, (str, Path)):
        text = Path(source).read_text(encoding="utf-8-sig")   # strips BOM
        reader = csv.DictReader(io.StringIO(text))
    else:
        reader = csv.DictReader(source)

    billables: list[ExpectedBillable] = []

    for row_num, raw_row in enumerate(reader, start=2):        # row 1 = header
        row = {_normalise(k): (v or "").strip() for k, v in raw_row.items() if k}

        missing = _REQUIRED - row.keys()
        if missing:
            warnings.warn(f"Row {row_num}: missing columns {missing} — skipped.")
            continue

        if not any(row.values()):
            continue   # blank row

        quantity = _to_decimal(row["quantity"], "quantity", row_num)
        unit_cost = _to_decimal(row["unit_cost"], "unit_cost", row_num)
        if quantity is None or unit_cost is None:
            continue

        billables.append(
            ExpectedBillable(
                study_id=row["study_id"],
                visit_name=row["visit_name"],
                activity_id=row["activity_id"],
                activity_type=row["activity_type"],
                quantity=quantity,
                unit_cost=unit_cost,
                billable_to=row["billable_to"],
            )
        )

    emit_event(
        "expected_billables_generated",
        {
            "total_items": len(billables),
            "total_value": float(sum(b.amount for b in billables)),
        },
    )

    return billables
