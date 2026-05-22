# Phase 12C-PY — Deterministic Protocol Intake (Python)

**Status:** Reviewable drafts only. No publish, bind, runtime mutation, vector DB, or mandatory LLM.

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/phase_12c_protocol_intake.py` | CLI orchestrator |
| `scripts/phase_12c_protocol_intake_smoke.py` | Fixture smoke wrapper |
| `scripts/lib/protocol_intake/` | Normalization, retrieval, extractors, gates, composition |

## CLI

```bash
python scripts/phase_12c_protocol_intake.py --input fixtures/protocol-intake --output ./out/para --study-key PARA_OA_012
python scripts/phase_12c_protocol_intake.py --smoke
```

Flags: `--input`, `--output`, `--study-key`, `--force`, `--format json|markdown|both`, `--timestamp` (off by default for idempotency).

## Optional libraries (graceful fallback)

- PyMuPDF (`fitz`) — PDF text
- pdfplumber — table coordinates
- python-docx — Word (stdlib ZIP XML fallback)
- openpyxl / pandas — Excel
- rapidfuzz — fuzzy retrieval boost

Stdlib-only path works for `.txt` / `.csv` fixtures.

## Output artifacts

- `manifest.json`
- `study_metadata_draft.json`
- `eligibility_draft.json`
- `schedule_draft.json`
- `procedure_draft.json`
- `source_composition_draft.json`
- `vpi_draft.json`
- `cliniq_draft.json`
- `review_summary.md`

## Safety (hardcoded)

```json
{ "auto_publish": false, "auto_bind": false, "runtime_mutation": false, "requires_human_approval": true }
```

Approved outputs (`approval_status: "approved"`) are not overwritten without `--force`.
