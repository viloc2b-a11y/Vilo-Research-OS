"""Evidence gates — high confidence only with matching evidence."""
from __future__ import annotations

import re
from typing import Any


def _norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def evidence_supports_value(value: str | None, evidence_refs: list[dict[str, str]]) -> bool:
    if not value:
        return False
    needle = _norm(str(value))
    if not needle:
        return False
    return any(needle in _norm(ref.get("source_snippet", "")) for ref in evidence_refs)


def apply_evidence_gate(
    field_label: str,
    value: str | None,
    evidence_refs: list[dict[str, str]],
    retriever: Any | None = None,
    extraction_method: str = "deterministic_regex",
) -> dict[str, Any]:
    evidence = list(evidence_refs)
    notes: list[str] = []

    if value and not evidence and retriever:
        from lib.protocol_intake.retrieval import segment_to_evidence

        for hit in retriever.search(f"{field_label} {value}", limit=3):
            evidence.append(segment_to_evidence(hit))
        if evidence:
            notes.append("Evidence retrieved post-extraction")

    if not value:
        return {
            "value": None,
            "confidence": "low",
            "requires_human_review": True,
            "reviewer_status": "pending",
            "extraction_method": extraction_method,
            "evidence_refs": evidence,
            "gate_notes": ["No value extracted"],
        }

    if not evidence:
        return {
            "value": value,
            "confidence": "low",
            "requires_human_review": True,
            "reviewer_status": "pending",
            "extraction_method": extraction_method,
            "evidence_refs": [],
            "gate_notes": ["No supporting evidence found"],
        }

    direct = evidence_supports_value(value, evidence)
    confidence = "high" if direct else "medium"
    if not direct:
        notes.append("Extracted value not found verbatim in evidence snippet")

    requires_human_review = confidence != "high" or bool(notes)
    return {
        "value": value,
        "confidence": confidence,
        "requires_human_review": requires_human_review,
        "reviewer_status": "pending",
        "extraction_method": extraction_method,
        "evidence_refs": evidence,
        "gate_notes": notes,
    }
