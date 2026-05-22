"""Source composition recommendations — canonical library mapping."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

CATEGORY_MAP: dict[str, dict[str, list[str]]] = {
    "vitals": {"libraries": ["VITALS_CORE_V1"], "overlays": []},
    "adverse_events": {"libraries": ["AE_CORE_V1"], "overlays": []},
    "concomitant_medications": {"libraries": ["CONMED_CORE_V1"], "overlays": []},
    "ip_administration": {"libraries": ["VITALS_CORE_V1", "IP_ADMIN_CORE_V1"], "overlays": []},
    "labs": {"libraries": ["LAB_CORE_V1"], "overlays": []},
    "ecg": {"libraries": ["ECG_CORE_V1"], "overlays": []},
    "physical_exam": {"libraries": ["PHYSICAL_EXAM_CORE_V1"], "overlays": []},
    "adrenal": {"libraries": ["PHYSICAL_EXAM_CORE_V1"], "overlays": ["PARA_ADRENAL_OVERLAY_V1"]},
    "hit": {"libraries": ["LAB_CORE_V1"], "overlays": ["PARA_HIT_OVERLAY_V1"]},
    "symptoms": {"libraries": [], "overlays": ["MV_HOUSEHOLD_SYMPTOM_OVERLAY_V1"]},
    "swab": {"libraries": ["LAB_CORE_V1"], "overlays": ["MV_HOUSEHOLD_SYMPTOM_OVERLAY_V1"]},
}

_CANONICAL_CACHE: dict[str, list[str]] | None = None


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _canonical_field_keys(library_id: str) -> list[str]:
    global _CANONICAL_CACHE
    if _CANONICAL_CACHE is None:
        path = _repo_root() / "fixtures/source-builder/canonical-clinical-library.v1.json"
        _CANONICAL_CACHE = {}
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            libs = data.get("libraries", {})
            if isinstance(libs, dict):
                for lib_id, lib in libs.items():
                    fields = lib.get("fields", []) if isinstance(lib, dict) else []
                    keys = [f["field_key"] for f in fields if isinstance(f, dict) and f.get("field_key")]
                    _CANONICAL_CACHE[lib_id] = sorted(keys)
    return _CANONICAL_CACHE.get(library_id, [])


def refine_by_name(name: str, category: str) -> dict[str, list[str]]:
    base = CATEGORY_MAP.get(category, {"libraries": ["VITALS_CORE_V1"], "overlays": []})
    libraries = list(base["libraries"])
    overlays = list(base["overlays"])
    if re_test(name, r"ACTH|adrenal|cortisol"):
        for lib in ("LAB_CORE_V1", "PHYSICAL_EXAM_CORE_V1"):
            if lib not in libraries:
                libraries.append(lib)
        if "PARA_ADRENAL_OVERLAY_V1" not in overlays:
            overlays.append("PARA_ADRENAL_OVERLAY_V1")
    if re_test(name, r"HIT|platelet|PF4|4T"):
        if "LAB_CORE_V1" not in libraries:
            libraries.append("LAB_CORE_V1")
        if "PARA_HIT_OVERLAY_V1" not in overlays:
            overlays.append("PARA_HIT_OVERLAY_V1")
    if re_test(name, r"symptom|sick|household|cough|COVID|influenza"):
        if "MV_HOUSEHOLD_SYMPTOM_OVERLAY_V1" not in overlays:
            overlays.append("MV_HOUSEHOLD_SYMPTOM_OVERLAY_V1")
    if re_test(name, r"swab"):
        if "LAB_CORE_V1" not in libraries:
            libraries.append("LAB_CORE_V1")
    return {"libraries": sorted(set(libraries)), "overlays": sorted(set(overlays))}


def re_test(text: str, pattern: str) -> bool:
    import re

    return bool(re.search(pattern, text, re.I))


def recommend_composition(procedures: list[dict[str, Any]]) -> list[dict[str, Any]]:
    recs: list[dict[str, Any]] = []
    for proc in procedures:
        code = proc["procedure_code"]["value"]
        name = proc["procedure_name"]["value"]
        category = proc["procedure_category"]["value"]
        mapping = refine_by_name(name or "", category or "vitals")
        include_fields: list[str] = []
        optional_fields: list[str] = []
        for lib in mapping["libraries"]:
            for key in _canonical_field_keys(lib):
                include_fields.append(key)
        for overlay in mapping["overlays"]:
            optional_fields.extend(_canonical_field_keys(overlay))
        omission_reasons: list[dict[str, str]] = []
        if proc.get("conditional", {}).get("value") == "true":
            omission_reasons.append(
                {
                    "field_key": "_procedure",
                    "reason": f"Conditional procedure — instantiate when: {proc.get('condition_text', {}).get('value') or 'coordinator confirms'}",
                }
            )
        recs.append(
            {
                "procedure_code": code,
                "recommended_library_blocks": mapping["libraries"],
                "recommended_overlays": mapping["overlays"],
                "include_fields": sorted(set(include_fields)),
                "optional_fields": sorted(set(optional_fields)),
                "excluded_fields": ["linked_ae_id"],
                "omission_reasons": omission_reasons,
                "evidence_refs": proc.get("evidence_refs") or [],
                "confidence": proc.get("confidence", "medium"),
                "requires_human_review": proc.get("requires_human_review", True),
                "reviewer_status": "pending",
                "extraction_method": "deterministic_category_map",
            }
        )
    return sorted(recs, key=lambda r: r["procedure_code"] or "")
