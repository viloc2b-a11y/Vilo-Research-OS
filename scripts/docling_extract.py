import sys
import json
import os
import argparse
import csv

# Phase 1 (Canonical Reader Wiring):
# This is the SAME existing extraction stack already wired through
# lib/protocol-intake/extractors/document-extraction-adapter.ts.
# It is enhanced (not replaced) to additionally expose:
#   - full_text       (document text so downstream section/candidate extractors can run)
#   - tables[].page_no (page provenance when the reader exposes it)
#   - extraction_method / page_count (provenance preservation)
# No new reader is introduced; PDF/DOCX use docling, XLSX uses openpyxl, CSV uses stdlib.


def _docling_extract(file_path):
    """PDF / DOCX via docling. Returns (full_text, tables, page_count)."""
    from docling.document_converter import DocumentConverter

    converter = DocumentConverter()
    result = converter.convert(file_path)
    document = result.document

    try:
        full_text = document.export_to_markdown()
    except Exception:
        full_text = ""

    tables = []
    for table in getattr(document, "tables", []) or []:
        page_no = None
        try:
            prov = getattr(table, "prov", None) or []
            if prov:
                page_no = getattr(prov[0], "page_no", None)
        except Exception:
            page_no = None
        try:
            tables.append(
                {
                    "table_html": table.export_to_html(),
                    "table_markdown": table.export_to_markdown(),
                    "page_no": page_no,
                }
            )
        except Exception:
            continue

    page_count = None
    try:
        pages = getattr(document, "pages", None)
        if pages is not None:
            page_count = len(pages)
    except Exception:
        page_count = None

    return full_text, tables, page_count, "docling"


def _excel_extract(file_path):
    """XLSX via openpyxl. Returns (full_text, tables, page_count)."""
    import openpyxl

    wb = openpyxl.load_workbook(file_path, data_only=True)
    tables = []
    text_parts = []
    for sheet_name in wb.sheetnames:
        sheet = wb[sheet_name]
        data = []
        for row in sheet.iter_rows(values_only=True):
            data.append([str(cell) if cell is not None else "" for cell in row])

        text_parts.append("Sheet: %s" % sheet_name)
        html = "<table>"
        md_lines = []
        for row in data:
            html += "<tr>" + "".join("<td>%s</td>" % c for c in row) + "</tr>"
            md_lines.append(" | ".join(row))
        html += "</table>"
        text_parts.append("\n".join(md_lines))

        tables.append(
            {
                "table_html": html,
                "table_markdown": "\n".join(md_lines),
                "page_no": None,
            }
        )

    return "\n\n".join(text_parts), tables, None, "excel"


def _csv_extract(file_path):
    """CSV via stdlib. Returns (full_text, tables, page_count)."""
    rows = []
    with open(file_path, encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.reader(f)
        for row in reader:
            rows.append([str(c) for c in row])

    html = "<table>"
    md_lines = []
    for row in rows:
        html += "<tr>" + "".join("<td>%s</td>" % c for c in row) + "</tr>"
        md_lines.append(" | ".join(row))
    html += "</table>"

    full_text = "\n".join(md_lines)
    tables = [{"table_html": html, "table_markdown": full_text, "page_no": None}]
    return full_text, tables, None, "csv"


def main():
    parser = argparse.ArgumentParser(
        description="Extract text + tables from PDF/DOCX/XLSX/CSV using docling/openpyxl/stdlib."
    )
    parser.add_argument("file_path", help="Path to the input file")
    args = parser.parse_args()

    file_path = args.file_path
    if not os.path.exists(file_path):
        print(json.dumps({"error": "File not found: %s" % file_path}))
        sys.exit(1)

    ext = os.path.splitext(file_path)[1].lower()
    try:
        if ext in [".pdf", ".docx"]:
            full_text, tables, page_count, method = _docling_extract(file_path)
        elif ext in [".xlsx"]:
            full_text, tables, page_count, method = _excel_extract(file_path)
        elif ext in [".csv"]:
            full_text, tables, page_count, method = _csv_extract(file_path)
        else:
            print(json.dumps({"error": "Unsupported file extension: %s" % ext}))
            sys.exit(1)

        print(
            json.dumps(
                {
                    "full_text": full_text,
                    "tables": tables,
                    "page_count": page_count,
                    "extraction_method": method,
                }
            )
        )
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
