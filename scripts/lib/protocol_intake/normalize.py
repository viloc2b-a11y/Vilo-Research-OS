"""Document normalization into pages, sheets, sections, tables, footnotes."""
from __future__ import annotations

import hashlib
import re
from pathlib import Path
from typing import Any

FOOTNOTE_LINE = re.compile(r"^(?:footnote|\[\d+\]|\d+\))\s*:?\s*", re.I)
HEADING_LINE = re.compile(r"^(?:section\s+\d+|[A-Z][A-Z0-9\s\-]{4,}):?\s*$", re.I)


def stable_document_id(file_name: str, content_hash: str) -> str:
    return hashlib.sha256(f"{file_name}:{content_hash}".encode()).hexdigest()[:16]


def split_footnotes(text: str) -> tuple[str, list[str]]:
    body_lines: list[str] = []
    footnotes: list[str] = []
    for line in text.split("\n"):
        if FOOTNOTE_LINE.match(line.strip()):
            footnotes.append(line.strip())
        else:
            body_lines.append(line)
    return "\n".join(body_lines), footnotes


def normalize_documents(docs: list[dict[str, Any]]) -> dict[str, Any]:
    normalized_docs: list[dict[str, Any]] = []
    chunks: list[dict[str, Any]] = []
    segments: list[dict[str, Any]] = []

    for raw in sorted(docs, key=lambda d: d["file_name"]):
        file_name = raw["file_name"]
        file_type = raw["file_type"]
        parts: list[str] = []

        for page in raw.get("pages") or []:
            pn = page.get("page_number", 1)
            body, fns = split_footnotes(page.get("text") or "")
            parts.append(body)
            for fn in fns:
                raw.setdefault("footnotes", []).append(
                    {"page_number": pn, "text": fn, "file_name": file_name}
                )
            chunk_id = f"{file_name}-p{pn}"
            chunks.append(
                {
                    "chunk_id": chunk_id,
                    "file_name": file_name,
                    "page_or_sheet": str(pn),
                    "section_reference": None,
                    "text": body,
                    "content_kind": "narrative",
                }
            )
            _segmentize(segments, chunk_id, file_name, str(pn), None, body)

        for sheet in raw.get("sheets") or []:
            sn = sheet.get("sheet_name", "sheet")
            lines = [",".join(sheet.get("headers") or [])]
            for row in sheet.get("rows") or []:
                lines.append(",".join(str(row.get(h, "")) for h in (sheet.get("headers") or [])))
            text = "\n".join(lines)
            parts.append(text)
            chunk_id = f"{file_name}-{sn}"
            chunks.append(
                {
                    "chunk_id": chunk_id,
                    "file_name": file_name,
                    "page_or_sheet": sn,
                    "section_reference": "Schedule sheet",
                    "text": text,
                    "content_kind": "table",
                }
            )
            segments.append(
                {
                    "segment_id": f"{chunk_id}-table",
                    "chunk_id": chunk_id,
                    "file_name": file_name,
                    "page_or_sheet": sn,
                    "section_reference": "Schedule of Events",
                    "content_kind": "table",
                    "text": text,
                    "table_coordinates": {
                        "sheet_name": sn,
                        "row_start": 1,
                        "row_end": len(lines),
                        "column_headers": sheet.get("headers") or [],
                    },
                }
            )

        for table in raw.get("tables") or []:
            headers = table.get("column_headers") or []
            rows = table.get("rows") or []
            lines = [",".join(headers)]
            for row in rows:
                if isinstance(row, dict):
                    lines.append(",".join(str(row.get(h, "")) for h in headers))
            text = "\n".join(lines)
            loc = str(table.get("sheet_name") or table.get("page_number") or "table")
            chunk_id = f"{file_name}-tbl-{loc}"
            if not any(c["chunk_id"] == chunk_id for c in chunks):
                chunks.append(
                    {
                        "chunk_id": chunk_id,
                        "file_name": file_name,
                        "page_or_sheet": loc,
                        "section_reference": "Table",
                        "text": text,
                        "content_kind": "table",
                    }
                )

        for fn in raw.get("footnotes") or []:
            text = fn.get("text") or ""
            loc = str(fn.get("page_number") or fn.get("sheet_name") or "fn")
            segments.append(
                {
                    "segment_id": f"{file_name}-fn-{loc}",
                    "chunk_id": f"{file_name}-fn",
                    "file_name": file_name,
                    "page_or_sheet": loc,
                    "section_reference": "Footnote",
                    "content_kind": "footnote",
                    "text": text,
                }
            )

        full_text = "\n\n".join(parts)
        content_hash = hashlib.sha256(full_text.encode()).hexdigest()
        normalized_docs.append(
            {
                "document_id": stable_document_id(file_name, content_hash),
                "file_name": file_name,
                "file_type": file_type,
                "pages": raw.get("pages") or [],
                "sheets": raw.get("sheets") or [],
                "sections": _detect_sections(full_text, file_name),
                "tables": raw.get("tables") or [],
                "footnotes": raw.get("footnotes") or [],
            }
        )

    full_corpus = "\n\n".join(c["text"] for c in sorted(chunks, key=lambda x: x["chunk_id"]))
    return {
        "documents": normalized_docs,
        "chunks": chunks,
        "segments": segments,
        "full_text": full_corpus,
    }


def _detect_sections(text: str, file_name: str) -> list[dict[str, Any]]:
    sections: list[dict[str, Any]] = []
    for m in re.finditer(
        r"(Inclusion Criteria|Exclusion Criteria|Schedule of Events|Study Procedures)\s*:?",
        text,
        re.I,
    ):
        sections.append(
            {
                "section_name": m.group(1),
                "file_name": file_name,
                "offset": m.start(),
            }
        )
    return sorted(sections, key=lambda s: (s["file_name"], s["offset"]))


def _segmentize(
    segments: list[dict[str, Any]],
    chunk_id: str,
    file_name: str,
    page_or_sheet: str,
    section_reference: str | None,
    body: str,
) -> None:
    idx = 0
    for block in re.split(r"\n{2,}", body):
        trimmed = block.strip()
        if not trimmed:
            continue
        kind = "heading" if HEADING_LINE.match(trimmed) else "narrative"
        segments.append(
            {
                "segment_id": f"{chunk_id}-n{idx}",
                "chunk_id": chunk_id,
                "file_name": file_name,
                "page_or_sheet": page_or_sheet,
                "section_reference": section_reference,
                "content_kind": kind,
                "text": trimmed,
            }
        )
        idx += 1


def collect_input_paths(input_path: Path) -> list[Path]:
    if input_path.is_file():
        return [input_path]
    files: list[Path] = []
    for ext in ("*.txt", "*.md", "*.pdf", "*.docx", "*.csv", "*.xlsx", "*.xls"):
        files.extend(input_path.glob(ext))
    return sorted(files, key=lambda p: p.name.lower())
