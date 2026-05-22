"""Orchestrate deterministic protocol intake pipeline."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from lib.protocol_intake.composition import recommend_composition
from lib.protocol_intake.extractors import extract_eligibility, extract_metadata, extract_procedures, extract_visits
from lib.protocol_intake.normalize import collect_input_paths, normalize_documents
from lib.protocol_intake.quality import detect_conflicts, run_cross_checks
from lib.protocol_intake.readers import read_document
from lib.protocol_intake.retrieval import KeywordRetriever
from lib.protocol_intake.safety import SAFETY

DRAFT_VERSION = "12C-PY.1.0"
APPROVED_MARKER = "approval_status"


def _stable_draft_id(corpus: dict[str, Any], study_key: str | None) -> str:
    payload = json.dumps(
        {"study_key": study_key or "", "documents": [d["file_name"] for d in corpus["documents"]], "text_hash": hashlib.sha256(corpus["full_text"].encode()).hexdigest()},
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def _build_vpi(visits: list[dict[str, Any]], procedures: list[dict[str, Any]], evidence: list[dict[str, str]]) -> dict[str, Any]:
    conditional = sum(1 for p in procedures if p.get("conditional", {}).get("value") == "true")
    return {
        "visit_burden_score_inputs": {"visit_count": len(visits)},
        "safety_complexity_inputs": {"conditional_procedure_count": conditional},
        "conditional_workflow_inputs": {"flagged": conditional > 0},
        "recruitment_complexity_inputs": {},
        "staff_burden_inputs": {"visit_count": len(visits)},
        "evidence_refs": evidence[:10],
        "requires_human_review": True,
        "reviewer_status": "pending",
        "extraction_method": "deterministic_heuristic",
    }


def _build_cliniq(procedures: list[dict[str, Any]], evidence: list[dict[str, str]]) -> dict[str, Any]:
    billable = [
        {"procedure_code": p["procedure_code"]["value"], "procedure_name": p["procedure_name"]["value"]}
        for p in procedures
        if p.get("required", {}).get("value") == "true"
    ]
    conditional = [
        {
            "procedure_code": p["procedure_code"]["value"],
            "condition_text": p.get("condition_text", {}).get("value"),
        }
        for p in procedures
        if p.get("conditional", {}).get("value") == "true"
    ]
    high_cost = [p["procedure_name"]["value"] for p in procedures if re_test_name(p, r"ACTH|MRI|PET")]
    return {
        "billable_procedures": billable,
        "conditional_billables": conditional,
        "pass_through_candidates": [],
        "high_cost_assessments": high_cost,
        "visit_frequency_inputs": {},
        "evidence_refs": evidence[:10],
        "requires_human_review": True,
        "reviewer_status": "pending",
        "extraction_method": "deterministic_heuristic",
    }


def re_test_name(proc: dict[str, Any], pattern: str) -> bool:
    import re

    name = proc.get("procedure_name", {}).get("value") or ""
    return bool(re.search(pattern, name, re.I))


def build_review_summary(
    draft: dict[str, Any],
    cross_checks: list[dict[str, Any]],
    conflicts: list[dict[str, Any]],
) -> dict[str, Any]:
    found: list[str] = []
    needs_review: list[str] = []
    missing: list[str] = []
    conflict_msgs: list[str] = []
    recommended: list[str] = []

    meta = draft["study_metadata"]
    if meta.get("protocol_number", {}).get("value"):
        found.append(f"Protocol number: {meta['protocol_number']['value']}")
    else:
        missing.append("Protocol number")
    if meta.get("protocol_title", {}).get("value"):
        found.append(f"Title: {meta['protocol_title']['value']}")
    else:
        missing.append("Protocol title")
    if meta.get("sponsor", {}).get("value"):
        found.append(f"Sponsor: {meta['sponsor']['value']}")
    else:
        missing.append("Sponsor")
    if meta.get("phase", {}).get("value"):
        found.append(f"Phase: {meta['phase']['value']}")
    else:
        missing.append("Phase")

    inc = draft["eligibility"]["inclusion_criteria"]
    exc = draft["eligibility"]["exclusion_criteria"]
    if inc:
        found.append(f"{len(inc)} inclusion criteria")
    else:
        missing.append("Inclusion criteria")
    if exc:
        found.append(f"{len(exc)} exclusion criteria")
    else:
        missing.append("Exclusion criteria")

    visits = draft["schedule"]["visits"]
    procs = draft["procedures"]
    if visits:
        found.append(f"{len(visits)} visit candidate(s)")
    else:
        missing.append("Schedule visits")
    if procs:
        found.append(f"{len(procs)} procedure candidate(s)")
    else:
        missing.append("Procedures")

    for p in procs:
        if p.get("requires_human_review"):
            needs_review.append(f"Procedure {p['procedure_code']['value']} needs review")
    for v in visits:
        if v.get("requires_human_review"):
            needs_review.append(f"Visit {v['visit_code']['value']} needs review")

    for rec in draft["source_composition"]:
        blocks = rec.get("recommended_library_blocks") or []
        overlays = rec.get("recommended_overlays") or []
        if blocks or overlays:
            recommended.append(f"{rec['procedure_code']}: {' + '.join(blocks + overlays)}")
        if rec.get("requires_human_review"):
            needs_review.append(f"Source composition for {rec['procedure_code']}")

    for c in cross_checks:
        if c.get("reviewer_required"):
            needs_review.append(c["message"])
    for c in conflicts:
        conflict_msgs.append(c["message"])
        needs_review.append(f"Conflict: {c['message']}")

    return {
        "found": sorted(set(found)),
        "needs_review": sorted(set(needs_review)),
        "missing": sorted(set(missing)),
        "conflicts": sorted(set(conflict_msgs)),
        "recommended_source_sections": sorted(set(recommended)),
    }


def format_review_markdown(review: dict[str, Any], study_key: str, safety: dict[str, bool]) -> str:
    def section_items(key: str) -> list[str]:
        items = review.get(key) or []
        return [f"- {x}" for x in items] if items else ["- None"]

    lines = [
        f"# Protocol Intake Review — {study_key}",
        "",
        "> **Not Published / Not Bound** — drafts require human approval before any runtime use.",
        "",
        f"- auto_publish: `{safety['auto_publish']}`",
        f"- auto_bind: `{safety['auto_bind']}`",
        f"- runtime_mutation: `{safety['runtime_mutation']}`",
        f"- requires_human_approval: `{safety['requires_human_approval']}`",
        "",
        "## Found",
        *section_items("found"),
        "",
        "## Needs Review",
        *section_items("needs_review"),
        "",
        "## Missing",
        *section_items("missing"),
        "",
        "## Conflicts",
        *section_items("conflicts"),
        "",
        "## Recommended Source Sections",
        *section_items("recommended_source_sections"),
        "",
        "---",
        "_Generated by Phase 12C-PY deterministic intake. No embeddings, LLM, publish, bind, or runtime mutation._",
    ]
    return "\n".join(lines)


def is_approved(output_dir: Path) -> bool:
    manifest = output_dir / "manifest.json"
    if not manifest.exists():
        return False
    try:
        data = json.loads(manifest.read_text(encoding="utf-8"))
        return data.get(APPROVED_MARKER) == "approved"
    except Exception:
        return False


def run_intake(
    input_path: Path,
    output_dir: Path,
    study_key: str | None = None,
    force: bool = False,
    emit_timestamp: bool = False,
) -> dict[str, Any]:
    if is_approved(output_dir) and not force:
        raise SystemExit(f"Output is approved; use --force to overwrite: {output_dir}")

    paths = collect_input_paths(input_path)
    if not paths:
        raise SystemExit(f"No supported documents under: {input_path}")

    raw_docs = [read_document(p) for p in paths]
    corpus = normalize_documents(raw_docs)
    retriever = KeywordRetriever(corpus.get("segments") or [])
    # Optional fuzzy boost on retriever hits used via search only

    study_metadata = extract_metadata(corpus, study_key, retriever)
    eligibility = extract_eligibility(corpus)
    visits = extract_visits(corpus, retriever)
    procedures = extract_procedures(corpus, retriever)
    source_composition = recommend_composition(procedures)

    evidence_pool: list[dict[str, str]] = []
    for proc in procedures:
        evidence_pool.extend(proc.get("evidence_refs") or [])
    for visit in visits:
        evidence_pool.extend(visit.get("evidence_refs") or [])

    draft_id = _stable_draft_id(corpus, study_key)
    draft_core = {
        "draft_version": DRAFT_VERSION,
        "draft_id": draft_id,
        "study_key": study_key or study_metadata.get("protocol_number", {}).get("value") or "UNKNOWN",
        "intake_status": "needs_review",
        "safety": SAFETY,
        "source_documents": corpus["documents"],
    }
    if emit_timestamp:
        from datetime import datetime, timezone

        draft_core["created_at"] = datetime.now(timezone.utc).isoformat()

    cross_checks = run_cross_checks(
        {"study_metadata": study_metadata, "eligibility": eligibility, "schedule": {"visits": visits}, "procedures": procedures, "source_composition": source_composition},
        corpus,
    )
    conflicts = detect_conflicts(
        {"study_metadata": study_metadata, "schedule": {"visits": visits}},
        corpus,
    )
    review = build_review_summary(
        {
            "study_metadata": study_metadata,
            "eligibility": eligibility,
            "schedule": {"visits": visits},
            "procedures": procedures,
            "source_composition": source_composition,
        },
        cross_checks,
        conflicts,
    )

    vpi = _build_vpi(visits, procedures, evidence_pool)
    cliniq = _build_cliniq(procedures, evidence_pool)

    manifest = {
        **draft_core,
        "input_files": sorted([p.name for p in paths]),
        "outputs": [
            "study_metadata_draft.json",
            "eligibility_draft.json",
            "schedule_draft.json",
            "procedure_draft.json",
            "source_composition_draft.json",
            "vpi_draft.json",
            "cliniq_draft.json",
            "review_summary.md",
        ],
        "intake_conflicts": conflicts,
        "cross_checks": cross_checks,
        "review": review,
        APPROVED_MARKER: "draft",
    }

    output_dir.mkdir(parents=True, exist_ok=True)
    artifacts = {
        "manifest.json": manifest,
        "study_metadata_draft.json": {"study_metadata": study_metadata, "safety": SAFETY},
        "eligibility_draft.json": {**eligibility, "safety": SAFETY},
        "schedule_draft.json": {"visits": visits, "safety": SAFETY},
        "procedure_draft.json": {"procedures": procedures, "safety": SAFETY},
        "source_composition_draft.json": {"recommendations": source_composition, "safety": SAFETY},
        "vpi_draft.json": vpi,
        "cliniq_draft.json": cliniq,
    }

    for name, payload in artifacts.items():
        (output_dir / name).write_text(
            json.dumps(payload, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )

    (output_dir / "review_summary.md").write_text(
        format_review_markdown(review, manifest["study_key"], SAFETY),
        encoding="utf-8",
    )

    return {"manifest": manifest, "output_dir": str(output_dir), "draft_id": draft_id}
