"""Cross-checks and conflict detection."""
from __future__ import annotations

import re
from typing import Any


def run_cross_checks(draft: dict[str, Any], corpus: dict[str, Any]) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    meta = draft["study_metadata"]
    pn = meta.get("protocol_number", {}).get("value")
    title = meta.get("protocol_title", {}).get("value")
    if pn and title and str(pn) not in str(title):
        findings.append(
            {
                "check_id": "metadata_consistency",
                "message": "Protocol number not echoed in extracted title — verify both fields",
                "reviewer_required": True,
            }
        )

    narrative_visits = len(re.findall(r"\bvisit\s*\d+\s*:", corpus["full_text"], re.I))
    visit_count = len(draft["schedule"]["visits"])
    if narrative_visits > 0 and visit_count > 0 and abs(narrative_visits - visit_count) > 1:
        findings.append(
            {
                "check_id": "visit_count_consistency",
                "message": f"Narrative mentions {narrative_visits} visit(s) but draft has {visit_count}",
                "reviewer_required": True,
            }
        )

    inc = len(draft["eligibility"]["inclusion_criteria"])
    exc = len(draft["eligibility"]["exclusion_criteria"])
    if inc == 0 or exc == 0:
        findings.append(
            {
                "check_id": "eligibility_count_sanity",
                "message": f"Eligibility counts: {inc} inclusion, {exc} exclusion",
                "reviewer_required": True,
            }
        )

    bound = {r["procedure_code"] for r in draft["source_composition"]}
    unbound = [
        p["procedure_code"]["value"]
        for p in draft["procedures"]
        if p["procedure_code"]["value"] not in bound
    ]
    if unbound:
        findings.append(
            {
                "check_id": "procedure_binding_readiness",
                "message": f"{len(unbound)} procedure(s) lack composition recommendation",
                "reviewer_required": True,
            }
        )

    return findings


def detect_conflicts(draft: dict[str, Any], corpus: dict[str, Any]) -> list[dict[str, Any]]:
    conflicts: list[dict[str, Any]] = []
    protocol_hits: dict[str, list[dict[str, str]]] = {}
    for m in re.finditer(
        r"protocol\s*(?:number|no\.?|#)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-_]+)",
        corpus["full_text"],
        re.I,
    ):
        val = m.group(1).upper()
        chunk = next((c for c in corpus["chunks"] if m.group(0) in c["text"]), corpus["chunks"][0] if corpus["chunks"] else None)
        ref = {
            "file_name": chunk["file_name"] if chunk else "unknown",
            "page_or_sheet": chunk["page_or_sheet"] if chunk else "corpus",
            "section_reference": "",
            "source_snippet": m.group(0)[:500],
        }
        protocol_hits.setdefault(val, []).append(ref)

    distinct = sorted(protocol_hits.keys())
    if len(distinct) > 1:
        conflicts.append(
            {
                "conflict_id": "protocol_number_disagreement",
                "field": "protocol_number",
                "values": distinct,
                "message": f"Multiple protocol numbers found: {' vs '.join(distinct)}",
                "evidence_refs": [r for refs in protocol_hits.values() for r in refs],
                "requires_human_review": True,
            }
        )

    phases = set()
    phase_evidence: list[dict[str, str]] = []
    for m in re.finditer(r"phase\s*([12][ab]?|3|4)", corpus["full_text"], re.I):
        phases.add(m.group(1).lower())
        chunk = next((c for c in corpus["chunks"] if m.group(0) in c["text"]), None)
        if chunk:
            phase_evidence.append(
                {
                    "file_name": chunk["file_name"],
                    "page_or_sheet": chunk["page_or_sheet"],
                    "section_reference": "",
                    "source_snippet": m.group(0)[:500],
                }
            )
    if len(phases) > 1:
        conflicts.append(
            {
                "conflict_id": "phase_disagreement",
                "field": "phase",
                "values": sorted(phases),
                "message": f"Conflicting phase values: {' vs '.join(sorted(phases))}",
                "evidence_refs": phase_evidence,
                "requires_human_review": True,
            }
        )

    return conflicts
