# Phase 4C.3B — Workbook-to-JSON Import Validator

**Status:** Implemented.

**Parents:** [`PHASE4C3-WORKBOOK-V3-GENERATOR.md`](./PHASE4C3-WORKBOOK-V3-GENERATOR.md) · [`PHASE4C2-CANONICAL-JSON-SCHEMAS.md`](./PHASE4C2-CANONICAL-JSON-SCHEMAS.md)

**Core principle:** The workbook is an **editing interface only**. JSON Schemas remain the **source of truth**. Imported data is **untrusted** until validated and emitted as a normalized import bundle.

**Baseline:** GREEN Phase **3C** unchanged. Phase **4B** migrations unchanged. No compiler, UI, or RPCs in this phase.

---

## A. Purpose

Reverse the Phase **4C.3** path:

```text
cpst-workbook-v3.xlsx  →  import-cpst-workbook-v3.mjs  →  cpst-workbook-v3.import.json
                              ↓
                    structural (+ optional AJV) validation
```

Downstream compiler steps must consume **validated JSON**, not raw Excel.

---

## B. Input/output paths

| Argument | Default |
|----------|---------|
| `--input` | `vilo-os/templates/cpst-workbook-v3.xlsx` |
| `--output` | `vilo-os/tmp/imports/cpst-workbook-v3.import.json` |
| `--manifest` | `vilo-os/templates/cpst-workbook-v3.manifest.json` |
| `--strict` | Exit code `1` when `status: invalid` |

**Commands:**

```bash
npm run schemas:validate
npm run generate:workbook
npm run import:workbook
```

---

## C. Workbook parsing rules

1. Sheets driven by **manifest** `sheets[]` (not hardcoded columns).
2. **Meta sheets skipped:** `Overview`, `Schema_Version`, `Instructions`, `Controlled_Lists`.
3. **Header row:** Auto-detected (supports banner row on runtime/domain sheets).
4. Headers map to properties by stripping optional ` *` suffix.
5. **Skipped rows:**
   - `[EXAMPLE]` / `[VALIDATION]` helper rows
   - Completely empty rows
6. **Unknown workbook sheets** → warning.
7. **Missing manifest sheets** → warning.

---

## D. Type coercion rules

Resolved from each row schema + `common.schema.json` `$ref`:

| Schema type | Coercion |
|-------------|----------|
| `boolean` | `TRUE`/`FALSE`, `yes`/`no`, `1`/`0` |
| `integer` | Parsed integer (truncates floats) |
| `number` | Parsed float |
| `format: date` | Excel serial or `Date` → `YYYY-MM-DD` |
| `format: date-time` | ISO-8601 UTC string |
| `enum` | Case-insensitive match to allowed value |
| `array` | JSON array or comma-separated list |
| `string` | Trimmed text |

---

## E. Required-field handling

Before schema validation:

- Manifest `required_columns` checked per populated row.
- Schema `required` array checked in structural pass.
- Errors include: `sheet`, `row`, `field`, `error_code`, `message`.

**Empty template behavior:** No data rows below helper rows → **0 rows imported**, `status: valid`, no required-field errors (nothing populated to violate).

---

## F. AJV / full schema validation status

| Mode | When |
|------|------|
| **Structural** (always) | Required fields, enums, regex patterns from schemas |
| **AJV** (optional) | When `ajv` + `ajv-formats` are installed |

If AJV is absent → warning `AJV_DEFERRED`; structural validation still runs.

Install for full validation:

```bash
npm install -D ajv ajv-formats
```

`CPST_Workbook` bundle validation runs only when `study_setup` has ≥1 row (empty template skips bundle AJV with `BUNDLE_SKIPPED_EMPTY` warning).

---

## G. Error/warning structure

**Error object:**

```json
{
  "sheet": "Visit_Templates",
  "row": 5,
  "field": "visit_id",
  "error_code": "MISSING_REQUIRED",
  "message": "Required field \"visit_id\" is empty"
}
```

**Warning object:**

```json
{
  "sheet": "Study_Setup",
  "error_code": "AJV_DEFERRED",
  "message": "Full JSON Schema validation deferred..."
}
```

**Provenance:** Row metadata stored in `provenance_map` keyed by `SheetName:rowNumber` — **not** injected into dictionary rows (schemas use `additionalProperties: false`).

**Import output** includes:

- `data` — normalized row arrays per sheet/domain/runtime
- `cpst_bundle` — shape aligned with `CPST_Workbook.schema.json`
- `provenance_map` — workbook row traceability

---

## Limitations (implemented)

| Item | Mitigation |
|------|------------|
| Excel dropdown ranges | Generator caps validation at row 5002 (not 1048576) to avoid exceljs OOM on import |
| Row scan | Import scans ≤500 rows per sheet; stops after 25 consecutive empty rows |
| AJV | Optional; mismatched `ajv`/`ajv-formats` versions fall back to structural validation with `AJV_DEFERRED` warning |

---

## H. Exact next step

1. **Parser mapping plan** (`PHASE4C3-PARSER-MAPPING-PLAN.md`) — PDF/OCR → same row shapes  
2. **Source Definition Compiler** — consume validated `cpst_bundle` + CRG  
3. **CI gate** — `import:workbook --strict` on golden fixture workbook  

---

*Regulatory-informed engineering posture only.*
