"""Deterministic-first extractors (regex / line rules)."""
from __future__ import annotations

import re
from typing import Any

from lib.protocol_intake.gates import apply_evidence_gate


def _slug_code(name: str) -> str:
    return re.sub(r"_+", "_", re.sub(r"[^A-Z0-9]+", "_", name.upper())).strip("_")[:32]


def _slug_procedure(name: str) -> str:
    return "PROC_" + _slug_code(name)


def _first_match(text: str, pattern: str, flags: int = re.I) -> tuple[str, str] | None:
    m = re.search(pattern, text, flags)
    if not m:
        return None
    return (m.group(1) if m.lastindex else m.group(0)).strip(), m.group(0).strip()


def _find_in_corpus(corpus: dict[str, Any], pattern: str) -> tuple[str, str, dict[str, str]] | None:
    for chunk in corpus["chunks"]:
        hit = _first_match(chunk["text"], pattern)
        if hit:
            val, snippet = hit
            return val, snippet, {
                "file_name": chunk["file_name"],
                "page_or_sheet": chunk["page_or_sheet"],
                "section_reference": chunk.get("section_reference") or "",
                "source_snippet": snippet[:500],
            }
    hit = _first_match(corpus["full_text"], pattern)
    if hit:
        val, snippet = hit
        fn = corpus["documents"][0]["file_name"] if corpus["documents"] else "unknown"
        return val, snippet, {
            "file_name": fn,
            "page_or_sheet": "corpus",
            "section_reference": "",
            "source_snippet": snippet[:500],
        }
    return None


def extract_metadata(corpus: dict[str, Any], study_key: str | None, retriever: Any) -> dict[str, Any]:
    protocol_override = None
    if study_key:
        hint = study_key.replace("_", "-").upper()
        for chunk in corpus["chunks"]:
            if hint in chunk["text"].upper():
                found = _find_in_corpus(
                    {"chunks": [chunk], "full_text": chunk["text"], "documents": corpus["documents"]},
                    r"protocol\s*(?:number|no\.?|#)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-_]+)",
                )
                if found:
                    protocol_override = found
                    break

    patterns = {
        "protocol_number": r"protocol\s*(?:number|no\.?|#)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-_]+)",
        "protocol_title": r"protocol\s*title\s*[:\-]\s*(.+)",
        "brief_title": r"brief\s*title\s*[:\-]\s*(.+)",
        "sponsor": r"sponsor\s*[:\-]\s*(.+)",
        "cro": r"CRO\s*[:\-]\s*(.+)",
        "phase": r"phase\s*([12][ab]?|3|4)",
        "indication": r"indication\s*[:\-]\s*(.+)",
        "investigational_product": r"investigational\s*product\s*[:\-]\s*(.+)",
        "study_design": r"study\s*design\s*[:\-]\s*(.+)",
        "blinded_status": r"(double[- ]blind|open[- ]label|single[- ]blind)",
        "enrollment_target": r"enrollment\s*(?:target|goal)?\s*[:\-]?\s*(\d+)",
        "study_duration": r"study\s*duration\s*[:\-]\s*(.+)",
    }
    out: dict[str, Any] = {}
    for key, pat in patterns.items():
        if key == "protocol_number" and protocol_override:
            found = protocol_override
        else:
            found = _find_in_corpus(corpus, pat)
        if found:
            val, _, ref = found
            if key == "enrollment_target":
                gated = apply_evidence_gate(key, str(val), [ref], retriever)
                gated["value"] = int(val)
            else:
                gated = apply_evidence_gate(key, val, [ref], retriever)
        elif key == "protocol_number" and study_key:
            gated = apply_evidence_gate(
                key,
                study_key,
                [
                    {
                        "file_name": corpus["documents"][0]["file_name"] if corpus["documents"] else "intake",
                        "page_or_sheet": "hint",
                        "section_reference": "",
                        "source_snippet": f"Protocol id hint: {study_key}",
                    }
                ],
                retriever,
                extraction_method="study_key_hint",
            )
        else:
            gated = apply_evidence_gate(key, None, [], retriever)
        out[key] = gated
    return out


def extract_eligibility(corpus: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    inclusion: list[dict[str, Any]] = []
    exclusion: list[dict[str, Any]] = []
    for chunk in corpus["chunks"]:
        text = chunk["text"]
        for category, label in (("inclusion", "Inclusion"), ("exclusion", "Exclusion")):
            m = re.search(rf"{label}\s+Criteria\s*:?\s*([\s\S]*?)(?=(?:Inclusion|Exclusion|Schedule|Study)\s+|\Z)", text, re.I)
            if not m:
                continue
            section = m.group(1)
            for line in section.split("\n"):
                line = line.strip()
                if not re.match(r"^(\d+[\).\]]|[-•*])\s+", line) and not (len(line) > 10 and line[0].isupper()):
                    continue
                criterion = re.sub(r"^(\d+[\).\]]|[-•*])\s+", "", line).strip()
                if len(criterion) < 8:
                    continue
                ref = {
                    "file_name": chunk["file_name"],
                    "page_or_sheet": chunk["page_or_sheet"],
                    "section_reference": category,
                    "source_snippet": line[:500],
                }
                item = {
                    "criterion_text": criterion,
                    "category": category,
                    "source_page_or_section": chunk["page_or_sheet"],
                    "confidence": "medium",
                    "requires_human_review": True,
                    "reviewer_status": "pending",
                    "extraction_method": "deterministic_section",
                    "evidence_refs": [ref],
                }
                (inclusion if category == "inclusion" else exclusion).append(item)
    return {
        "inclusion_criteria": sorted(inclusion, key=lambda x: x["criterion_text"]),
        "exclusion_criteria": sorted(exclusion, key=lambda x: x["criterion_text"]),
    }


VISIT_LINE = re.compile(
    r"^\s*visit\s*(\d+)\s*:\s*(.+?)\s*(?:\(window\s*([^)]+)\))?(?:\s*[—–-]\s*(.+))?$",
    re.I | re.M,
)

MODALITY_WORDS = {
    "phone": "phone",
    "remote": "remote",
    "home": "home",
    "off-site": "off_site",
    "offsite": "off_site",
    "site": "site",
}


def _detect_modality(text: str) -> str | None:
    lower = text.lower()
    for word, val in MODALITY_WORDS.items():
        if word in lower:
            return val
    return None


def _detect_roles(text: str) -> list[str] | None:
    roles: list[str] = []
    if re.search(r"index\s*patient|index\s*subject", text, re.I):
        roles.append("index_patient")
    if re.search(r"household\s*contact", text, re.I):
        roles.append("household_contact")
    if re.search(r"participant", text, re.I):
        roles.append("participant")
    return roles or None


def _detect_arms(text: str) -> list[str] | None:
    arms: list[str] = []
    if re.search(r"arm\s*a", text, re.I):
        arms.append("Arm A")
    if re.search(r"arm\s*b", text, re.I):
        arms.append("Arm B")
    return arms or None


def extract_visits(corpus: dict[str, Any], retriever: Any) -> list[dict[str, Any]]:
    visits: list[dict[str, Any]] = []
    seen: set[str] = set()

    for chunk in corpus["chunks"]:
        text = chunk["text"]
        soe = re.search(r"schedule\s+of\s+events\s*:?\s*([\s\S]*)", text, re.I)
        block = soe.group(1) if soe else text

        for m in VISIT_LINE.finditer(block):
            day_raw, name, window, trailing = m.group(1), m.group(2).strip(), m.group(3) or "", m.group(4) or ""
            name = re.sub(r"\s*day\s*\d+\s*$", "", name, flags=re.I).strip()
            if len(name) < 3:
                continue
            code = _slug_code(name)
            if code in seen:
                continue
            seen.add(code)
            snippet = m.group(0).strip()
            ref = {
                "file_name": chunk["file_name"],
                "page_or_sheet": chunk["page_or_sheet"],
                "section_reference": "Schedule of Events",
                "source_snippet": snippet[:500],
            }
            ctx = f"{name} {trailing}"
            visits.append(
                {
                    "visit_code": apply_evidence_gate("visit_code", code, [ref], retriever),
                    "visit_name": apply_evidence_gate("visit_name", name, [ref], retriever),
                    "study_day": apply_evidence_gate(
                        "study_day",
                        str(int(day_raw)) if day_raw.isdigit() else None,
                        [ref],
                        retriever,
                    ),
                    "window": apply_evidence_gate("window", window or None, [ref], retriever),
                    "modality": apply_evidence_gate("modality", _detect_modality(ctx), [ref], retriever),
                    "eligible_arms": apply_evidence_gate(
                        "eligible_arms",
                        ",".join(_detect_arms(ctx) or []) or None,
                        [ref],
                        retriever,
                    ),
                    "eligible_subject_roles": apply_evidence_gate(
                        "eligible_subject_roles",
                        ",".join(_detect_roles(ctx) or []) or None,
                        [ref],
                        retriever,
                    ),
                    "procedures": [],
                    "confidence": "medium",
                    "requires_human_review": True,
                    "reviewer_status": "pending",
                    "extraction_method": "deterministic_visit_line",
                    "evidence_refs": [ref],
                }
            )

        for line in text.split("\n"):
            if "," not in line or "visit" in line.lower()[:8]:
                continue
            cols = [c.strip() for c in line.split(",")]
            if len(cols) < 2:
                continue
            visit_col, day_col = cols[0], cols[1] if len(cols) > 1 else ""
            if not visit_col or re.match(r"^visit$", visit_col, re.I):
                continue
            code = _slug_code(visit_col)
            if code in seen:
                continue
            seen.add(code)
            ref = {
                "file_name": chunk["file_name"],
                "page_or_sheet": chunk["page_or_sheet"],
                "section_reference": "Schedule sheet row",
                "source_snippet": line[:500],
            }
            modality = cols[3] if len(cols) > 3 else _detect_modality(line)
            visits.append(
                {
                    "visit_code": apply_evidence_gate("visit_code", code, [ref], retriever),
                    "visit_name": apply_evidence_gate("visit_name", visit_col, [ref], retriever),
                    "study_day": apply_evidence_gate(
                        "study_day",
                        day_col if day_col.isdigit() else None,
                        [ref],
                        retriever,
                    ),
                    "window": apply_evidence_gate("window", cols[2] if len(cols) > 2 else None, [ref], retriever),
                    "modality": apply_evidence_gate("modality", modality, [ref], retriever),
                    "eligible_arms": apply_evidence_gate("eligible_arms", None, [ref], retriever),
                    "eligible_subject_roles": apply_evidence_gate("eligible_subject_roles", None, [ref], retriever),
                    "procedures": [],
                    "confidence": "high",
                    "requires_human_review": False,
                    "reviewer_status": "pending",
                    "extraction_method": "deterministic_csv_row",
                    "evidence_refs": [ref],
                }
            )

    return sorted(visits, key=lambda v: v["visit_code"]["value"] or "")


PROC_LINE = re.compile(
    r"procedure\s*:\s*(.+?)\s*\((required|optional|conditional)\)",
    re.I,
)


def _categorize_procedure(name: str) -> str:
    n = name.lower()
    if "vital" in n:
        return "vitals"
    if "ae" in n or "adverse" in n:
        return "adverse_events"
    if "concomitant" in n or "conmed" in n:
        return "concomitant_medications"
    if "ip " in n or "administration" in n:
        return "ip_administration"
    if any(x in n for x in ("hema", "chem", "cortisol", "cbc", "lab", "swab")):
        return "labs"
    if "ecg" in n:
        return "ecg"
    if "exam" in n or "adrenal" in n:
        return "physical_exam"
    if "hit" in n or "platelet" in n or "pf4" in n:
        return "hit"
    if "symptom" in n or "sick" in n:
        return "symptoms"
    return "vitals"


def extract_procedures(corpus: dict[str, Any], retriever: Any) -> list[dict[str, Any]]:
    procedures: list[dict[str, Any]] = []
    seen: set[str] = set()

    for chunk in corpus["chunks"]:
        for m in PROC_LINE.finditer(chunk["text"]):
            name = m.group(1).strip()
            flag = m.group(2).lower()
            code = _slug_procedure(name)
            if code in seen:
                continue
            seen.add(code)
            conditional = flag == "conditional"
            ref = {
                "file_name": chunk["file_name"],
                "page_or_sheet": chunk["page_or_sheet"],
                "section_reference": "Study Procedures",
                "source_snippet": m.group(0)[:500],
            }
            procedures.append(
                {
                    "procedure_code": apply_evidence_gate("procedure_code", code, [ref], retriever),
                    "procedure_name": apply_evidence_gate("procedure_name", name, [ref], retriever),
                    "procedure_category": apply_evidence_gate(
                        "procedure_category", _categorize_procedure(name), [ref], retriever
                    ),
                    "required": apply_evidence_gate("required", str(flag == "required"), [ref], retriever),
                    "conditional": apply_evidence_gate("conditional", str(conditional), [ref], retriever),
                    "condition_text": apply_evidence_gate(
                        "condition_text", m.group(0) if conditional else None, [ref], retriever
                    ),
                    "timing_notes": apply_evidence_gate("timing_notes", None, [ref], retriever),
                    "confidence": "medium" if conditional else "medium",
                    "requires_human_review": conditional or flag != "required",
                    "reviewer_status": "pending",
                    "extraction_method": "deterministic_procedure_line",
                    "evidence_refs": [ref],
                }
            )

        hints = [
            (r"ACTH\s*stimulation", "ACTH Stimulation Test", "labs"),
            (r"HIT|anti[- ]?PF4|platelet\s*drop", "HIT / Platelet Panel", "hit"),
            (r"adrenal\s+(?:insufficiency\s+)?symptom", "Adrenal Symptom Review", "physical_exam"),
            (r"nasal\s*swab|home\s*swab", "Home Nasal Swab", "labs"),
            (r"sick\s*visit|unscheduled", "Unscheduled Sick Assessment", "symptoms"),
        ]
        for pattern, pname, cat in hints:
            if not re.search(pattern, chunk["text"], re.I):
                continue
            code = _slug_procedure(pname)
            if code in seen:
                continue
            seen.add(code)
            mm = re.search(pattern, chunk["text"], re.I)
            ref = {
                "file_name": chunk["file_name"],
                "page_or_sheet": chunk["page_or_sheet"],
                "section_reference": "Conditional procedures",
                "source_snippet": (mm.group(0) if mm else pname)[:500],
            }
            procedures.append(
                {
                    "procedure_code": apply_evidence_gate("procedure_code", code, [ref], retriever),
                    "procedure_name": apply_evidence_gate("procedure_name", pname, [ref], retriever),
                    "procedure_category": apply_evidence_gate("procedure_category", cat, [ref], retriever),
                    "required": apply_evidence_gate("required", "false", [ref], retriever),
                    "conditional": apply_evidence_gate("conditional", "true", [ref], retriever),
                    "condition_text": apply_evidence_gate(
                        "condition_text", mm.group(0) if mm else None, [ref], retriever
                    ),
                    "timing_notes": apply_evidence_gate("timing_notes", None, [ref], retriever),
                    "confidence": "medium",
                    "requires_human_review": True,
                    "reviewer_status": "pending",
                    "extraction_method": "deterministic_conditional_hint",
                    "evidence_refs": [ref],
                }
            )

    return sorted(procedures, key=lambda p: p["procedure_code"]["value"] or "")
