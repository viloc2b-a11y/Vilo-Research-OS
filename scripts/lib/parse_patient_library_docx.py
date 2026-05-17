"""
Parse coordinator library source DOCX files (CSV-like paragraphs).
Outputs JSON: { pathology: [...], medications: [...], meta: {...} }
"""
from __future__ import annotations

import csv
import io
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

# ICD-10-CM including 7th-char / X placeholders (e.g. H40.10X0, S06.0X0A)
ICD_RE = re.compile(
    r"([A-Z]\d{2}(?:\.\d{1,4})?(?:X[0-9A-Z]{1,4})*[A-Z]?)"
    r"(?=[A-Z][0-9A-Z]|[A-Z]{2,}|[A-Z][a-z]|,|$)"
)
TAIL_RE = re.compile(
    r"(Chronic|Acute|Both)(Female|Male|Both|Children)(Yes|No)(Yes|No)$"
)

SYSTEM_PREFIXES = sorted(
    [
        "Musculoskeletal",
        "Cardiovascular",
        "Genitourinary",
        "Reproductive",
        "Psychiatric",
        "Respiratory",
        "Neurologic",
        "Infectious",
        "Neoplasms",
        "Digestive",
        "Endocrine",
        "Pregnancy",
        "Nervous",
        "Mental",
        "Blood",
        "Skin",
        "Circulatory",
        "Hematologic",
        "Immune",
        "Congenital",
        "Symptoms",
        "Eye",
        "ENT",
        "Renal",
        "OB",
        "Peds",
    ],
    key=len,
    reverse=True,
)


def read_docx_paragraphs(path: Path) -> list[str]:
    with zipfile.ZipFile(path) as zf:
        root = ET.fromstring(zf.read("word/document.xml"))
    lines: list[str] = []
    for para in root.findall(".//w:p", NS):
        text = "".join(t.text or "" for t in para.findall(".//w:t", NS)).strip()
        if text:
            lines.append(text)
    return lines


def parse_pathology_line(line: str) -> dict | None:
    if "SystemCommon_Name" in line or line.startswith("SystemCommon"):
        return None

    match_icd = ICD_RE.search(line)
    if not match_icd:
        return None

    icd10 = match_icd.group(1)
    after_icd = line[match_icd.end() :]
    match_tail = TAIL_RE.search(after_icd)
    if not match_tail:
        return None

    synonyms = after_icd[: match_tail.start()].strip().rstrip(",")
    chronic_acute, sex_specific, pediatric, active = match_tail.groups()
    before = line[: match_icd.start()]

    system = "Unknown"
    rest = before
    for prefix in SYSTEM_PREFIXES:
        if before.startswith(prefix):
            system = prefix
            rest = before[len(prefix) :]
            break

    # Diabetes rows: EndocrineDiabetesType 2... / EndocrineType 1 diabetes...
    if rest.startswith("DiabetesType"):
        common_name = "Diabetes"
        medical_name = rest[len("Diabetes") :].strip()
    elif rest.startswith("Type 1 diabetes"):
        common_name = "Type 1 diabetes"
        medical_name = rest
    elif rest.startswith("Type 2 diabetes"):
        common_name = "Type 2 diabetes"
        medical_name = rest
    else:
        parts = re.split(r"(?<=[a-z])(?=[A-Z])", rest, maxsplit=1)
        if len(parts) == 2:
            common_name, medical_name = parts[0].strip(), parts[1].strip()
        else:
            common_name = rest.strip()
            medical_name = common_name

    if not common_name:
        return None

    return {
        "system": system,
        "common_name": common_name,
        "medical_name": medical_name or common_name,
        "icd10_code": icd10,
        "synonyms": synonyms,
        "chronic_acute": chronic_acute,
        "sex_specific": sex_specific,
        "pediatric_use": pediatric == "Yes",
        "active_flag": active == "Yes",
    }


def dedupe_pathology(rows: list[dict]) -> tuple[list[dict], int]:
    seen: set[str] = set()
    out: list[dict] = []
    skipped = 0
    for row in rows:
        key = f"{row['common_name'].lower().strip()}|{(row.get('icd10_code') or '').lower().strip()}"
        if key in seen:
            skipped += 1
            continue
        seen.add(key)
        out.append(row)
    return out, skipped


def parse_pathology_docx(path: Path) -> tuple[list[dict], dict]:
    lines = read_docx_paragraphs(path)
    parsed = [parse_pathology_line(line) for line in lines[1:]]
    rows = [r for r in parsed if r]
    rows, dupes = dedupe_pathology(rows)
    for i, row in enumerate(rows, start=1):
        row["external_seed_id"] = 20000 + i
    meta = {
        "source_file": str(path),
        "paragraph_lines": len(lines),
        "parsed_rows": len([r for r in parsed if r]),
        "duplicate_rows_skipped": dupes,
        "output_rows": len(rows),
        "parse_failures": len(lines) - 1 - len([r for r in parsed if r]),
    }
    return rows, meta


def yn_bool(value: str | None) -> bool:
    if not value:
        return True
    return str(value).strip().lower() in ("yes", "y", "true", "1")


def parse_medications_docx(path: Path) -> tuple[list[dict], dict]:
    lines = read_docx_paragraphs(path)
    reader = csv.DictReader(io.StringIO("\n".join(lines)))
    rows: list[dict] = []
    skipped = 0
    seen: set[str] = set()

    for raw in reader:
        if (raw.get("record_type") or "").strip().upper() != "MEDICATION":
            continue

        name = (raw.get("medication_name") or "").strip()
        if not name:
            skipped += 1
            continue

        route = (raw.get("route") or "").strip().lower() or None
        dosage_form = (raw.get("dosage_form") or "").strip().lower() or None
        key = f"{name.lower()}|{route or ''}|{dosage_form or ''}"
        if key in seen:
            skipped += 1
            continue
        seen.add(key)

        ext_id = (raw.get("id_2") or raw.get("id_1") or "").strip()
        external_seed_id = int(ext_id) if ext_id.isdigit() else None

        rows.append(
            {
                "external_seed_id": external_seed_id,
                "medication_name": name,
                "brand_name": (raw.get("brand_name") or "").strip() or None,
                "drug_class": (raw.get("drug_class") or "").strip() or None,
                "route": route,
                "dosage_form": dosage_form,
                "active_flag": yn_bool(raw.get("active_flag")),
            }
        )

    meta = {
        "source_file": str(path),
        "paragraph_lines": len(lines),
        "medication_rows": len(rows),
        "duplicate_or_empty_skipped": skipped,
        "link_rows_ignored": sum(
            1 for raw in csv.DictReader(io.StringIO("\n".join(lines))) if raw.get("record_type") == "LINK"
        ),
    }
    return rows, meta


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    pathology_path = root / "patology catalog.docx"
    medications_path = root / "Medicamentos.docx"

    if len(sys.argv) >= 3:
        pathology_path = Path(sys.argv[1])
        medications_path = Path(sys.argv[2])

    if not pathology_path.is_file():
        print(json.dumps({"error": f"pathology file not found: {pathology_path}"}))
        sys.exit(1)
    if not medications_path.is_file():
        print(json.dumps({"error": f"medications file not found: {medications_path}"}))
        sys.exit(1)

    pathology, pathology_meta = parse_pathology_docx(pathology_path)
    medications, medications_meta = parse_medications_docx(medications_path)

    print(
        json.dumps(
            {
                "pathology": pathology,
                "medications": medications,
                "meta": {
                    "pathology": pathology_meta,
                    "medications": medications_meta,
                },
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
